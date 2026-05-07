# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Ticket data model and persistence.

A ticket is a directory under ``{hive}/tickets/{uuid}/`` containing:
- ``objective.md`` — the prompt text
- ``metadata.json`` — status, dates, metrics, error/outcome
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal



TicketStatus = Literal[
    "available", "blocked", "running", "suspended", "paused",
    "completed", "failed", "cancelled"
]

TicketKind = Literal["work", "coordination"]

RunnerType = Literal["generate", "live"]




@dataclass
class TicketMetadata:
    """Metadata for a ticket stored as metadata.json."""

    status: TicketStatus = "available"
    created_at: str = ""
    completed_at: str | None = None
    turns: int = 0
    thoughts: int = 0
    error: str | None = None
    outcome: str | None = None
    outcome_content: dict[str, Any] | None = None
    files: list[dict[str, str]] | None = None
    assignee: Literal["user", "agent"] | None = None
    suspend_event: dict[str, Any] | None = None
    depends_on: list[str] | None = None
    tags: list[str] | None = None
    functions: list[str] | None = None
    skills: list[str] | None = None
    title: str | None = None
    playbook_id: str | None = None
    playbook_run_id: str | None = None
    owning_task_id: str | None = None
    model: str | None = None
    context: str | None = None
    watch_events: list[dict[str, Any]] | None = None
    queued_updates: list[str] | None = None
    kind: TicketKind = "work"
    signal_type: str | None = None
    delivered_to: list[str] | None = None
    tasks: list[str] | None = None
    parent_task_id: str | None = None
    slug: str | None = None
    pending_context_updates: list[dict[str, Any]] | None = None
    paused_from: str | None = None
    """The status this task had before it was paused (set by pause-all / pause-task)."""

    active_session: str | None = None
    """The UUID of the active session for this task."""

    runner: RunnerType = "generate"
    """Which session runner to use: ``generate`` (batch) or ``live`` (Gemini Live API)."""

    voice: str | None = None
    """Prebuilt voice name for Live API audio output (e.g. ``'Kore'``)."""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Omit None fields for cleaner JSON.
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TicketMetadata:
        return cls(
            status=data.get("status", "available"),
            created_at=data.get("created_at", ""),
            completed_at=data.get("completed_at"),
            turns=data.get("turns", 0),
            thoughts=data.get("thoughts", 0),
            error=data.get("error"),
            outcome=data.get("outcome"),
            files=data.get("files"),
            assignee=data.get("assignee"),
            suspend_event=data.get("suspend_event"),
            outcome_content=data.get("outcome_content"),
            depends_on=data.get("depends_on"),
            tags=data.get("tags"),
            functions=data.get("functions"),
            skills=data.get("skills"),
            title=data.get("title"),
            playbook_id=data.get("playbook_id"),
            playbook_run_id=data.get("playbook_run_id"),
            # Fallback to parent_ticket_id or parent_run_id for backward compatibility.
            owning_task_id=data.get("owning_task_id") or data.get("parent_ticket_id") or data.get("parent_run_id"),
            model=data.get("model"),
            context=data.get("context"),
            watch_events=data.get("watch_events"),
            queued_updates=data.get("queued_updates"),
            kind=data.get("kind", "work"),
            signal_type=data.get("signal_type"),
            delivered_to=data.get("delivered_to"),
            tasks=data.get("tasks"),
            # Fallback for legacy creator_ticket_id
            parent_task_id=data.get("parent_task_id") or data.get("creator_ticket_id"),
            slug=data.get("slug"),
            pending_context_updates=data.get("pending_context_updates"),
            paused_from=data.get("paused_from"),
            active_session=data.get("active_session"),
            runner=data.get("runner", "generate"),
            voice=data.get("voice"),
        )


@dataclass
class Ticket:
    """A ticket backed by a directory on disk."""

    id: str
    objective: str
    dir: Path
    metadata: TicketMetadata = field(default_factory=TicketMetadata)

    @property
    def fs_dir(self) -> Path:
        """The working filesystem directory for this ticket.

        If ``owning_task_id`` is set, the ticket shares its parent's
        workspace. Otherwise it uses its own directory.
        """
        parent = self.metadata.owning_task_id
        target_dir = self.dir.parent / parent if parent else self.dir

        # Read metadata.json from target_dir to check active_session
        metadata_file = target_dir / "metadata.json"
        active_session = None
        if metadata_file.is_file():
            try:
                mdata = json.loads(metadata_file.read_text(encoding="utf-8"))
                active_session = mdata.get("active_session")
            except Exception:
                pass

        if active_session:
            return target_dir / "sessions" / active_session / "workspace"

        return target_dir / "filesystem"

    @property
    def objective_path(self) -> Path:
        return self.dir / "objective.md"

    @property
    def metadata_path(self) -> Path:
        return self.dir / "metadata.json"







