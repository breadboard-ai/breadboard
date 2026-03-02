# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
High-level entry points for running the agent loop.

Port of ``local-agent-run.ts`` and ``loop-setup.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

``run()`` and ``resume()`` are async generators that yield typed
``AgentEvent``s. They are the canonical API for running an agent from
any environment — callers provide only transport deps (``HttpClient``,
``BackendClient``, ``InteractionStore``). Everything else is internal.

Usage::

    async for event in opal_backend.run(
        objective=objective,
        client=http_client,
        backend=backend_client,
        store=interaction_store,
    ):
        # serialize event to SSE, proto, etc.
        send(event.to_dict())
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

from .agent_events import AgentEventSink, build_hooks_from_sink
from .agent_file_system import AgentFileSystem
from .backend_client import BackendClient
from .events import (
    AgentEvent,
    AgentResult,
    CompleteEvent,
    ErrorEvent,
    FileData,
)
from .functions.audio import get_audio_function_group
from .functions.chat import get_chat_function_group
from .functions.generate import get_generate_function_group
from .functions.image import get_image_function_group
from .functions.system import get_system_function_group
from .functions.video import get_video_function_group
from .http_client import HttpClient
from .interaction_store import InteractionState, InteractionStore
from .loop import AgentRunArgs, Loop, LoopController
from .suspend import SuspendResult
from .task_tree_manager import TaskTreeManager

__all__ = ["run", "resume"]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run(
    *,
    objective: dict[str, Any],
    client: HttpClient,
    backend: BackendClient,
    store: InteractionStore,
    flags: dict[str, Any] | None = None,
) -> AsyncIterator[AgentEvent]:
    """Start a new agent run.

    Creates all internal state (file system, task tree, function groups,
    loop) and yields events as the agent executes.

    Args:
        objective: The user's objective as an LLMContent dict.
        client: HTTP transport (carries credentials).
        backend: One Platform backend client.
        store: Interaction store for suspend/resume state.
        flags: Optional feature flags (e.g. ``{"googleOne": True}``).

    Yields:
        Typed ``AgentEvent`` instances.
    """
    resolved_flags = flags or {}

    file_system = AgentFileSystem()
    task_tree_manager = TaskTreeManager(file_system)
    controller = LoopController()

    function_groups = _build_function_groups(
        controller=controller,
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        client=client,
        backend=backend,
        flags=resolved_flags,
    )

    run_args = AgentRunArgs(
        objective=objective,
        function_groups=function_groups,
    )

    async for event in _stream_loop(
        run_args=run_args,
        controller=controller,
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        client=client,
        backend=backend,
        store=store,
    ):
        yield event


async def resume(
    *,
    interaction_id: str,
    response: dict[str, Any],
    client: HttpClient,
    backend: BackendClient,
    store: InteractionStore,
    flags: dict[str, Any] | None = None,
) -> AsyncIterator[AgentEvent]:
    """Resume a suspended agent run.

    Loads saved state from ``store``, injects the client's response as a
    function result, rebuilds function groups, and continues the loop.

    Args:
        interaction_id: The interaction ID from the suspend event.
        response: The client's response to the suspend prompt.
        client: HTTP transport (carries credentials).
        backend: One Platform backend client.
        store: Interaction store for suspend/resume state.
        flags: Optional feature flags.

    Yields:
        Typed ``AgentEvent`` instances.

    If the interaction ID is not found, yields a single ``ErrorEvent``.
    """
    resolved_flags = flags or {}

    state = store.load(interaction_id)
    if state is None:
        yield ErrorEvent(message=f"Unknown interaction ID: {interaction_id}")
        return

    # Inject the client's response as a function result.
    fc = state.function_call_part.get("functionCall", {})
    func_name = fc.get("name", "unknown")

    function_response_turn = {
        "parts": [{
            "functionResponse": {
                "name": func_name,
                "response": response,
            }
        }],
        "role": "user",
    }

    contents = state.contents + [function_response_turn]

    controller = LoopController()
    function_groups = _build_function_groups(
        controller=controller,
        file_system=state.file_system,
        task_tree_manager=state.task_tree_manager,
        client=client,
        backend=backend,
        flags=resolved_flags,
    )

    run_args = AgentRunArgs(
        objective=contents[0],
        function_groups=function_groups,
        contents=contents,
    )

    async for event in _stream_loop(
        run_args=run_args,
        controller=controller,
        file_system=state.file_system,
        task_tree_manager=state.task_tree_manager,
        client=client,
        backend=backend,
        store=store,
    ):
        yield event


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_function_groups(
    *,
    controller: LoopController,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    client: HttpClient,
    backend: BackendClient,
    flags: dict[str, Any],
) -> list:
    """Build the standard set of function groups."""
    enable_g1_quota = flags.get("googleOne", False)

    return [
        get_system_function_group(
            controller,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
        ),
        get_generate_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            client=client,
            backend=backend,
        ),
        get_image_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_video_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_audio_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_chat_function_group(
            task_tree_manager=task_tree_manager,
            file_system=file_system,
        ),
    ]


async def _stream_loop(
    *,
    run_args: AgentRunArgs,
    controller: LoopController,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    client: HttpClient,
    backend: BackendClient,
    store: InteractionStore,
) -> AsyncIterator[AgentEvent]:
    """Run the loop and yield events.

    Shared streaming core for both ``run()`` and ``resume()``.
    """
    sink = AgentEventSink()
    run_args.hooks = build_hooks_from_sink(sink)

    loop = Loop(
        client=client,
        backend=backend,
        controller=controller,
    )

    async def execute():
        """Run the loop and emit terminal events."""
        try:
            result = await loop.run(run_args)

            if isinstance(result, SuspendResult):
                store.save(
                    result.interaction_id,
                    InteractionState(
                        contents=result.contents,
                        function_call_part=result.function_call_part,
                        file_system=file_system,
                        task_tree_manager=task_tree_manager,
                    ),
                )
                result.suspend_event.interaction_id = (
                    result.interaction_id
                )
                sink.emit(result.suspend_event)

            elif isinstance(result, dict) and "$error" in result:
                sink.emit(ErrorEvent(message=result["$error"]))
                sink.emit(CompleteEvent(
                    result=AgentResult(success=False),
                ))
            elif isinstance(result, AgentResult):
                # Collect intermediate files.
                intermediate = None
                if result.success and file_system.files:
                    intermediate = [
                        FileData(
                            path=path,
                            content=file_system._file_to_part(desc),
                        )
                        for path, desc in file_system.files.items()
                    ]
                sink.emit(CompleteEvent(
                    result=AgentResult(
                        success=result.success,
                        outcomes=result.outcomes,
                        intermediate=intermediate,
                    ),
                ))
            else:
                # Unknown result type — treat as error.
                sink.emit(ErrorEvent(
                    message=f"Unexpected result: {result}"
                ))
        except Exception as e:
            logger.exception("Agent loop failed")
            sink.emit(ErrorEvent(message=str(e)))
        finally:
            sink.close()

    loop_task = asyncio.create_task(execute())
    try:
        async for event in sink:
            yield event
    finally:
        if not loop_task.done():
            loop_task.cancel()
