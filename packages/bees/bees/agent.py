# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Agent data model.

An agent is a persistent identity with a session, workspace, and tools.
Agents are directories under ``{hive}/agents/{uuid}/`` containing:

- ``metadata.json`` — agent configuration and status
- ``sessions/``     — session history (events, turns, workspace)

Unlike tickets (which fuse agent + task into one identity), agents are
pure scheduling entities. Work items are separate ``TaskRecord`` objects
stored as flat JSON files under ``{hive}/tasks/``.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from bees.task_file_store import TaskRecord


AgentStatus = Literal[
    "available", "blocked", "running", "suspended", "paused",
    "completed", "failed", "cancelled"
]

RunnerType = Literal["generate", "live", "direct_model", "antigravity"]


def has_system_functions(functions: list[str] | None) -> bool:
    """Determine if a functions list includes system.* functions.

    An agent is finite if its template's ``functions`` list includes
    ``system.*``. This matches any entry that starts with ``system``.
    """
    if not functions:
        return True  # Default: finite (backward compat with old templates)
    return any(f.startswith("system") for f in functions)


@dataclass
class AgentMetadata:
    """Metadata for an agent stored as metadata.json.

    Captures everything the scheduler needs to know about *who* runs work:
    identity, configuration, and lifecycle state. Task-specific fields
    (objective, outcome) live on ``TaskRecord`` instead.
    """

    type: str = ""
    """Agent type name — references a template in TEMPLATES.yaml."""

    slug: str = ""
    """Human-readable name. Unique per parent (``parent_id`` + ``slug``)."""

    status: AgentStatus = "available"

    finite: bool = True
    """True if the agent's template functions include ``system.*``.

    Finite agents call ``system_objective_fulfilled`` after each task
    and their session terminates. Infinite agents stay alive across tasks.
    """

    runner: RunnerType = "generate"
    """Which session runner to use."""

    parent_id: str | None = None
    """UUID of the parent agent. None for root agents."""

    workspace_root_id: str | None = None
    """UUID of the root agent whose workspace is shared.

    Set once at creation: inherited from the parent's ``workspace_root_id``,
    or self for root agents. Avoids O(depth) tree walks.
    """

    active_session: str | None = None
    """UUID of the active session for this agent."""

    model: str | None = None
    voice: str | None = None
    functions: list[str] | None = None
    skills: list[str] | None = None
    options: dict[str, Any] | None = None

    watch_events: list[dict[str, Any]] | None = None
    """Coordination event subscriptions."""

    signal_type: str | None = None
    """Coordination signal type this agent emits."""

    queued_updates: list[str] | None = None
    pending_context_updates: list[dict[str, Any]] | None = None

    created_at: str = ""
    completed_at: str | None = None

    # Bookkeeping carried forward from TicketMetadata
    paused_from: str | None = None
    """The status this agent had before it was paused."""

    playbook_id: str | None = None
    """Template name that created this agent."""

    playbook_run_id: str | None = None
    """Run-scoped ID for coordination signal routing.

    Temporary bridge from ``TicketMetadata`` — coordination uses this
    to scope broadcasts to a single playbook run. Will be replaced by
    root-ancestor matching in Phase 6.
    """

    tasks: list[str] | None = None
    """Allowlist for child agent types (template names)."""

    tags: list[str] | None = None

    # -- Execution state (bridge fields from TicketMetadata) ---------------
    # These are written by the scheduler and task runner during execution.
    # In the future, some move to TaskRecord (outcome, title, context)
    # and others stay on the agent (error, suspend_event, assignee).

    depends_on: list[str] | None = None
    error: str | None = None
    outcome: str | None = None
    outcome_content: dict[str, Any] | None = None
    assignee: str | None = None
    """``'user'`` or ``'agent'`` — who owns the next move."""

    suspend_event: dict[str, Any] | None = None
    kind: str = "work"
    """``'work'`` or ``'coordination'``."""

    delivered_to: list[str] | None = None
    """Coordination delivery tracking."""

    context: str | None = None
    title: str | None = None
    turns: int = 0
    thoughts: int = 0
    files: list[dict[str, str]] | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Omit None fields for cleaner JSON.
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentMetadata:
        return cls(
            type=data.get("type", ""),
            slug=data.get("slug", ""),
            status=data.get("status", "available"),
            # playbook_run_id populated below
            finite=data.get("finite", True),
            runner=data.get("runner", "generate"),
            parent_id=data.get("parent_id"),
            workspace_root_id=data.get("workspace_root_id"),
            active_session=data.get("active_session"),
            model=data.get("model"),
            voice=data.get("voice"),
            functions=data.get("functions"),
            skills=data.get("skills"),
            options=data.get("options"),
            watch_events=data.get("watch_events"),
            signal_type=data.get("signal_type"),
            queued_updates=data.get("queued_updates"),
            pending_context_updates=data.get("pending_context_updates"),
            created_at=data.get("created_at", ""),
            completed_at=data.get("completed_at"),
            paused_from=data.get("paused_from"),
            playbook_id=data.get("playbook_id"),
            playbook_run_id=data.get("playbook_run_id"),
            tasks=data.get("tasks"),
            tags=data.get("tags"),
            depends_on=data.get("depends_on"),
            error=data.get("error"),
            outcome=data.get("outcome"),
            outcome_content=data.get("outcome_content"),
            assignee=data.get("assignee"),
            suspend_event=data.get("suspend_event"),
            kind=data.get("kind", "work"),
            delivered_to=data.get("delivered_to"),
            context=data.get("context"),
            title=data.get("title"),
            turns=data.get("turns", 0),
            thoughts=data.get("thoughts", 0),
            files=data.get("files"),
        )


@dataclass
class Agent:
    """An agent backed by a directory on disk."""

    id: str
    dir: Path
    metadata: AgentMetadata = field(default_factory=AgentMetadata)
    objective: str = ""
    """Transient objective text.

    During the ``tickets/`` era the objective lives in ``objective.md``
    and is populated by the adapter. Once ``TaskRecord`` takes over
    (Phase 3+) this field is removed — objectives belong on tasks.
    """

    tasks: list[TaskRecord] = field(default_factory=list)
    """List of tasks assigned to this agent, populated from the task store."""

    @property
    def fs_dir(self) -> Path:
        """The working filesystem directory for this agent.

        If ``workspace_root_id`` is set (and differs from self), the agent
        shares the root agent's workspace. Otherwise it uses its own.
        """
        root_id = self.metadata.workspace_root_id
        if root_id and root_id != self.id:
            target_dir = self.dir.parent / root_id
        else:
            target_dir = self.dir

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
    def metadata_path(self) -> Path:
        return self.dir / "metadata.json"
