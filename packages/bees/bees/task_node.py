# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
from bees.task_store import TaskStore
from bees.ticket import Ticket


class TaskNode:
    """Wraps a Ticket and a TaskStore to provide a tree traversal API."""

    def __init__(self, task: Ticket, store: TaskStore):
        self.task = task
        self.store = store

    @property
    def id(self) -> str:
        """Returns the task ID."""
        return self.task.id

    @property
    def children(self) -> list[TaskNode]:
        """Returns children of this task."""
        tasks = self.store.get_children(self.task.id)
        return [TaskNode(t, self.store) for t in tasks]

    @property
    def parent(self) -> TaskNode | None:
        """Returns the parent of this task."""
        if not self.task.metadata.parent_ticket_id:
            return None
        parent_task = self.store.get(self.task.metadata.parent_ticket_id)
        return TaskNode(parent_task, self.store) if parent_task else None
