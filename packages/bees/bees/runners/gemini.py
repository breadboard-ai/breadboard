# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""GeminiRunner — SessionRunner backed by opal's session API.

Wraps ``new_session`` + ``start_session`` / ``resume_session`` from
``opal_backend.sessions.api`` into the ``SessionRunner`` / ``SessionStream``
protocols defined in ``bees.protocols.session``.

Each ``run()`` / ``resume()`` call creates short-lived opal infrastructure
(stores, subscribers, context queue) and returns a ``GeminiStream`` — an
async iterator over the session's event queue with back-channel methods
for context injection and resume state capture.

This module lives temporarily in ``bees/runners/`` during the migration.
Phase 5 (``bees-gemini-package``) moves it to the ``bees-gemini`` package.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

from opal_backend.local.backend_client_impl import HttpBackendClient
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.interaction_store import InteractionState
from opal_backend.sessions.api import (
    Subscribers,
    new_session,
    register_task,
    resume_session as api_resume_session,
    start_session,
)
from opal_backend.sessions.in_memory_store import InMemorySessionStore

from bees.protocols.session import (
    SUSPEND_TYPES,
    SessionConfiguration,
    SessionEvent,
)

__all__ = ["GeminiRunner", "GeminiStream"]


# ---------------------------------------------------------------------------
# GeminiStream — SessionStream wrapping opal's queue-based event delivery
# ---------------------------------------------------------------------------


class GeminiStream:
    """Async iterator over opal's subscriber queue.

    Created by :meth:`GeminiRunner.run` and :meth:`GeminiRunner.resume`.
    Drains the opal subscriber queue as ``SessionEvent`` dicts.  Captures
    opaque resume state eagerly when the stream exhausts.

    Back-channel methods:

    - :meth:`send_context` — push context parts into the running session.
    - :meth:`send_tool_response` — no-op for the batch API (tools are
      dispatched internally by the opal session loop).
    - :meth:`resume_state` — opaque blob for session resumption.
    """

    def __init__(
        self,
        *,
        queue: asyncio.Queue[SessionEvent | None],
        task: asyncio.Task[None],
        context_queue: asyncio.Queue[list[dict[str, Any]]],
        session_id: str,
        session_store: InMemorySessionStore,
        interaction_store: InMemoryInteractionStore,
    ) -> None:
        self._queue = queue
        self._task = task
        self._context_queue = context_queue
        self._session_id = session_id
        self._session_store = session_store
        self._interaction_store = interaction_store

        self._resume_blob: bytes | None = None
        self._exhausted = False
        self._suspend_event: dict[str, Any] | None = None

    # -- async iterator ----------------------------------------------------

    def __aiter__(self) -> AsyncIterator[SessionEvent]:
        return self

    async def __anext__(self) -> SessionEvent:
        if self._exhausted:
            raise StopAsyncIteration

        event = await self._queue.get()

        if event is None:
            self._exhausted = True
            await self._task
            await self._capture_resume_state()
            raise StopAsyncIteration

        # Track suspend/pause events — needed for resume state capture.
        if "paused" in event:
            self._suspend_event = event
        else:
            for suspend_type in SUSPEND_TYPES:
                if suspend_type in event:
                    self._suspend_event = event
                    break

        return event

    # -- back-channel methods ----------------------------------------------

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """No-op — the batch API dispatches tools internally."""

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """Push context parts into the running session's queue."""
        self._context_queue.put_nowait(parts)

    def resume_state(self) -> bytes | None:
        """Opaque blob for session resumption.

        Returns ``None`` if the run completed normally (no suspend/pause).
        Available only after the stream exhausts.
        """
        return self._resume_blob

    # -- internal ----------------------------------------------------------

    async def _capture_resume_state(self) -> None:
        """Extract resume state from opal stores after the stream exhausts.

        Mirrors the logic from ``session.py._save_session_state``: find
        the interaction_id (from the suspend event or session store), load
        the ``InteractionState``, and serialize to a JSON blob.

        The blob also includes ``function_name`` extracted from the
        ``InteractionState.function_call_part`` — this lets the consumer
        annotate suspend events without interpreting the interaction state.
        """
        if self._suspend_event is None:
            return  # Completed normally — no resume needed.

        # Extract interaction_id from the suspend/pause event.
        interaction_id: str | None = None

        if "paused" in self._suspend_event:
            interaction_id = (
                self._suspend_event["paused"].get("interactionId")
            )
        else:
            for suspend_type in SUSPEND_TYPES:
                if suspend_type in self._suspend_event:
                    interaction_id = (
                        self._suspend_event[suspend_type]
                        .get("interactionId")
                    )
                    break

        if not interaction_id:
            # Fallback: read from session store.
            interaction_id = await self._session_store.get_resume_id(
                self._session_id,
            )

        if not interaction_id:
            return

        # Load interaction state saved by the opal session loop.
        state = await self._interaction_store.load(interaction_id)
        if state is None:
            return

        # Serialize to JSON blob with convenience fields.
        state_dict = state.to_dict()
        function_name: str | None = None
        fcp = state_dict.get("function_call_part", {})
        if fcp:
            function_name = fcp.get("functionCall", {}).get("name")

        blob: dict[str, Any] = {
            "session_id": self._session_id,
            "interaction_id": interaction_id,
            "interaction_state": state_dict,
        }
        if function_name:
            blob["function_name"] = function_name

        self._resume_blob = json.dumps(
            blob, ensure_ascii=False,
        ).encode("utf-8")


# ---------------------------------------------------------------------------
# GeminiRunner — SessionRunner backed by opal's session API
# ---------------------------------------------------------------------------


class GeminiRunner:
    """Concrete ``SessionRunner`` wrapping opal's session API.

    Each :meth:`run` / :meth:`resume` call creates short-lived opal
    infrastructure (``InMemorySessionStore``, ``InMemoryInteractionStore``,
    ``Subscribers``, context queue) and returns a :class:`GeminiStream`.

    The runner holds only the ``HttpBackendClient`` — shared across sessions.
    """

    def __init__(self, backend: HttpBackendClient) -> None:
        self._backend = backend

    async def run(
        self,
        config: SessionConfiguration,
    ) -> GeminiStream:
        """Start a new session and return an event stream.

        1. Create per-session stores, subscribers, and context queue.
        2. Call ``new_session()`` with the provisioned configuration.
        3. Subscribe to the event queue.
        4. Start ``start_session()`` as a background task.
        5. Return a ``GeminiStream`` wrapping the queue.
        """
        session_store = InMemorySessionStore()
        interaction_store = InMemoryInteractionStore()
        subscribers = Subscribers()
        context_queue: asyncio.Queue[list[dict[str, Any]]] = asyncio.Queue()

        session_id = str(uuid.uuid4())

        await new_session(
            session_id=session_id,
            segments=config.segments,
            store=session_store,
            backend=self._backend,
            interaction_store=interaction_store,
            flags={},
            graph={},
            extra_groups=config.function_groups,
            function_filter=config.function_filter,
            model=config.model,
            file_system=config.file_system,
            context_queue=context_queue,
        )

        queue = subscribers.subscribe(session_id)

        task = asyncio.create_task(
            start_session(
                session_id=session_id,
                store=session_store,
                subscribers=subscribers,
            )
        )
        register_task(session_id, task)

        return GeminiStream(
            queue=queue,
            task=task,
            context_queue=context_queue,
            session_id=session_id,
            session_store=session_store,
            interaction_store=interaction_store,
        )

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> GeminiStream:
        """Resume a suspended session.

        1. Deserialize the opaque resume state blob.
        2. Create per-session stores, subscribers, and context queue.
        3. Call ``new_session()`` and restore the suspended state.
        4. Start ``api_resume_session()`` as a background task.
        5. Return a ``GeminiStream`` wrapping the queue.
        """
        # Deserialize the runner's own resume blob.
        state_data = json.loads(state.decode("utf-8"))
        session_id: str = state_data["session_id"]
        interaction_id: str = state_data["interaction_id"]
        interaction_state = InteractionState.from_dict(
            state_data["interaction_state"],
        )

        session_store = InMemorySessionStore()
        interaction_store = InMemoryInteractionStore()
        subscribers = Subscribers()
        context_queue: asyncio.Queue[list[dict[str, Any]]] = asyncio.Queue()

        await new_session(
            session_id=session_id,
            segments=config.segments,
            store=session_store,
            backend=self._backend,
            interaction_store=interaction_store,
            flags={},
            graph={},
            extra_groups=config.function_groups,
            function_filter=config.function_filter,
            file_system=config.file_system,
            context_queue=context_queue,
        )

        # Restore the suspended state in opal's stores.
        await session_store.set_status(session_id, "suspended")
        await session_store.set_resume_id(session_id, interaction_id)
        await interaction_store.save(interaction_id, interaction_state)

        queue = subscribers.subscribe(session_id)

        task = asyncio.create_task(
            api_resume_session(
                session_id=session_id,
                response=response,
                store=session_store,
                subscribers=subscribers,
                context_parts=context_parts,
            )
        )
        register_task(session_id, task)

        return GeminiStream(
            queue=queue,
            task=task,
            context_queue=context_queue,
            session_id=session_id,
            session_store=session_store,
            interaction_store=interaction_store,
        )
