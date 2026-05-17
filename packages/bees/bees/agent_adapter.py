# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Adapter: read tickets/ as agents.

Bridges the existing ``tickets/{uuid}/`` directory layout into the
new ``Agent`` data model. This enables Phase 1 tests and hivetool
to exercise backward-compatible reads without waiting for Phase 2a.

Pure read adapter — no writes.
"""

from __future__ import annotations

from bees.agent import Agent, AgentMetadata
from bees.task_store import TaskStore
from bees.ticket import Ticket


def _has_system_functions(functions: list[str] | None) -> bool:
    """Determine if a functions list includes system.* functions.

    An agent is finite if its template's ``functions`` list includes
    ``system.*``. This matches any entry that starts with ``system``.
    """
    if not functions:
        return True  # Default: finite (backward compat with old tickets)
    return any(f.startswith("system") for f in functions)


def ticket_to_agent(ticket: Ticket) -> Agent:
    """Convert a Ticket to an Agent.

    Maps ticket metadata fields to their agent counterparts:
    - ``parent_task_id`` → ``parent_id``
    - ``owning_task_id`` → ``workspace_root_id``
    - ``functions`` list determines ``finite``
    """
    meta = ticket.metadata
    return Agent(
        id=ticket.id,
        dir=ticket.dir,
        metadata=AgentMetadata(
            type=meta.playbook_id or "",
            slug=meta.slug or "",
            status=meta.status,
            finite=_has_system_functions(meta.functions),
            runner=meta.runner,
            parent_id=meta.parent_task_id,
            workspace_root_id=meta.owning_task_id or ticket.id,
            active_session=meta.active_session,
            model=meta.model,
            voice=meta.voice,
            functions=meta.functions,
            skills=meta.skills,
            options=meta.options,
            watch_events=meta.watch_events,
            signal_type=meta.signal_type,
            queued_updates=meta.queued_updates,
            pending_context_updates=meta.pending_context_updates,
            created_at=meta.created_at,
            completed_at=meta.completed_at,
            paused_from=meta.paused_from,
            playbook_id=meta.playbook_id,
            tasks=meta.tasks,
            tags=meta.tags,
        ),
    )


class TicketToAgentAdapter:
    """Read tickets/ as if they were agents/.

    Wraps a ``TaskStore`` (which reads from ``tickets/``) and returns
    ``Agent`` objects. Enables the ``AgentStore`` interface to work
    against legacy data.
    """

    def __init__(self, ticket_store: TaskStore):
        self._ticket_store = ticket_store

    def get(self, ticket_id: str) -> Agent | None:
        """Load a ticket as an Agent."""
        ticket = self._ticket_store.get(ticket_id)
        if ticket is None:
            return None
        return ticket_to_agent(ticket)

    def query_all(self, status: str | None = None) -> list[Agent]:
        """Read all tickets as Agents."""
        tickets = self._ticket_store.query_all(status=status)
        return [ticket_to_agent(t) for t in tickets]

    def get_children(self, parent_id: str | None = None) -> list[Agent]:
        """Returns children of the given agent, or roots if parent_id is None."""
        tickets = self._ticket_store.get_children(parent_id)
        return [ticket_to_agent(t) for t in tickets]
