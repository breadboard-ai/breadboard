# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""File-backed ticket store.

Each ticket persists as:
    workspaces/{ticket_id}/ticket.json   — core data (status, events, body)
    workspaces/{ticket_id}/attachments/  — generated files, compiled CJS, etc.

On every mutation the ticket.json is flushed to disk. On startup, all
tickets are loaded from the workspace directory.
"""

from __future__ import annotations

import json
import logging
import shutil
import time
from collections.abc import Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

__all__ = ["TicketStore", "Ticket", "Status"]

logger = logging.getLogger(__name__)


class Status(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    RESOLVED = "resolved"
    DENIED = "denied"
    SUPERSEDED = "superseded"


@dataclass
class Event:
    """Append-only event in a ticket's history."""
    timestamp: float
    action: str
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"timestamp": self.timestamp, "action": self.action, "detail": self.detail}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Event:
        return cls(timestamp=d["timestamp"], action=d["action"], detail=d.get("detail", ""))


@dataclass
class Ticket:
    """A persistent record with body, metadata, status, and history."""
    id: int
    type: str
    body: str
    status: Status = Status.OPEN
    parent_id: int | None = None
    assigned_to: str = ""
    priority: str = "medium"
    metadata: dict[str, str] = field(default_factory=dict)
    resolution: str = ""
    events: list[Event] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "body": self.body,
            "status": self.status.value,
            "parent_id": self.parent_id,
            "assigned_to": self.assigned_to,
            "priority": self.priority,
            "metadata": self.metadata,
            "resolution": self.resolution,
            "events": [e.to_dict() for e in self.events],
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Ticket:
        return cls(
            id=d["id"],
            type=d["type"],
            body=d["body"],
            status=Status(d["status"]),
            parent_id=d.get("parent_id"),
            assigned_to=d.get("assigned_to", ""),
            priority=d.get("priority", "medium"),
            metadata=d.get("metadata", {}),
            resolution=d.get("resolution", ""),
            events=[Event.from_dict(e) for e in d.get("events", [])],
            created_at=d.get("created_at", time.time()),
        )

    def add_event(self, action: str, detail: str = "") -> None:
        self.events.append(Event(timestamp=time.time(), action=action, detail=detail))


# Type alias for lifecycle hooks: async fn(ticket, store) -> None
LifecycleHook = Callable[["Ticket", "TicketStore"], Awaitable[None]]


class TicketStore:
    """File-backed ticket store with lifecycle hooks.

    Ticket data lives on disk as JSON. Attachments (generated files,
    compiled bundles) go in a separate directory per ticket.

    Lifecycle hooks fire when a ticket transitions to a specific status.
    Keyed by (ticket_type, status) pairs.
    """

    def __init__(self, workspace_root: Path | None = None) -> None:
        self._tickets: dict[int, Ticket] = {}
        self._next_id = 1
        self._hooks: dict[tuple[str, Status], list[LifecycleHook]] = {}
        self._subscribers: list[Callable[[Ticket, str], Any]] = []
        self.workspace_root = workspace_root or Path("/tmp/ticket-workspaces")
        self.workspace_root.mkdir(parents=True, exist_ok=True)

        # Load existing tickets from disk.
        self._load_all()

    # ─── Persistence ─────────────────────────────────────────────────────

    def _ticket_dir(self, ticket_id: int) -> Path:
        return self.workspace_root / str(ticket_id)

    def _ticket_file(self, ticket_id: int) -> Path:
        return self._ticket_dir(ticket_id) / "ticket.json"

    def _attachments_dir(self, ticket_id: int) -> Path:
        return self._ticket_dir(ticket_id) / "attachments"

    def _flush(self, ticket: Ticket) -> None:
        """Write ticket data to disk."""
        d = self._ticket_dir(ticket.id)
        d.mkdir(parents=True, exist_ok=True)
        self._attachments_dir(ticket.id).mkdir(parents=True, exist_ok=True)
        self._ticket_file(ticket.id).write_text(
            json.dumps(ticket.to_dict(), indent=2)
        )

    def _load_all(self) -> None:
        """Load all tickets from the workspace directory."""
        for d in sorted(self.workspace_root.iterdir()):
            ticket_file = d / "ticket.json"
            if ticket_file.is_file():
                try:
                    data = json.loads(ticket_file.read_text())
                    ticket = Ticket.from_dict(data)
                    self._tickets[ticket.id] = ticket
                    if ticket.id >= self._next_id:
                        self._next_id = ticket.id + 1
                    logger.info("Loaded ticket #%d (%s) from disk", ticket.id, ticket.type)
                except Exception:
                    logger.exception("Failed to load ticket from %s", ticket_file)

    def reset(self) -> None:
        """Clear all tickets and remove workspace data."""
        self._tickets.clear()
        self._next_id = 1
        if self.workspace_root.exists():
            shutil.rmtree(self.workspace_root)
        self.workspace_root.mkdir(parents=True, exist_ok=True)

    # ─── CRUD ────────────────────────────────────────────────────────────

    async def create(
        self,
        *,
        type: str,
        body: str,
        parent_id: int | None = None,
        metadata: dict[str, str] | None = None,
        status: Status = Status.OPEN,
        assigned_to: str = "",
        priority: str = "medium",
    ) -> Ticket:
        """Create a new ticket (persisted immediately).

        Fires lifecycle hooks for the initial status, so triggers
        on OPEN or AWAITING_APPROVAL work at creation time.
        """
        ticket = Ticket(
            id=self._next_id,
            type=type,
            body=body,
            parent_id=parent_id,
            assigned_to=assigned_to,
            priority=priority,
            metadata=metadata or {},
            status=status,
        )
        ticket.add_event("created", f"Type: {type}, Status: {status.value}")
        self._tickets[ticket.id] = ticket
        self._next_id += 1

        self._flush(ticket)

        logger.info("Created ticket #%d (%s): %s", ticket.id, type, body[:60])
        self._notify("created", ticket)

        # Fire lifecycle hooks for the initial status.
        key = (type, status)
        for hook in self._hooks.get(key, []):
            try:
                await hook(ticket, self)
            except Exception:
                logger.exception("Lifecycle hook failed for %s on create", key)

        return ticket

    def get(self, ticket_id: int) -> Ticket | None:
        return self._tickets.get(ticket_id)

    def list(
        self,
        *,
        type: str | None = None,
        status: Status | None = None,
        parent_id: int | None = None,
    ) -> list[Ticket]:
        """List tickets with optional filters."""
        result = list(self._tickets.values())
        if type is not None:
            result = [t for t in result if t.type == type]
        if status is not None:
            result = [t for t in result if t.status == status]
        if parent_id is not None:
            result = [t for t in result if t.parent_id == parent_id]
        return result

    def children(self, ticket_id: int) -> list[Ticket]:
        """Get all direct children of a ticket."""
        return [t for t in self._tickets.values() if t.parent_id == ticket_id]

    def workspace(self, ticket_id: int) -> Path:
        """Get the workspace directory for a ticket."""
        return self._ticket_dir(ticket_id)

    def attachments(self, ticket_id: int) -> Path:
        """Get the attachments directory for a ticket."""
        d = self._attachments_dir(ticket_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ─── State Transitions ───────────────────────────────────────────────

    async def update_status(self, ticket_id: int, status: Status, detail: str = "") -> Ticket:
        """Update a ticket's status and fire lifecycle hooks."""
        ticket = self._tickets[ticket_id]
        old_status = ticket.status
        ticket.status = status
        ticket.add_event("status_changed", f"{old_status.value} → {status.value}" + (f": {detail}" if detail else ""))
        self._flush(ticket)
        logger.info("Ticket #%d: %s → %s", ticket_id, old_status.value, status.value)
        self._notify("status_changed", ticket)

        # Fire lifecycle hooks.
        key = (ticket.type, status)
        for hook in self._hooks.get(key, []):
            try:
                await hook(ticket, self)
            except Exception:
                logger.exception("Lifecycle hook failed for %s", key)

        return ticket

    async def resolve(self, ticket_id: int, resolution: str, detail: str = "") -> Ticket:
        """Resolve a ticket with a resolution body."""
        ticket = self._tickets[ticket_id]
        ticket.resolution = resolution
        await self.update_status(ticket_id, Status.RESOLVED, detail or "Resolved")

        # Auto-resolve parent if all children are done (resolved or approved).
        if ticket.parent_id is not None:
            parent = self.get(ticket.parent_id)
            if parent and parent.status not in (Status.RESOLVED, Status.SUPERSEDED):
                children = self.children(parent.id)
                terminal = {Status.RESOLVED, Status.APPROVED}
                if all(c.status in terminal for c in children):
                    child_summary = "; ".join(
                        f"#{c.id} ({c.type})" for c in children
                    )
                    await self.resolve(
                        parent.id,
                        f"All children complete: {child_summary}",
                        detail="Auto-resolved (all children complete)",
                    )

        return ticket

    async def approve(self, ticket_id: int) -> Ticket:
        """Approve a ticket (transitions from awaiting_approval)."""
        ticket = self._tickets[ticket_id]
        if ticket.status != Status.AWAITING_APPROVAL:
            raise ValueError(f"Ticket #{ticket_id} is not awaiting approval (status: {ticket.status.value})")
        return await self.update_status(ticket_id, Status.APPROVED, "User approved")

    async def deny(self, ticket_id: int, reason: str = "") -> Ticket:
        """Deny a ticket."""
        ticket = self._tickets[ticket_id]
        if ticket.status != Status.AWAITING_APPROVAL:
            raise ValueError(f"Ticket #{ticket_id} is not awaiting approval (status: {ticket.status.value})")
        return await self.update_status(ticket_id, Status.DENIED, reason or "User denied")

    def update_metadata(self, ticket_id: int, **kwargs: str) -> Ticket:
        """Update ticket metadata."""
        ticket = self._tickets[ticket_id]
        ticket.metadata.update(kwargs)
        ticket.add_event("metadata_updated", json.dumps(kwargs))
        self._flush(ticket)
        self._notify("metadata_updated", ticket)
        return ticket

    # ─── Lifecycle Hooks ─────────────────────────────────────────────────

    def on(self, ticket_type: str, status: Status, hook: LifecycleHook) -> None:
        """Register a lifecycle hook for a (type, status) transition."""
        key = (ticket_type, status)
        self._hooks.setdefault(key, []).append(hook)

    # ─── Subscriptions (for SSE) ─────────────────────────────────────────

    def subscribe(self, callback: Callable[[Ticket, str], Any]) -> Callable[[], None]:
        """Subscribe to all ticket changes. Returns an unsubscribe function."""
        self._subscribers.append(callback)
        return lambda: self._subscribers.remove(callback)

    def _notify(self, action: str, ticket: Ticket) -> None:
        for cb in self._subscribers:
            try:
                cb(ticket, action)
            except Exception:
                logger.exception("Subscriber notification failed")
