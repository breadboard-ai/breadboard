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
    parent_ticket_id: str | None = None
    model: str | None = None
    context: str | None = None
    watch_events: list[dict[str, Any]] | None = None
    queued_updates: list[str] | None = None
    kind: TicketKind = "work"
    signal_type: str | None = None
    delivered_to: list[str] | None = None
    tasks: list[str] | None = None
    creator_ticket_id: str | None = None
    slug: str | None = None
    pending_context_updates: list[dict[str, Any]] | None = None

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
            parent_ticket_id=data.get("parent_ticket_id") or data.get("parent_run_id"),
            model=data.get("model"),
            context=data.get("context"),
            watch_events=data.get("watch_events"),
            queued_updates=data.get("queued_updates"),
            kind=data.get("kind", "work"),
            signal_type=data.get("signal_type"),
            delivered_to=data.get("delivered_to"),
            tasks=data.get("tasks"),
            creator_ticket_id=data.get("creator_ticket_id"),
            slug=data.get("slug"),
            pending_context_updates=data.get("pending_context_updates"),
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

        If ``parent_ticket_id`` is set, the ticket shares its parent's
        workspace at ``tickets/{parent_ticket_id}/filesystem``.
        Otherwise it uses its own directory.
        """
        parent = self.metadata.parent_ticket_id
        
        if parent:
            base = self.dir.parent / parent / "filesystem"
        else:
            base = self.dir / "filesystem"
            
        return base

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

class TaskStore:
    """Encapsulates task CRUD operations."""

    def __init__(self, hive_dir: Path):
        self.hive_dir = hive_dir
        self.tickets_dir = hive_dir / "tickets"

    def get(self, ticket_id: str) -> Ticket | None:
        """Load a specific task."""
        ticket_dir = self.tickets_dir / ticket_id
        if not ticket_dir.exists():
            return None
        objective_path = ticket_dir / "objective.md"
        metadata_path = ticket_dir / "metadata.json"
        if not objective_path.exists() or not metadata_path.exists():
            return None
        return Ticket(
            id=ticket_id,
            objective=objective_path.read_text(),
            dir=ticket_dir,
            metadata=TicketMetadata.from_dict(
                json.loads(metadata_path.read_text())
            ),
        )

    def query_all(self, status: TicketStatus | None = None) -> list[Ticket]:
        """List tasks, optionally filtered by status."""
        if not self.tickets_dir.exists():
            return []
        tickets: list[Ticket] = []
        for ticket_dir in sorted(self.tickets_dir.iterdir()):
            if not ticket_dir.is_dir():
                continue
            ticket = self.get(ticket_dir.name)
            if ticket is None:
                continue
            if status is not None and ticket.metadata.status != status:
                continue
            tickets.append(ticket)
        tickets.sort(key=lambda t: t.metadata.created_at or "", reverse=True)
        return tickets

    def save(self, ticket: Ticket) -> None:
        """Persist ticket to disk."""
        ticket_dir = self.tickets_dir / ticket.id
        ticket_dir.mkdir(parents=True, exist_ok=True)
        (ticket_dir / "objective.md").write_text(ticket.objective)
        (ticket_dir / "metadata.json").write_text(
            json.dumps(ticket.metadata.to_dict(), indent=2, ensure_ascii=False)
            + "\n"
        )

    def save_metadata(self, ticket: Ticket) -> None:
        """Persist only the metadata."""
        ticket_dir = self.tickets_dir / ticket.id
        (ticket_dir / "metadata.json").write_text(
            json.dumps(ticket.metadata.to_dict(), indent=2, ensure_ascii=False)
            + "\n"
        )

    def respond(self, ticket_id: str, response: dict[str, Any]) -> Ticket:
        """Save user response to a suspended ticket."""
        ticket = self.get(ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")
        
        ticket_dir = self.tickets_dir / ticket_id
        response_path = ticket_dir / "response.json"
        response_path.write_text(
            json.dumps(response, indent=2, ensure_ascii=False) + "\n"
        )
        
        ticket.metadata.assignee = "agent"
        self.save_metadata(ticket)
        return ticket

    def create(
        self,
        objective: str,
        *,
        tags: list[str] | None = None,
        functions: list[str] | None = None,
        skills: list[str] | None = None,
        tasks: list[str] | None = None,
        title: str | None = None,
        assignee: str | None = None,
        playbook_id: str | None = None,
        playbook_run_id: str | None = None,
        parent_ticket_id: str | None = None,
        model: str | None = None,
        context: str | None = None,
        watch_events: list[dict[str, Any]] | None = None,
        kind: TicketKind = "work",
        signal_type: str | None = None,
        slug: str | None = None,
    ) -> Ticket:
        """Create a new task.

        Scans the objective for ``{{id}}`` references. If any are found,
        the ticket is created with status ``blocked`` and a ``depends_on``
        list of the referenced ticket IDs (resolved by prefix match).
        """
        deps = [d for d in _DEP_PATTERN.findall(objective) if "." not in d]
        resolved_deps: list[str] | None = None
        status: TicketStatus = "available"
        if deps:
            all_tickets = self.query_all()
            resolved_deps = []
            for dep_ref in deps:
                match = _resolve_ticket_id(dep_ref, all_tickets)
                if match:
                    resolved_deps.append(match)
                else:
                    print(
                        f"Warning: no ticket matching '{dep_ref}'",
                        file=__import__("sys").stderr,
                    )
                    resolved_deps.append(dep_ref)
            status = "blocked"

        ticket_id = str(uuid.uuid4())
        ticket = Ticket(
            id=ticket_id,
            objective=objective,
            dir=self.tickets_dir / ticket_id,
            metadata=TicketMetadata(
                status=status,
                created_at=datetime.now(timezone.utc).isoformat(),
                depends_on=resolved_deps,
                tags=tags,
                functions=functions,
                skills=skills,
                tasks=tasks,
                title=title,
                assignee=assignee,
                playbook_id=playbook_id,
                playbook_run_id=playbook_run_id,
                parent_ticket_id=parent_ticket_id,
                model=model,
                context=context,
                watch_events=watch_events,
                kind=kind,
                signal_type=signal_type,
                slug=slug,
            ),
        )
        self.save(ticket)
        return ticket





def _resolve_ticket_id(
    ref: str, tickets: list["Ticket"],
) -> str | None:
    """Resolve a ticket reference (prefix or full UUID) to a ticket ID."""
    for ticket in tickets:
        if ticket.id == ref or ticket.id.startswith(ref):
            return ticket.id
    return None



