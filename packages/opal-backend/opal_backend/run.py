# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
High-level entry points for running the agent loop.

Port of ``local-agent-run.ts`` and ``loop-setup.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

``run()`` and ``resume()`` are async generators that yield typed
``AgentEvent``s. They are the canonical API for running an agent from
any environment — callers provide only transport deps (``BackendClient``,
``InteractionStore``). Everything else is internal.

Usage::

    async for event in opal_backend.run(
        objective=objective,
        backend=backend_client,
        store=interaction_store,
    ):
        # serialize event to SSE, proto, etc.
        send(event.to_dict())
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any, AsyncIterator, TypedDict

from .agent_events import AgentEventSink, build_hooks_from_sink
from .agent_file_system import AgentFileSystem
from .backend_client import BackendClient
from .drive_operations_client import DriveOperationsClient
from .events import (
    AgentEvent,
    AgentResult,
    CompleteEvent,
    ErrorEvent,
    FileData,
    QueryConsentEvent,
)
from .chat_log_manager import ChatLogManager
from .functions.audio import get_audio_function_group
from .functions.chat import get_chat_function_group, CHAT_LOG_PATH, SKIPPED_SENTINEL
from .functions.generate import get_generate_function_group
from .functions.image import get_image_function_group
from .functions.memory import get_memory_function_group
from .functions.system import get_system_function_group
from .functions.video import get_video_function_group
from .function_caller import FunctionCaller
from .function_definition import FunctionDefinition
from .interaction_store import InteractionState, InteractionStore
from .loop import AgentRunArgs, Loop, LoopController
from .sheet_manager import SheetManager
from .suspend import SuspendResult
from .task_tree_manager import TaskTreeManager

__all__ = ["run", "resume", "GraphInfo", "DriveOperationsClient"]

logger = logging.getLogger(__name__)


class GraphInfo(TypedDict, total=False):
    """Lightweight graph identity passed into run/resume.

    Mirrors the ``url`` and ``title`` fields of ``GraphDescriptor``
    from ``packages/types``.
    """

    url: str
    title: str


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run(
    *,
    objective: dict[str, Any],
    backend: BackendClient,
    store: InteractionStore,
    graph: GraphInfo,
    flags: dict[str, Any] | None = None,
    drive: DriveOperationsClient | None = None,
    use_memory: bool = False,
) -> AsyncIterator[AgentEvent]:
    """Start a new agent run.

    Creates all internal state (file system, task tree, function groups,
    loop) and yields events as the agent executes.

    Args:
        objective: The user's objective as an LLMContent dict.
        backend: Backend client for all API calls.
        store: Interaction store for suspend/resume state.
        flags: Optional feature flags (e.g. ``{"googleOne": True}``).
        graph: Graph identity (url, title).
        drive: Optional Drive/Sheets operations client for memory.
        use_memory: Whether memory functions should be enabled.

    Yields:
        Typed ``AgentEvent`` instances.
    """
    resolved_flags = flags or {}
    if use_memory:
        resolved_flags["useMemory"] = True

    file_system = AgentFileSystem()
    task_tree_manager = TaskTreeManager(file_system)
    controller = LoopController()

    # Set up memory (SheetManager) if requested and drive is available.
    sheet_manager: SheetManager | None = None
    if use_memory and drive:
        graph_url = graph.get("url", "")
        graph_title = graph.get("title", "")
        sheet_manager = SheetManager(
            drive=drive,
            graph_url=graph_url,
            graph_title=graph_title,
        )
        file_system.set_sheet_manager(sheet_manager)

    # Set up the chat log manager for sheet persistence and system file.
    session_id = str(uuid.uuid4())
    chat_mgr = ChatLogManager(sheet_manager, session_id=session_id)
    await chat_mgr.seed()
    run_contents: list[dict] = [objective]
    file_system.add_system_file(
        CHAT_LOG_PATH, lambda: chat_mgr.get_chat_log(run_contents),
    )

    function_groups = _build_function_groups(
        controller=controller,
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        backend=backend,
        flags=resolved_flags,
        sheet_manager=sheet_manager,
        on_chat_entry=chat_mgr.on_chat_entry,
        graph_url=graph.get("url", ""),
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
        backend=backend,
        store=store,
        flags=resolved_flags,
        graph=graph,
        session_id=session_id,
    ):
        yield event


async def resume(
    *,
    interaction_id: str,
    response: dict[str, Any],
    backend: BackendClient,
    store: InteractionStore,
    drive: DriveOperationsClient | None = None,
) -> AsyncIterator[AgentEvent]:
    """Resume a suspended agent run.

    Loads saved state from ``store``, injects the client's response as a
    function result, rebuilds function groups, and continues the loop.

    For precondition suspends (e.g. consent), the response is recorded in
    shared state and the original function call is re-dispatched — the
    precondition passes on the second attempt and the handler runs.

    Flags and graph identity are restored from the saved interaction
    state — callers do not need to re-supply them.

    Args:
        interaction_id: The interaction ID from the suspend event.
        response: The client's response to the suspend prompt.
        backend: Backend client for all API calls.
        store: Interaction store for suspend/resume state.
        drive: Optional Drive/Sheets operations client. Reserved for future use.

    Yields:
        Typed ``AgentEvent`` instances.

    If the interaction ID is not found, yields a single ``ErrorEvent``.
    """
    state = await store.load(interaction_id)
    if state is None:
        yield ErrorEvent(message=f"Unknown interaction ID: {interaction_id}")
        return

    # Restore flags and graph from saved state.
    resolved_flags = state.flags

    # Rebuild SheetManager if memory was active and drive is available.
    sheet_manager: SheetManager | None = None
    if resolved_flags.get("useMemory") and drive:
        graph_url = (state.graph or {}).get("url", "")
        graph_title = (state.graph or {}).get("title", "")
        sheet_manager = SheetManager(
            drive=drive,
            graph_url=graph_url,
            graph_title=graph_title,
        )
        state.file_system.set_sheet_manager(sheet_manager)

    fc = state.function_call_part.get("functionCall", {})
    func_name = fc.get("name", "unknown")

    if state.is_precondition_check:
        # Precondition suspend (e.g. consent). Record the grant in shared
        # state and re-dispatch the same function call.
        contents = await _resume_precondition(
            state=state,
            response=response,
            func_name=func_name,
            fc=fc,
            backend=backend,
            resolved_flags=resolved_flags,
            sheet_manager=sheet_manager,
        )
    else:
        # Normal suspend (chat input, choice, etc.). Inject the client's
        # response as the function result.
        function_response_turn = {
            "parts": [{
                "functionResponse": {
                    "name": func_name,
                    "response": _process_chat_response(func_name, response),
                }
            }],
            "role": "user",
        }
        contents = state.contents + [function_response_turn]

    # Set up the chat log manager for sheet persistence and system file.
    chat_mgr = ChatLogManager(sheet_manager, session_id=state.session_id)
    await chat_mgr.seed()
    if not state.is_precondition_check:
        chat_mgr.persist_user_response(func_name, fc.get("args", {}), response)
    state.file_system.add_system_file(
        CHAT_LOG_PATH, lambda: chat_mgr.get_chat_log(contents),
    )

    controller = LoopController()
    function_groups = _build_function_groups(
        controller=controller,
        file_system=state.file_system,
        task_tree_manager=state.task_tree_manager,
        backend=backend,
        flags=resolved_flags,
        sheet_manager=sheet_manager,
        on_chat_entry=chat_mgr.on_chat_entry,
        consents_granted=state.consents_granted,
        graph_url=(state.graph or {}).get("url", ""),
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
        backend=backend,
        store=store,
        flags=resolved_flags,
        graph=state.graph,
        session_id=state.session_id,
        consents_granted=state.consents_granted,
    ):
        yield event


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _resume_precondition(
    *,
    state: InteractionState,
    response: dict[str, Any],
    func_name: str,
    fc: dict[str, Any],
    backend: BackendClient,
    resolved_flags: dict[str, Any],
    sheet_manager: "SheetManager | None",
) -> list[dict[str, Any]]:
    """Handle resume from a precondition suspend (e.g. consent).

    If the client granted the precondition (e.g. consent), records the grant
    and re-executes the original function call directly. The real handler
    result is injected as the function response — the model never sees the
    consent round-trip.

    If the client denied, injects an error as the function response.
    """
    # Determine consent type from the suspend event stored on the state.
    # Currently, consent is the only precondition type.
    consent_type = getattr(
        state, "_suspend_consent_type", "GET_ANY_WEBPAGE"
    )

    if not response.get("consent"):
        # Denied — inject error as the function response.
        func_response = {"error": "User declined URL access consent"}
    else:
        # Granted — record in shared state and re-execute the handler.
        state.consents_granted.add(consent_type)

        # Rebuild function groups with the updated consent state so
        # the precondition passes on re-dispatch.
        controller = LoopController()
        function_groups = _build_function_groups(
            controller=controller,
            file_system=state.file_system,
            task_tree_manager=state.task_tree_manager,
            backend=backend,
            flags=resolved_flags,
            sheet_manager=sheet_manager,
            consents_granted=state.consents_granted,
            graph_url=(state.graph or {}).get("url", ""),
        )

        # Build definition map from function groups.
        definition_map: dict[str, FunctionDefinition] = {}
        for group in function_groups:
            for name, defn in group.definitions:
                definition_map[name] = defn

        defn = definition_map.get(func_name)
        if not defn:
            func_response = {"error": f"Unknown function: {func_name}"}
        else:
            try:
                def noop_status(
                    _s: str | None, _o: Any = None
                ) -> None:
                    pass

                # Precondition should pass now (consent recorded).
                if defn.precondition:
                    await defn.precondition(fc.get("args", {}))
                func_response = await defn.handler(
                    fc.get("args", {}), noop_status
                )
            except Exception as e:
                func_response = {"error": str(e)}

    function_response_turn = {
        "parts": [{
            "functionResponse": {
                "name": func_name,
                "response": func_response,
            }
        }],
        "role": "user",
    }
    return state.contents + [function_response_turn]


def _process_chat_response(
    func_name: str, response: dict[str, Any]
) -> dict[str, Any]:
    """Process a chat function response before injecting into contents.

    The client sends ``{"input": LLMContent}`` where LLMContent is
    ``{"role": "user", "parts": [{"text": "..."}]}``.

    This mirrors the TS handler logic (chat.ts L121-131):
    1. Extract text from the first text part of the LLMContent.
    2. Check for the skip sentinel (``__skipped__``).
    3. Transform to ``{"user_input": text}`` for the model.

    Non-chat functions pass through unchanged.
    """
    if func_name == "chat_request_user_input":
        llm_content = response.get("input")
        if isinstance(llm_content, dict):
            parts = llm_content.get("parts", [])
            first_text = next(
                (p.get("text", "") for p in parts if "text" in p), ""
            )
            if first_text == SKIPPED_SENTINEL:
                return {"skipped": True}
            return {"user_input": first_text}
    return response

def _build_function_groups(
    *,
    controller: LoopController,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    backend: BackendClient,
    flags: dict[str, Any],
    sheet_manager: SheetManager | None = None,
    on_chat_entry: Any = None,
    consents_granted: set[str] | None = None,
    graph_url: str = "",
) -> list:
    """Build the standard set of function groups."""
    enable_g1_quota = flags.get("googleOne", False)

    groups = [
        get_system_function_group(
            controller,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
        ),
        get_generate_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            graph_url=graph_url,
            consents_granted=consents_granted,
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
            on_chat_entry=on_chat_entry,
        ),
    ]

    if sheet_manager:
        groups.append(
            get_memory_function_group(
                sheet_manager=sheet_manager,
                file_system=file_system,
                task_tree_manager=task_tree_manager,
            )
        )

    return groups


async def _stream_loop(
    *,
    run_args: AgentRunArgs,
    controller: LoopController,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    backend: BackendClient,
    store: InteractionStore,
    flags: dict[str, Any] | None = None,
    graph: dict[str, Any],
    session_id: str = "",
    consents_granted: set[str] | None = None,
) -> AsyncIterator[AgentEvent]:
    """Run the loop and yield events.

    Shared streaming core for both ``run()`` and ``resume()``.
    """
    sink = AgentEventSink()
    run_args.hooks = build_hooks_from_sink(sink)

    loop = Loop(
        backend=backend,
        controller=controller,
    )

    async def execute():
        """Run the loop and emit terminal events."""
        try:
            result = await loop.run(run_args)

            if isinstance(result, SuspendResult):
                await store.save(
                    result.interaction_id,
                    InteractionState(
                        contents=result.contents,
                        function_call_part=result.function_call_part,
                        file_system=file_system,
                        task_tree_manager=task_tree_manager,
                        flags=flags or {},
                        graph=graph,
                        session_id=session_id,
                        is_precondition_check=(
                            result.is_precondition_check
                        ),
                        consents_granted=(
                            consents_granted or set()
                        ),
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
