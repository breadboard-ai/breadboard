# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Lightweight task file store.

Manages ``tasks/{uuid}.json`` files — the new decoupled work items.
Each task is a flat JSON file (a row in the ``tasks`` table) with an
objective, status, assignee, and outcome. No sessions, no workspace.

This is distinct from the existing ``TaskStore`` (in ``task_store.py``)
which manages the fused ``tickets/{uuid}/`` directories.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal


TaskStatus = Literal[
    "available", "queued", "in_progress", "completed", "failed", "cancelled"
]

TaskKind = Literal["work", "coordination"]


@dataclass
class TaskRecord:
    """A lightweight work item — a row in the tasks table.

    Tasks carry an objective and an outcome. Configuration (model, tools,
    session) belongs on the Agent that works on them.
    """

    id: str = ""
    objective: str = ""
    assignee: str | None = None
    """UUID of the agent assigned to this task."""

    created_by: str | None = None
    """UUID of the agent that created this task."""

    status: TaskStatus = "available"
    kind: TaskKind = "work"
    title: str | None = None
    outcome: str | None = None
    outcome_content: dict[str, Any] | None = None
    context: str | None = None
    """Supplementary context (work) or payload (coordination)."""

    tags: list[str] | None = None
    depends_on: list[str] | None = None
    created_at: str = ""
    completed_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return {k: v for k, v in d.items() if v is not None}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TaskRecord:
        return cls(
            id=data.get("id", ""),
            objective=data.get("objective", ""),
            assignee=data.get("assignee"),
            created_by=data.get("created_by"),
            status=data.get("status", "available"),
            kind=data.get("kind", "work"),
            title=data.get("title"),
            outcome=data.get("outcome"),
            outcome_content=data.get("outcome_content"),
            context=data.get("context"),
            tags=data.get("tags"),
            depends_on=data.get("depends_on"),
            created_at=data.get("created_at", ""),
            completed_at=data.get("completed_at"),
        )


class TaskFileStore:
    """CRUD for lightweight task JSON files under ``tasks/``."""

    def __init__(self, hive_dir: Path):
        self.hive_dir = hive_dir
        self.tasks_dir = hive_dir / "tasks"

    def create(
        self,
        objective: str,
        *,
        assignee: str | None = None,
        created_by: str | None = None,
        kind: TaskKind = "work",
        title: str | None = None,
        context: str | None = None,
        tags: list[str] | None = None,
        depends_on: list[str] | None = None,
        status: TaskStatus = "available",
    ) -> TaskRecord:
        """Create a new task file.

        Returns the created TaskRecord.
        """
        task_id = str(uuid.uuid4())
        task = TaskRecord(
            id=task_id,
            objective=objective,
            assignee=assignee,
            created_by=created_by,
            status=status,
            kind=kind,
            title=title,
            context=context,
            tags=tags,
            depends_on=depends_on,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.save(task)
        return task

    def get(self, task_id: str) -> TaskRecord | None:
        """Load a task by ID. Returns None if not found or malformed."""
        task_path = self.tasks_dir / f"{task_id}.json"
        if not task_path.exists():
            return None

        try:
            data = json.loads(task_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        return TaskRecord.from_dict(data)

    def query_all(self, status: TaskStatus | None = None) -> list[TaskRecord]:
        """List all tasks, optionally filtered by status."""
        if not self.tasks_dir.exists():
            return []

        tasks: list[TaskRecord] = []
        for task_file in sorted(self.tasks_dir.iterdir()):
            if not task_file.is_file() or not task_file.suffix == ".json":
                continue
            task_id = task_file.stem
            task = self.get(task_id)
            if task is None:
                continue
            if status is not None and task.status != status:
                continue
            tasks.append(task)

        tasks.sort(key=lambda t: t.created_at or "", reverse=True)
        return tasks

    def query_by_assignee(self, agent_id: str) -> list[TaskRecord]:
        """Return all tasks assigned to the given agent."""
        return [t for t in self.query_all() if t.assignee == agent_id]

    def dequeue_next(self, agent_id: str) -> TaskRecord | None:
        """Dequeue the oldest queued task for an agent.

        Finds the first task with ``status='queued'`` assigned to
        ``agent_id`` (ordered by ``created_at`` ascending), transitions
        it to ``in_progress``, persists, and returns it.

        Returns ``None`` if no queued tasks exist.
        """
        tasks = self.query_by_assignee(agent_id)
        queued = [
            t for t in tasks if t.status == "queued"
        ]
        # query_all sorts by created_at descending; we want FIFO.
        queued.sort(key=lambda t: t.created_at or "")
        if not queued:
            return None

        task = queued[0]
        task.status = "in_progress"
        self.save(task)
        return task

    def cancel_queued(self, agent_id: str) -> int:
        """Cancel all queued tasks for an agent.

        Returns the number of tasks cancelled.

        Called when an agent fails — remaining queued work is no longer
        viable.  Future alternatives to consider:
        - Re-queue to a fresh instance of the same agent type.
        - Leave as queued and let the parent reassign or retry.
        - Expose a ``retry_failed`` mutation that resets the agent and
          re-drains the queue.
        """
        tasks = self.query_by_assignee(agent_id)
        count = 0
        for task in tasks:
            if task.status == "queued":
                task.status = "cancelled"
                self.save(task)
                count += 1
        return count

    def save(self, task: TaskRecord) -> None:
        """Persist a task to disk as a JSON file."""
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        task_path = self.tasks_dir / f"{task.id}.json"
        task_path.write_text(
            json.dumps(task.to_dict(), indent=2, ensure_ascii=False) + "\n"
        )

    def delete(self, task_id: str) -> bool:
        """Remove a task file by ID.

        Returns True if the file existed and was removed.
        """
        task_path = self.tasks_dir / f"{task_id}.json"
        if task_path.exists():
            task_path.unlink()
            return True
        return False

    def delete_by_assignee(self, agent_id: str) -> list[str]:
        """Remove all task files assigned to the given agent.

        Returns the IDs of deleted task records.
        """
        deleted: list[str] = []
        for task in self.query_by_assignee(agent_id):
            if self.delete(task.id):
                deleted.append(task.id)
        return deleted
