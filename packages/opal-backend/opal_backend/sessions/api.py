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
from typing import Any, AsyncIterator

from ..events import (
    AgentEvent,
    CompleteEvent,
    ErrorEvent,
    SUSPEND_TYPES,
)
from ..backend_client import BackendClient
from ..drive_operations_client import DriveOperationsClient
from ..interaction_store import InteractionStore
from ..run import run as run_agent
from .store import SessionStatus, SessionStore

__all__ = ["new_session", "start_session", "Subscribers"]

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


# Module-level context registry — background tasks look up their context here.
_contexts: dict[str, _SessionContext] = {}


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
) -> str:
    """Create a session and stash its context for start_session().

    Does NOT start the loop — call ``start_session()`` separately
    (typically via ``asyncio.create_task``).

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
    )
    return session_id


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

    terminal_status = SessionStatus.COMPLETED

    try:
        async for event in run_agent(
            segments=ctx.segments,
            backend=ctx.backend,
            store=ctx.interaction_store,
            flags=ctx.flags,
            graph=ctx.graph or {},
            drive=ctx.drive,
        ):
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

    except Exception as e:
        logger.exception("Session %s failed", session_id)
        # Store the error as an event so clients can see it.
        await store.append_event(session_id, {"error": {"message": str(e)}})
        await subscribers.publish(session_id, {"error": {"message": str(e)}})
        terminal_status = SessionStatus.FAILED

    finally:
        await store.set_status(session_id, terminal_status)
        await subscribers.close(session_id)


def _is_suspend_event(event: AgentEvent) -> bool:
    """Check if an event is a suspend event by its type attribute."""
    return getattr(event, "type", "") in SUSPEND_TYPES
