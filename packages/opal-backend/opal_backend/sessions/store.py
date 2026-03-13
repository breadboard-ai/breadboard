# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session store — protocol for session lifecycle management.

Defines the ``SessionStatus`` enum and ``SessionStore`` protocol for
managing agent sessions. See ``SESSION_PROTOCOL.md`` for the full
specification.

Implementations:
- ``InMemorySessionStore`` (``sessions/in_memory_store.py``)
  — dict-backed, suitable for local dev and tests.
- Production uses a persistent store.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Protocol, runtime_checkable

from ..interaction_store import InteractionState

__all__ = ["SessionStatus", "SessionStore"]


class SessionStatus(StrEnum):
    """Status of a session in the lifecycle state machine."""

    RUNNING = "running"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@runtime_checkable
class SessionStore(Protocol):
    """Manages the lifecycle of a session.

    A session tracks status, an append-only event log, and interaction
    snapshots for suspend/resume. See ``SESSION_PROTOCOL.md``.
    """

    # ── Lifecycle ──

    async def create(self, session_id: str) -> None:
        """Create a new session. Initial status: RUNNING."""
        ...

    async def get_status(self, session_id: str) -> SessionStatus | None:
        """Return current status, or None if not found."""
        ...

    async def set_status(
        self, session_id: str, status: SessionStatus
    ) -> None:
        """Transition to a new status."""
        ...

    # ── Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any]
    ) -> int:
        """Append an event. Returns the new event's index."""
        ...

    async def get_events(
        self, session_id: str, *, after: int = -1
    ) -> list[dict[str, Any]]:
        """Return events with index > after. after=-1 returns all."""
        ...

    # ── Interaction State (suspend/resume) ──

    async def save_interaction(
        self, session_id: str, state: InteractionState
    ) -> None:
        """Save interaction snapshot on suspend. Overwrites any prior."""
        ...

    async def load_interaction(
        self, session_id: str,
    ) -> InteractionState | None:
        """Load and clear the interaction snapshot. Single-use."""
        ...
