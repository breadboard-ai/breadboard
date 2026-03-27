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
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

TICKETS_DIR = Path(__file__).resolve().parent.parent / "tickets"

TicketStatus = Literal[
    "available", "blocked", "running", "suspended", "completed", "failed"
]

# Matches {{ticket-id-prefix}} references in objectives.
_DEP_PATTERN = re.compile(r"\{\{([^}]+)\}\}")


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
    model: str | None = None

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
            model=data.get("model"),
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


def create_ticket(
    objective: str,
    *,
    tags: list[str] | None = None,
    functions: list[str] | None = None,
    skills: list[str] | None = None,
    title: str | None = None,
    assignee: str | None = None,
    playbook_id: str | None = None,
    playbook_run_id: str | None = None,
    model: str | None = None,
) -> Ticket:
    """Create a new ticket.

    Scans the objective for ``{{id}}`` references. If any are found,
    the ticket is created with status ``blocked`` and a ``depends_on``
    list of the referenced ticket IDs (resolved by prefix match).
    """
    deps = _DEP_PATTERN.findall(objective)

    # Resolve dependency prefixes to full ticket IDs.
    resolved_deps: list[str] | None = None
    status: TicketStatus = "available"
    if deps:
        all_tickets = list_tickets()
        resolved_deps = []
        for dep_ref in deps:
            match = _resolve_ticket_id(dep_ref, all_tickets)
            if match:
                resolved_deps.append(match)
            else:
                print(
                    f"Warning: no ticket matching '{dep_ref}'",
                    file=__import__('sys').stderr,
                )
                resolved_deps.append(dep_ref)  # Keep raw for error visibility.
        status = "blocked"

    ticket = Ticket(
        id=str(uuid.uuid4()),
        objective=objective,
        metadata=TicketMetadata(
            status=status,
            created_at=datetime.now(timezone.utc).isoformat(),
            depends_on=resolved_deps,
            tags=tags,
            functions=functions,
            skills=skills,
            title=title,
            assignee=assignee,
            playbook_id=playbook_id,
            playbook_run_id=playbook_run_id,
            model=model,
        ),
    )
    ticket.save()
    return ticket


def _resolve_ticket_id(
    ref: str, tickets: list["Ticket"],
) -> str | None:
    """Resolve a ticket reference (prefix or full UUID) to a ticket ID."""
    for ticket in tickets:
        if ticket.id == ref or ticket.id.startswith(ref):
            return ticket.id
    return None


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

    # Sort by created_at latest first
    tickets.sort(key=lambda t: t.metadata.created_at or "", reverse=True)
    return tickets
