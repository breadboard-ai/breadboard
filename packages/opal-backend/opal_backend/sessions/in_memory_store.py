# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
In-memory implementation of ``SessionStore``.

Suitable for local dev and tests. Production uses a persistent store
that implements the same protocol.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..interaction_store import InteractionState
from .store import SessionStatus, SessionStore

__all__ = ["InMemorySessionStore"]


@dataclass
class _Session:
    """Internal state for a single session."""

    status: SessionStatus = SessionStatus.RUNNING
    events: list[dict[str, Any]] = field(default_factory=list)
    interaction: InteractionState | None = None
    resume_id: str | None = None


class InMemorySessionStore:
    """Dict-backed session store.

    Thread-safe for asyncio (single-threaded event loop).
    """

    def __init__(self) -> None:
        self._sessions: dict[str, _Session] = {}

    async def create(self, session_id: str) -> None:
        """Create a new session. Initial status: RUNNING."""
        self._sessions[session_id] = _Session()

    async def get_status(self, session_id: str) -> SessionStatus | None:
        """Return current status, or None if not found."""
        session = self._sessions.get(session_id)
        return session.status if session else None

    async def set_status(
        self, session_id: str, status: SessionStatus
    ) -> None:
        """Transition to a new status."""
        session = self._sessions.get(session_id)
        if session:
            session.status = status

    async def append_event(
        self, session_id: str, event: dict[str, Any]
    ) -> int:
        """Append an event. Returns the new event's index."""
        session = self._sessions.get(session_id)
        if not session:
            raise KeyError(f"Session not found: {session_id}")
        index = len(session.events)
        session.events.append(event)
        return index

    async def get_events(
        self, session_id: str, *, after: int = -1
    ) -> list[dict[str, Any]]:
        """Return events with index > after. after=-1 returns all."""
        session = self._sessions.get(session_id)
        if not session:
            return []
        return session.events[after + 1 :]

    async def save_interaction(
        self, session_id: str, state: InteractionState
    ) -> None:
        """Save interaction snapshot on suspend. Overwrites any prior."""
        session = self._sessions.get(session_id)
        if session:
            session.interaction = state

    async def load_interaction(
        self, session_id: str,
    ) -> InteractionState | None:
        """Load and clear the interaction snapshot. Single-use."""
        session = self._sessions.get(session_id)
        if not session:
            return None
        state = session.interaction
        session.interaction = None
        return state

    async def set_resume_id(
        self, session_id: str, interaction_id: str,
    ) -> None:
        """Stash the interaction_id for a pending resume."""
        session = self._sessions.get(session_id)
        if session:
            session.resume_id = interaction_id

    async def get_resume_id(self, session_id: str) -> str | None:
        """Retrieve and clear the stashed interaction_id."""
        session = self._sessions.get(session_id)
        if not session:
            return None
        rid = session.resume_id
        session.resume_id = None
        return rid

    async def get_session_by_resume_id(
        self, interaction_id: str,
    ) -> str | None:
        """Reverse lookup: find the session that owns this interaction_id."""
        for sid, session in self._sessions.items():
            if session.resume_id == interaction_id:
                return sid
        return None
