# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session API — high-level functions for session-based agent execution.

Wraps the existing ``run()`` async iterator with event teeing to a
``SessionStore`` and live delivery via subscriber queues.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, TYPE_CHECKING

if TYPE_CHECKING:
    from ..function_definition import FunctionGroup

from ..events import (
    AgentEvent,
    CompleteEvent,
    ErrorEvent,
    SUSPEND_TYPES,
)
from ..backend_client import BackendClient
from ..drive_operations_client import DriveOperationsClient
from ..interaction_store import InteractionStore
from ..run import run as run_agent, resume as resume_agent
from .store import SessionStatus, SessionStore

__all__ = [
    "new_session", "start_session", "resume_session",
    "cancel_session_task", "update_context", "Subscribers",
]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Subscriber management — live event delivery to SSE clients
# ---------------------------------------------------------------------------


class Subscribers:
    """Per-session subscriber queues for live event delivery.

    Each SSE connection subscribes to a session. ``start_session()``
    publishes each event to all subscriber queues. When the session
    ends, all queues receive a ``None`` sentinel.
    """

    def __init__(self) -> None:
        self._queues: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Create and register a subscriber queue for a session."""
        queue: asyncio.Queue = asyncio.Queue()
        self._queues.setdefault(session_id, []).append(queue)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue."""
        queues = self._queues.get(session_id, [])
        if queue in queues:
            queues.remove(queue)

    async def publish(
        self, session_id: str, event: dict[str, Any],
    ) -> None:
        """Push an event dict to all subscriber queues."""
        for queue in self._queues.get(session_id, []):
            await queue.put(event)

    async def close(self, session_id: str) -> None:
        """Send sentinel to all subscribers and clean up."""
        for queue in self._queues.get(session_id, []):
            await queue.put(None)
        self._queues.pop(session_id, None)


# ---------------------------------------------------------------------------
# Session context — captured deps for the background task
# ---------------------------------------------------------------------------


@dataclass
class _SessionContext:
    """Deps captured at session creation, consumed by start_session().

    Owns the per-request clients so the background task can outlive
    the HTTP request that created it.
    """

    segments: list[dict[str, Any]]
    backend: BackendClient
    interaction_store: InteractionStore
    flags: dict[str, Any] = field(default_factory=dict)
    graph: dict[str, Any] | None = None
    drive: DriveOperationsClient | None = None
    extra_groups: list["FunctionGroup"] = field(default_factory=list)
    function_filter: list[str] | None = None
    initial_files: dict[str, str] | None = None


# Module-level registries.
_contexts: dict[str, _SessionContext] = {}
_tasks: dict[str, asyncio.Task] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def new_session(
    *,
    session_id: str,
    segments: list[dict[str, Any]],
    store: SessionStore,
    backend: BackendClient,
    interaction_store: InteractionStore,
    flags: dict[str, Any] | None = None,
    graph: dict[str, Any] | None = None,
    drive: DriveOperationsClient | None = None,
    extra_groups: list["FunctionGroup"] | None = None,
    function_filter: list[str] | None = None,
    initial_files: dict[str, str] | None = None,
) -> str:
    """Create a session and stash its context for start_session().

    Does NOT start the loop — call ``start_session()`` separately
    (typically via ``asyncio.create_task``).

    Args:
        extra_groups: Additional FunctionGroups appended to the
            standard set. Must be re-supplied on resume since they
            contain live handler closures.
        function_filter: Dot-notation patterns selecting which
            functions to include (e.g. ``["system.*"]``). ``None``
            means no filtering.

    Returns the session_id.
    """
    await store.create(session_id)
    _contexts[session_id] = _SessionContext(
        segments=segments,
        backend=backend,
        interaction_store=interaction_store,
        flags=flags or {},
        graph=graph,
        drive=drive,
        extra_groups=extra_groups or [],
        function_filter=function_filter,
        initial_files=initial_files,
    )
    return session_id


def update_context(
    session_id: str,
    *,
    backend: BackendClient | None = None,
    drive: DriveOperationsClient | None = None,
) -> None:
    """Refresh deps on a stashed context (e.g. after token refresh).

    Call before ``resume_session()`` to swap in fresh clients when
    the OAuth token may have expired since the session was created.
    """
    ctx = _contexts.get(session_id)
    if not ctx:
        return
    if backend is not None:
        ctx.backend = backend
    if drive is not None:
        ctx.drive = drive


def register_task(session_id: str, task: asyncio.Task) -> None:
    """Register a background task for a session (for cancellation)."""
    _tasks[session_id] = task


async def cancel_session_task(session_id: str) -> None:
    """Cancel the background task for a session.

    Raises ``CancelledError`` through the entire await chain, including
    any in-flight Gemini API call. The ``_tee_events`` handler catches
    this and sets CANCELLED status.
    """
    task = _tasks.get(session_id)
    if task and not task.done():
        task.cancel()


async def start_session(
    *,
    session_id: str,
    store: SessionStore,
    subscribers: Subscribers,
) -> None:
    """Run the agent loop for a session, teeing events to store + subscribers.

    Consumes the context stashed by ``new_session()``. Runs to
    completion (or failure/suspend), setting terminal status.
    """
    ctx = _contexts.pop(session_id, None)
    if not ctx:
        logger.error("No context for session %s", session_id)
        await store.set_status(session_id, SessionStatus.FAILED)
        return

    await _tee_events(
        session_id=session_id,
        events=run_agent(
            segments=ctx.segments,
            backend=ctx.backend,
            store=ctx.interaction_store,
            flags=ctx.flags,
            graph=ctx.graph or {},
            drive=ctx.drive,
            extra_groups=ctx.extra_groups or None,
            function_filter=ctx.function_filter,
            initial_files=ctx.initial_files,
        ),
        store=store,
        subscribers=subscribers,
        ctx=ctx,
    )


async def resume_session(
    *,
    session_id: str,
    response: dict[str, Any],
    store: SessionStore,
    subscribers: Subscribers,
) -> None:
    """Resume a suspended session.

    Loads the stashed interaction_id, calls ``resume()`` from run.py,
    and tees events to store + subscribers (same as start_session).
    """
    ctx = _contexts.pop(session_id, None)
    if not ctx:
        logger.error("No context for session %s", session_id)
        await store.set_status(session_id, SessionStatus.FAILED)
        return

    interaction_id = await store.get_resume_id(session_id)
    if not interaction_id:
        logger.error("No resume_id for session %s", session_id)
        await store.set_status(session_id, SessionStatus.FAILED)
        return

    await _tee_events(
        session_id=session_id,
        events=resume_agent(
            interaction_id=interaction_id,
            response=response,
            backend=ctx.backend,
            store=ctx.interaction_store,
            drive=ctx.drive,
            extra_groups=ctx.extra_groups or None,
        ),
        store=store,
        subscribers=subscribers,
        ctx=ctx,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _tee_events(
    *,
    session_id: str,
    events: AsyncIterator[AgentEvent],
    store: SessionStore,
    subscribers: Subscribers,
    ctx: _SessionContext,
) -> None:
    """Shared event-tee loop for start_session and resume_session.

    Iterates the event stream, pushes each event to the store and
    subscribers, detects terminal/suspend events, and sets final status.
    On suspend, re-stashes the context and the interaction_id so the
    next resume_session call can pick them up.
    """
    terminal_status = SessionStatus.COMPLETED

    try:
        async for event in events:
            event_dict = event.to_dict()
            await store.append_event(session_id, event_dict)
            await subscribers.publish(session_id, event_dict)

            # Detect terminal events to set the right status.
            if isinstance(event, CompleteEvent):
                success = event.result.success if event.result else False
                terminal_status = (
                    SessionStatus.COMPLETED if success
                    else SessionStatus.FAILED
                )
            elif _is_suspend_event(event):
                terminal_status = SessionStatus.SUSPENDED
                # Stash interaction_id for resume, and re-stash
                # context so resume_session can reuse the deps.
                iid = getattr(event, "interaction_id", None)
                if iid:
                    await store.set_resume_id(session_id, iid)
                _contexts[session_id] = ctx

    except asyncio.CancelledError:
        terminal_status = SessionStatus.CANCELLED

    except Exception as e:
        logger.exception("Session %s failed", session_id)
        await store.append_event(session_id, {"error": {"message": str(e)}})
        await subscribers.publish(session_id, {"error": {"message": str(e)}})
        terminal_status = SessionStatus.FAILED

    finally:
        await store.set_status(session_id, terminal_status)
        await subscribers.close(session_id)
        _tasks.pop(session_id, None)


def _is_suspend_event(event: AgentEvent) -> bool:
    """Check if an event is a suspend event by its type attribute."""
    return getattr(event, "type", "") in SUSPEND_TYPES
