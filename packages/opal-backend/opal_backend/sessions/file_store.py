# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""File-backed implementation of ``SessionStore`` and ``InteractionStore``.

Suitable for local dev, local orchestration (bees), and visual exploration.
Conforms strictly to both protocols while offering durable preservation
for offline debugging and inspection.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ..interaction_store import InteractionState
from .store import SessionStatus

__all__ = ["FileBasedSessionStore"]

logger = logging.getLogger(__name__)


class FileBasedSessionStore:
    """File-backed session and interaction store.

    Stores session artifacts under a base directory:
    - ``{base_dir}/{session_id}/status``
    - ``{base_dir}/{session_id}/events.jsonl``
    - ``{base_dir}/{session_id}/interaction.json``
    - ``{base_dir}/{session_id}/resume_id``
    """

    def __init__(self, base_dir: Path | str) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        # In-memory cache of event counts to avoid parsing events.jsonl on every append.
        self._event_counts: dict[str, int] = {}

    def _session_dir(self, session_id: str) -> Path:
        """Return the directory path for a session ID."""
        return self.base_dir / session_id

    def _get_event_count(self, session_id: str) -> int:
        """Initialize or retrieve the cached event count for a session."""
        if session_id not in self._event_counts:
            events_file = self._session_dir(session_id) / "events.jsonl"
            if events_file.exists():
                try:
                    with open(events_file, "rb") as f:
                        self._event_counts[session_id] = sum(1 for _ in f)
                except Exception:
                    self._event_counts[session_id] = 0
            else:
                self._event_counts[session_id] = 0
        return self._event_counts[session_id]

    # ── SessionStore Lifecycle ──

    async def create(self, session_id: str) -> None:
        """Create a new session. Initial status: RUNNING."""
        sdir = self._session_dir(session_id)
        sdir.mkdir(parents=True, exist_ok=True)
        await self.set_status(session_id, SessionStatus.RUNNING)
        events_file = sdir / "events.jsonl"
        if not events_file.exists():
            events_file.touch(exist_ok=True)

    async def get_status(self, session_id: str) -> SessionStatus | None:
        """Return current status, or None if not found."""
        status_file = self._session_dir(session_id) / "status"
        if not status_file.exists():
            return None
        try:
            val = status_file.read_text(encoding="utf-8").strip()
            return SessionStatus(val)
        except Exception:
            return None

    async def set_status(
        self, session_id: str, status: SessionStatus
    ) -> None:
        """Transition to a new status."""
        sdir = self._session_dir(session_id)
        sdir.mkdir(parents=True, exist_ok=True)
        status_file = sdir / "status"
        status_file.write_text(status.value, encoding="utf-8")

    # ── SessionStore Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any]
    ) -> int:
        """Append an event. Returns the new event's index."""
        sdir = self._session_dir(session_id)
        if not sdir.is_dir():
            raise KeyError(f"Session not found: {session_id}")
        index = self._get_event_count(session_id)
        events_file = sdir / "events.jsonl"
        with open(events_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
        self._event_counts[session_id] = index + 1
        return index

    async def get_events(
        self, session_id: str, *, after: int = -1
    ) -> list[dict[str, Any]]:
        """Return events with index > after. after=-1 returns all."""
        events_file = self._session_dir(session_id) / "events.jsonl"
        if not events_file.exists():
            return []
        result: list[dict[str, Any]] = []
        try:
            with open(events_file, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    if idx > after:
                        result.append(json.loads(line))
        except Exception as e:
            logger.warning("Failed to read events for %s: %s", session_id, e)
        return result

    # ── SessionStore Interaction State (suspend/resume) ──

    async def save_interaction(
        self, session_id: str, state: InteractionState
    ) -> None:
        """Save interaction snapshot on suspend. Overwrites any prior."""
        sdir = self._session_dir(session_id)
        sdir.mkdir(parents=True, exist_ok=True)
        int_file = sdir / "interaction.json"
        int_file.write_text(
            json.dumps(state.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    async def load_interaction(
        self, session_id: str
    ) -> InteractionState | None:
        """Load and clear the interaction snapshot. Single-use."""
        sdir = self._session_dir(session_id)
        resume_id_file = sdir / "resume_id"
        if not resume_id_file.exists():
            return None
        int_file = sdir / "interaction.json"
        if not int_file.exists():
            return None
        try:
            data = json.loads(int_file.read_text(encoding="utf-8"))
            state = InteractionState.from_dict(data)
            # Destructive clear of the resume capability
            resume_id_file.unlink(missing_ok=True)
            return state
        except Exception as e:
            logger.warning("Failed to load interaction for %s: %s", session_id, e)
            return None

    # ── SessionStore Resume ID ──

    async def set_resume_id(
        self, session_id: str, interaction_id: str
    ) -> None:
        """Stash the interaction_id for a pending resume."""
        sdir = self._session_dir(session_id)
        sdir.mkdir(parents=True, exist_ok=True)
        resume_id_file = sdir / "resume_id"
        resume_id_file.write_text(interaction_id, encoding="utf-8")

    async def get_resume_id(self, session_id: str) -> str | None:
        """Retrieve and clear the stashed interaction_id."""
        resume_id_file = self._session_dir(session_id) / "resume_id"
        if not resume_id_file.exists():
            return None
        rid = resume_id_file.read_text(encoding="utf-8").strip()
        resume_id_file.unlink(missing_ok=True)
        return rid

    async def get_session_by_resume_id(
        self, interaction_id: str
    ) -> str | None:
        """Reverse lookup: find the session that owns this interaction_id."""
        if not self.base_dir.is_dir():
            return None
        for sdir in self.base_dir.iterdir():
            if sdir.is_dir():
                resume_id_file = sdir / "resume_id"
                if resume_id_file.exists():
                    try:
                        rid = resume_id_file.read_text(encoding="utf-8").strip()
                        if rid == interaction_id:
                            return sdir.name
                    except Exception:
                        pass
        return None

    # ── InteractionStore Protocol Methods ──

    async def save(self, interaction_id: str, state: InteractionState) -> None:
        """Save interaction state for later resume (InteractionStore protocol)."""
        session_id = state.session_id
        await self.save_interaction(session_id, state)
        await self.set_resume_id(session_id, interaction_id)

    async def load(self, interaction_id: str) -> InteractionState | None:
        """Load and remove interaction state (InteractionStore protocol)."""
        session_id = await self.get_session_by_resume_id(interaction_id)
        if not session_id:
            return None
        # load_interaction already unlinks the resume_id file (the marker)
        return await self.load_interaction(session_id)

    async def has(self, interaction_id: str) -> bool:
        """Check if an interaction is stored."""
        session_id = await self.get_session_by_resume_id(interaction_id)
        return session_id is not None

    async def clear(self) -> None:
        """Remove all stored pending resume IDs."""
        if not self.base_dir.is_dir():
            return
        for sdir in self.base_dir.iterdir():
            if sdir.is_dir():
                (sdir / "resume_id").unlink(missing_ok=True)
