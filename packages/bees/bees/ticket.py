# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Ticket data model and persistence.

A ticket is a directory under ``tickets/{uuid}/`` containing:
- ``objective.md`` — the prompt text
- ``metadata.json`` — status, dates, metrics, error/outcome
"""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

TICKETS_DIR = Path(__file__).resolve().parent.parent / "tickets"

TicketStatus = Literal["available", "running", "suspended", "completed", "failed"]


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
    files: list[dict[str, str]] | None = None
    assignee: Literal["user", "agent"] | None = None
    suspend_event: dict[str, Any] | None = None

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
        )


@dataclass
class Ticket:
    """A ticket backed by a directory on disk."""

    id: str
    objective: str
    metadata: TicketMetadata = field(default_factory=TicketMetadata)

    @property
    def dir(self) -> Path:
        return TICKETS_DIR / self.id

    @property
    def objective_path(self) -> Path:
        return self.dir / "objective.md"

    @property
    def metadata_path(self) -> Path:
        return self.dir / "metadata.json"

    def save(self) -> None:
        """Persist ticket to disk."""
        self.dir.mkdir(parents=True, exist_ok=True)
        self.objective_path.write_text(self.objective)
        self.metadata_path.write_text(
            json.dumps(self.metadata.to_dict(), indent=2, ensure_ascii=False)
            + "\n"
        )

    def save_metadata(self) -> None:
        """Persist only the metadata (for status updates)."""
        self.metadata_path.write_text(
            json.dumps(self.metadata.to_dict(), indent=2, ensure_ascii=False)
            + "\n"
        )


def create_ticket(objective: str) -> Ticket:
    """Create a new ticket with status 'available'."""
    ticket = Ticket(
        id=str(uuid.uuid4()),
        objective=objective,
        metadata=TicketMetadata(
            status="available",
            created_at=datetime.now(timezone.utc).isoformat(),
        ),
    )
    ticket.save()
    return ticket


def load_ticket(ticket_id: str) -> Ticket | None:
    """Load a ticket from disk by ID."""
    ticket_dir = TICKETS_DIR / ticket_id
    objective_path = ticket_dir / "objective.md"
    metadata_path = ticket_dir / "metadata.json"

    if not objective_path.exists() or not metadata_path.exists():
        return None

    return Ticket(
        id=ticket_id,
        objective=objective_path.read_text(),
        metadata=TicketMetadata.from_dict(
            json.loads(metadata_path.read_text())
        ),
    )


def list_tickets(*, status: TicketStatus | None = None) -> list[Ticket]:
    """List all tickets, optionally filtered by status."""
    if not TICKETS_DIR.exists():
        return []

    tickets: list[Ticket] = []
    for ticket_dir in sorted(TICKETS_DIR.iterdir()):
        if not ticket_dir.is_dir():
            continue
        ticket = load_ticket(ticket_dir.name)
        if ticket is None:
            continue
        if status is not None and ticket.metadata.status != status:
            continue
        tickets.append(ticket)

    return tickets
