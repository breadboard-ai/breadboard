# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
from pathlib import Path
from bees.task_store import TaskStore
from bees.task_node import TaskNode


class Bees:
    """The high-level entry point for the Bees library.

    Acts like the 'Document' in the DOM analogy.
    """

    def __init__(self, hive_dir: Path):
        self.store = TaskStore(hive_dir)

    @property
    def children(self) -> list[TaskNode]:
        """Returns all tasks that have no parents, as TaskNodes."""
        return [TaskNode(task, self.store) for task in self.store.get_children(None)]

    def get_by_id(self, task_id: str) -> TaskNode | None:
        """Looks up a task by ID and returns it as a TaskNode."""
        task = self.store.get(task_id)
        return TaskNode(task, self.store) if task else None

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks that contain all of the specified tags."""
        all_tickets = self.store.query_all()
        matching_nodes: list[TaskNode] = []
        for ticket in all_tickets:
            ticket_tags = ticket.metadata.tags or []
            if all(tag in ticket_tags for tag in tags):
                matching_nodes.append(TaskNode(ticket, self.store))
        return matching_nodes
