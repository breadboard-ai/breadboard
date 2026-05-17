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
        """Persist only the metadata.

        In swarm layout, also syncs the corresponding task record's status
        and outcome so that ``tasks/{uuid}.json`` stays consistent with
        the agent's lifecycle transitions.
        """
        if self._layout == "swarm":
            self._agent_store.save_metadata(agent)
            self._sync_task_record(agent)
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

    # -- Task record sync --------------------------------------------------

    # Agent statuses that warrant syncing to the task record.
    # Not every save_metadata call changes the agent's externally-visible
    # status — most are incremental bookkeeping (turns++, file list, etc.).
    # We only pay the cost of scanning tasks/ when the agent enters a
    # status that a task consumer would care about.
    _SYNC_WORTHY_STATUSES = frozenset({
        "running", "suspended", "completed", "failed", "cancelled",
    })

    # Agent status → task status mapping.
    _AGENT_TO_TASK_STATUS: dict[str, str] = {
        "available": "available",
        "blocked": "available",
        "running": "in_progress",
        "suspended": "in_progress",
        "paused": "in_progress",
        "completed": "completed",
        "failed": "failed",
        "cancelled": "cancelled",
    }

    def _sync_task_record(self, agent: Agent) -> None:
        """Sync the task record assigned to this agent.

        Only runs when the agent's status is significant (running,
        terminal). Finds the task whose ``assignee`` matches the agent
        ID, then updates its ``status``, ``outcome``, ``outcome_content``,
        and ``completed_at``.

        Best-effort — missing or malformed task files are silently skipped.
        The agent metadata is the source of truth; the task file is a
        read model.
        """
        if agent.metadata.status not in self._SYNC_WORTHY_STATUSES:
            return

        tasks = self._task_file_store.query_by_assignee(agent.id)
        if not tasks:
            return

        task_status = self._AGENT_TO_TASK_STATUS.get(
            agent.metadata.status, "available"
        )

        for task in tasks:
            changed = False

            if task.status != task_status:
                task.status = task_status
                changed = True

            if agent.metadata.outcome and task.outcome != agent.metadata.outcome:
                task.outcome = agent.metadata.outcome
                changed = True

            if agent.metadata.outcome_content and task.outcome_content != agent.metadata.outcome_content:
                task.outcome_content = agent.metadata.outcome_content
                changed = True

            if agent.metadata.completed_at and task.completed_at != agent.metadata.completed_at:
                task.completed_at = agent.metadata.completed_at
                changed = True

            if changed:
                self._task_file_store.save(task)

    # -- Slug resolution ---------------------------------------------------

    def find_child_by_slug(self, parent_id: str, slug: str) -> Agent | None:
        """Find a child agent by slug under a given parent.

        Scans the parent's children for a matching ``metadata.slug``.
        Returns the first match, or ``None`` if not found.

        The slug stored in metadata is the full slug path (e.g.,
        ``"poet"`` for a direct child, ``"app/tests"`` for a nested
        child). The caller provides just the child's own slug segment —
        we match against the tail of the stored slug path.
        """
        children = self.get_children(parent_id)
        for child in children:
            stored = child.metadata.slug or ""
            # Match the tail segment of the slug path.
            tail = stored.rsplit("/", 1)[-1] if "/" in stored else stored
            if tail == slug:
                return child
        return None

    # -- Fresh-instance reuse ----------------------------------------------

    _TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})

    def reset_for_reuse(
        self,
        agent: Agent,
        objective: str,
        *,
        title: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> None:
        """Reset a terminal agent for a new task assignment.

        Used by ``agents_assign_task`` when a finite agent that has
        already completed receives a new task for the same slug.

        Resets status, creates a new session ID, clears outcome and
        error fields, writes the new objective, and creates a new task
        record. The UUID and workspace persist — the slug→UUID mapping
        is stable.

        Raises ``ValueError`` if the agent is not in a terminal state.
        """
        if agent.metadata.status not in self._TERMINAL_STATUSES:
            raise ValueError(
                f"Cannot reset agent {agent.id[:8]} — "
                f"status is '{agent.metadata.status}', not terminal"
            )

        # Reset metadata for a fresh run.
        agent.metadata.status = "available"
        agent.metadata.active_session = str(uuid.uuid4())
        agent.metadata.outcome = None
        agent.metadata.outcome_content = None
        agent.metadata.error = None
        agent.metadata.completed_at = None
        agent.metadata.assignee = None
        agent.metadata.suspend_event = None
        agent.metadata.turns = 0
        agent.metadata.thoughts = 0
        agent.metadata.files = None
        agent.metadata.pending_context_updates = None
        agent.metadata.queued_updates = None

        if title:
            agent.metadata.title = title
        if options:
            agent.metadata.options = options

        # Write new objective.
        agent.objective = objective
        objective_path = agent.dir / "objective.md"
        objective_path.write_text(objective)

        # Save updated metadata.
        self.save_metadata(agent)

        # Create new task record for the new assignment.
        if self._layout == "swarm":
            self._task_file_store.create(
                objective=objective,
                assignee=agent.id,
                created_by=agent.metadata.parent_id,
                kind="work",
                title=title,
            )

