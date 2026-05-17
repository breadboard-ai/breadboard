# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Unified agent store — layout-aware CRUD over agent directories.

Detects whether the hive uses the ``agents/`` + ``tasks/`` layout
(Project Swarm) or the legacy ``tickets/`` layout.  Routes all CRUD
operations through the appropriate backing store:

- **Swarm layout** (``agents/`` exists or fresh hive):
  ``AgentStore`` for agent directories, ``TaskFileStore`` for
  lightweight task records.
- **Legacy layout** (``tickets/`` only): ``TaskStore`` wrapped in
  the bidirectional ``ticket_to_agent`` / ``agent_to_ticket`` adapter.

This store is the single internal access point for the scheduler,
task runner, and all mutation handlers.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from bees.agent import Agent, AgentMetadata, AgentStatus
from bees.agent_adapter import agent_to_ticket, ticket_to_agent
from bees.agent_store import AgentStore
from bees.task_file_store import TaskFileStore
from bees.task_store import TaskStore
from bees.ticket import Ticket

__all__ = ["UnifiedAgentStore"]

Layout = Literal["swarm", "legacy"]


class UnifiedAgentStore:
    """Agent-typed CRUD with automatic layout detection.

    Detects the on-disk layout at construction and delegates to the
    correct backing store(s).  Every ``if self._layout == "legacy"``
    branch is a Phase 6 cleanup target — marked with
    ``# Phase 6: remove legacy path``.
    """

    def __init__(self, hive_dir: Path):
        self._hive_dir = hive_dir

        # Layout detection:
        #   agents/ exists          → swarm
        #   only tickets/ exists    → legacy   # Phase 6: remove legacy path
        #   neither (fresh hive)    → swarm
        #   both exist              → swarm (prefers agents/)
        if (hive_dir / "agents").exists() or not (hive_dir / "tickets").exists():
            self._layout: Layout = "swarm"
            self._agent_store = AgentStore(hive_dir)
            self._task_file_store = TaskFileStore(hive_dir)
        else:
            self._layout = "legacy"  # Phase 6: remove legacy path

        # Legacy ticket store — used by legacy layout and by backward-compat
        # callers (TaskNode, events, playbook hooks) in both layouts.
        self._ticket_store = TaskStore(hive_dir)

    # -- Delegate properties -----------------------------------------------

    @property
    def hive_dir(self) -> Path:
        return self._hive_dir

    @property
    def layout(self) -> Layout:
        """The detected on-disk layout."""
        return self._layout

    @property
    def tickets_dir(self) -> Path:
        """Backward-compat: ticket directory for legacy callers.

        Phase 6: remove — callers should use ``entity_dir()`` instead.
        """
        return self._ticket_store.tickets_dir  # Phase 6: remove legacy path

    def entity_dir(self, agent_id: str) -> Path:
        """Resolve the directory for an agent/ticket by ID.

        Returns ``agents/{id}`` in swarm layout,
        ``tickets/{id}`` in legacy layout.
        """
        if self._layout == "swarm":
            return self._hive_dir / "agents" / agent_id
        return self._ticket_store.tickets_dir / agent_id  # Phase 6: remove legacy path

    # -- Read operations ---------------------------------------------------

    def get(self, agent_id: str) -> Agent | None:
        """Load an agent by ID."""
        if self._layout == "swarm":
            agent = self._agent_store.get(agent_id)
            if agent is not None:
                return agent
            # Fall through: check tickets/ for legacy data that hasn't
            # been migrated yet (backward compat).

        # Phase 6: remove legacy path
        ticket = self._ticket_store.get(agent_id)
        if ticket is None:
            return None
        return ticket_to_agent(ticket)

    def query_all(self, status: AgentStatus | None = None) -> list[Agent]:
        """List agents, optionally filtered by status."""
        if self._layout == "swarm":
            agents = self._agent_store.query_all(status=status)
            if agents:
                return agents
            # Fall through to legacy if agents/ is empty (fresh swarm
            # hive before first write, or dual-directory mode).

        # Phase 6: remove legacy path
        tickets = self._ticket_store.query_all(status=status)
        return [ticket_to_agent(t) for t in tickets]

    def get_children(self, parent_id: str | None = None) -> list[Agent]:
        """Children of an agent, or root agents if parent_id is None."""
        if self._layout == "swarm":
            agents = self._agent_store.get_children(parent_id)
            if agents:
                return agents

        # Phase 6: remove legacy path
        tickets = self._ticket_store.get_children(parent_id)
        return [ticket_to_agent(t) for t in tickets]

    # -- Write operations --------------------------------------------------

    def save(self, agent: Agent) -> None:
        """Persist agent to disk."""
        if self._layout == "swarm":
            self._agent_store.save_metadata(agent)
            # Also write objective.md into the agent dir for backward compat
            # with code that reads objective from the filesystem.
            objective_path = agent.dir / "objective.md"
            objective_path.parent.mkdir(parents=True, exist_ok=True)
            objective_path.write_text(agent.objective)
            return

        # Phase 6: remove legacy path
        self._ticket_store.save(agent_to_ticket(agent))

    def save_metadata(self, agent: Agent) -> None:
        """Persist only the metadata."""
        if self._layout == "swarm":
            self._agent_store.save_metadata(agent)
            return

        # Phase 6: remove legacy path
        self._ticket_store.save_metadata(agent_to_ticket(agent))

    def respond(self, agent_id: str, response: dict[str, Any]) -> Agent:
        """Save user response to a suspended agent."""
        if self._layout == "swarm":
            agent = self._agent_store.get(agent_id)
            if agent is not None:
                response_path = agent.dir / "response.json"
                response_path.write_text(
                    json.dumps(response, indent=2, ensure_ascii=False) + "\n"
                )
                agent.metadata.assignee = "agent"
                self._agent_store.save_metadata(agent)
                return agent

        # Phase 6: remove legacy path
        ticket = self._ticket_store.respond(agent_id, response)
        return ticket_to_agent(ticket)

    def create(self, objective: str, **kwargs: Any) -> Agent:
        """Create a new agent.

        In swarm layout, creates an ``agents/{uuid}/`` directory and a
        ``tasks/{uuid}.json`` file.  In legacy layout, creates a
        ``tickets/{uuid}/`` directory.
        """
        if self._layout == "swarm":
            return self._create_swarm(objective, **kwargs)

        # Phase 6: remove legacy path
        ticket = self._ticket_store.create(objective, **kwargs)
        return ticket_to_agent(ticket)

    # -- Swarm-mode create -------------------------------------------------

    def _create_swarm(self, objective: str, **kwargs: Any) -> Agent:
        """Create an agent + task in the swarm layout.

        Maps the flat kwargs from ``TaskStore.create()`` onto the
        structured ``AgentStore.create()`` + ``TaskFileStore.create()``.
        """
        from bees.agent_adapter import _has_system_functions

        agent = self._agent_store.create(
            type=kwargs.get("playbook_id", ""),
            slug=kwargs.get("slug", ""),
            finite=_has_system_functions(kwargs.get("functions")),
            runner=kwargs.get("runner", "generate"),
            parent_id=kwargs.get("parent_task_id"),
            workspace_root_id=kwargs.get("owning_task_id"),
            model=kwargs.get("model"),
            voice=kwargs.get("voice"),
            functions=kwargs.get("functions"),
            skills=kwargs.get("skills"),
            options=kwargs.get("options"),
            watch_events=kwargs.get("watch_events"),
            signal_type=kwargs.get("signal_type"),
            playbook_id=kwargs.get("playbook_id"),
            tasks=kwargs.get("tasks"),
            tags=kwargs.get("tags"),
        )

        # Bridge fields carried from kwargs.
        if kwargs.get("playbook_run_id"):
            agent.metadata.playbook_run_id = kwargs["playbook_run_id"]
        if kwargs.get("context"):
            agent.metadata.context = kwargs["context"]
        if kwargs.get("title"):
            agent.metadata.title = kwargs["title"]
        if kwargs.get("assignee"):
            agent.metadata.assignee = kwargs["assignee"]
        if kwargs.get("kind"):
            agent.metadata.kind = kwargs["kind"]
        self._agent_store.save_metadata(agent)

        # Write objective to the agent directory for backward compat.
        objective_path = agent.dir / "objective.md"
        objective_path.write_text(objective)

        # Set transient objective on the Agent object.
        agent.objective = objective

        # Create lightweight task record.
        self._task_file_store.create(
            objective=objective,
            assignee=agent.id,
            created_by=kwargs.get("parent_task_id"),
            kind=kwargs.get("kind", "work"),
            title=kwargs.get("title"),
            context=kwargs.get("context"),
            tags=kwargs.get("tags"),
        )

        return agent
