# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Unified agent store — bidirectional adapter over tickets/.

Wraps ``TaskStore`` (which reads/writes ``tickets/``) and exposes an
``Agent``-typed API for the scheduler, task runner, and provisioner.

Reads: ``Ticket`` → ``Agent`` (via ``ticket_to_agent``).
Writes: ``Agent`` → ``Ticket`` (via ``agent_to_ticket``).

This store is the single internal access point during Phase 2a. It
will be replaced by a direct ``AgentStore`` + ``TaskFileStore``
combination in Phase 2b when the on-disk layout switches to
``agents/`` + ``tasks/``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from bees.agent import Agent, AgentStatus
from bees.agent_adapter import agent_to_ticket, ticket_to_agent
from bees.task_store import TaskStore
from bees.ticket import TicketKind, RunnerType

__all__ = ["UnifiedAgentStore"]


class UnifiedAgentStore:
    """Agent-typed CRUD over the existing ``tickets/`` directory.

    Bidirectional adapter: reads ``tickets/`` as ``Agent`` objects,
    writes ``Agent`` state back as ``Ticket`` state.
    """

    def __init__(self, hive_dir: Path):
        self._ticket_store = TaskStore(hive_dir)

    # -- Delegate properties -----------------------------------------------

    @property
    def hive_dir(self) -> Path:
        return self._ticket_store.hive_dir

    @property
    def tickets_dir(self) -> Path:
        """Backward-compat: ticket directory for deletion, log cleanup."""
        return self._ticket_store.tickets_dir

    # -- Read operations ---------------------------------------------------

    def get(self, agent_id: str) -> Agent | None:
        """Load an agent by ID from ``tickets/``."""
        ticket = self._ticket_store.get(agent_id)
        if ticket is None:
            return None
        return ticket_to_agent(ticket)

    def query_all(self, status: AgentStatus | None = None) -> list[Agent]:
        """List agents, optionally filtered by status."""
        tickets = self._ticket_store.query_all(status=status)
        return [ticket_to_agent(t) for t in tickets]

    def get_children(self, parent_id: str | None = None) -> list[Agent]:
        """Children of an agent, or root agents if parent_id is None."""
        tickets = self._ticket_store.get_children(parent_id)
        return [ticket_to_agent(t) for t in tickets]

    # -- Write operations --------------------------------------------------

    def save(self, agent: Agent) -> None:
        """Persist agent to disk as a ticket."""
        self._ticket_store.save(agent_to_ticket(agent))

    def save_metadata(self, agent: Agent) -> None:
        """Persist only the metadata."""
        self._ticket_store.save_metadata(agent_to_ticket(agent))

    def respond(self, agent_id: str, response: dict[str, Any]) -> Agent:
        """Save user response to a suspended agent."""
        ticket = self._ticket_store.respond(agent_id, response)
        return ticket_to_agent(ticket)

    def create(self, objective: str, **kwargs: Any) -> Agent:
        """Create a new agent (as a ticket on disk).

        Accepts the same kwargs as ``TaskStore.create``.
        """
        ticket = self._ticket_store.create(objective, **kwargs)
        return ticket_to_agent(ticket)
