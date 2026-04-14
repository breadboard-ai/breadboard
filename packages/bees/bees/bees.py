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

    def get_children(self) -> list[TaskNode]:
        """Returns all tasks that have no parents, as TaskNodes."""
        return [TaskNode(task, self.store) for task in self.store.get_children(None)]

    def get_node(self, task_id: str) -> TaskNode | None:
        """Looks up a task by ID and returns it as a TaskNode."""
        task = self.store.get(task_id)
        return TaskNode(task, self.store) if task else None
