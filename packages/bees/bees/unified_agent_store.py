# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Unified agent store — CRUD over agent directories.

All CRUD operations go through the swarm layout:
``AgentStore`` for agent directories under ``agents/``,
``TaskFileStore`` for lightweight task records under ``tasks/``.

This store is the single internal access point for the scheduler,
task runner, and all mutation handlers.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bees.agent import Agent, AgentMetadata, AgentStatus, has_system_functions
from bees.agent_store import AgentStore
from bees.task_file_store import TaskFileStore, TaskRecord

__all__ = ["UnifiedAgentStore"]


class UnifiedAgentStore:
    """Agent-typed CRUD over the swarm filesystem layout."""

    def __init__(self, hive_dir: Path):
        self._hive_dir = hive_dir
        self._agent_store = AgentStore(hive_dir)
        self._task_file_store = TaskFileStore(hive_dir)

    # -- Delegate properties -----------------------------------------------

    @property
    def hive_dir(self) -> Path:
        return self._hive_dir

    @property
    def layout(self) -> str:
        """The on-disk layout. Always ``"swarm"``."""
        return "swarm"

    def entity_dir(self, agent_id: str) -> Path:
        """Resolve the directory for an agent by ID."""
        return self._hive_dir / "agents" / agent_id

    def delete_agent(self, agent_id: str) -> None:
        """Remove an agent's directory and its associated task records.

        Callers handle recursion into children and log cleanup — this
        method only deletes the single agent's own data.
        """
        import shutil

        # Remove the agent directory (sessions, workspace, metadata).
        agent_dir = self.entity_dir(agent_id)
        if agent_dir.exists():
            shutil.rmtree(agent_dir)

        # Remove task records assigned to this agent.
        self._task_file_store.delete_by_assignee(agent_id)

    # -- Read operations ---------------------------------------------------

    def get(self, agent_id: str) -> Agent | None:
        """Load an agent by ID."""
        agent = self._agent_store.get(agent_id)
        if agent:
            agent.tasks = self._task_file_store.query_by_assignee(agent.id)
        return agent

    def query_all(self, status: AgentStatus | None = None) -> list[Agent]:
        """List agents, optionally filtered by status."""
        agents = self._agent_store.query_all(status=status)
        for agent in agents:
            agent.tasks = self._task_file_store.query_by_assignee(agent.id)
        return agents

    def get_children(self, parent_id: str | None = None) -> list[Agent]:
        """Children of an agent, or root agents if parent_id is None."""
        agents = self._agent_store.get_children(parent_id)
        for agent in agents:
            agent.tasks = self._task_file_store.query_by_assignee(agent.id)
        return agents

    # -- Write operations --------------------------------------------------

    def save(self, agent: Agent) -> None:
        """Persist agent to disk."""
        self._agent_store.save_metadata(agent)
        # Also write objective.md into the agent dir for backward compat
        # with code that reads objective from the filesystem.
        objective_path = agent.dir / "objective.md"
        objective_path.parent.mkdir(parents=True, exist_ok=True)
        objective_path.write_text(agent.objective)

    def save_metadata(self, agent: Agent) -> None:
        """Persist only the metadata.

        Also syncs the corresponding task record's status and outcome
        so that ``tasks/{uuid}.json`` stays consistent with the agent's
        lifecycle transitions.
        """
        self._agent_store.save_metadata(agent)
        self._sync_task_record(agent)

    def respond(self, agent_id: str, response: dict[str, Any]) -> Agent:
        """Save user response to a suspended agent."""
        agent = self._agent_store.get(agent_id)
        if agent is None:
            raise ValueError(f"Agent {agent_id} not found")
        response_path = agent.dir / "response.json"
        response_path.write_text(
            json.dumps(response, indent=2, ensure_ascii=False) + "\n"
        )
        agent.metadata.assignee = "agent"
        self._agent_store.save_metadata(agent)
        return agent

    def create(self, objective: str, **kwargs: Any) -> Agent:
        """Create a new agent.

        Creates an ``agents/{uuid}/`` directory and a
        ``tasks/{uuid}.json`` file.
        """
        agent = self._agent_store.create(
            type=kwargs.get("playbook_id", ""),
            slug=kwargs.get("slug", ""),
            finite=has_system_functions(kwargs.get("functions")),
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
        task = self._task_file_store.create(
            objective=objective,
            assignee=agent.id,
            created_by=kwargs.get("parent_task_id"),
            kind=kwargs.get("kind", "work"),
            title=kwargs.get("title"),
            context=kwargs.get("context"),
            tags=kwargs.get("tags"),
        )

        agent.tasks = [task]
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
                # Don't overwrite tasks that are terminal or still queued.
                # Terminal: events_yield marks individual tasks as completed
                # while the agent is still running — don't revert to in_progress.
                # Queued: waiting in the task queue — must not be dragged to
                # in_progress by the agent's current execution state.
                _SKIP_TASK = {"completed", "failed", "cancelled", "queued"}
                if task.status in _SKIP_TASK and task_status not in {"completed", "failed", "cancelled"}:
                    continue
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
    ) -> TaskRecord:
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
        return self._task_file_store.create(
            objective=objective,
            assignee=agent.id,
            created_by=agent.metadata.parent_id,
            kind="work",
            title=title,
        )

    def get_active_task_id(self, agent_id: str) -> str | None:
        """Get the ID of the most recent task assigned to the agent."""
        tasks = self._task_file_store.query_by_assignee(agent_id)
        return tasks[0].id if tasks else None

    def queue_task(
        self,
        objective: str,
        *,
        assignee: str,
        created_by: str | None = None,
        title: str | None = None,
    ) -> TaskRecord:
        """Create and queue a new work task for an existing agent."""
        return self._task_file_store.create(
            objective=objective,
            assignee=assignee,
            created_by=created_by,
            kind="work",
            title=title,
            status="queued",
        )

    def has_pending_tasks(self, agent_id: str) -> bool:
        """Check if an agent has any pending child tasks."""
        pending_tasks = [
            t for t in self._task_file_store.query_all()
            if t.created_by == agent_id
            and t.status not in ("completed", "failed", "cancelled")
        ]
        return len(pending_tasks) > 0
