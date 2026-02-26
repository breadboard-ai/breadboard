# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Task tree manager for the agent loop.

Port of ``visual-editor/src/a2/agent/task-tree-manager.ts``. Manages a
hierarchical task tree that the agent uses to plan and track execution.
The tree is persisted as ``task_tree.json`` in the ``AgentFileSystem``.
"""

from __future__ import annotations

import json
from typing import Any

from .agent_file_system import AgentFileSystem

# JSON Schema for structured output — used by Gemini to generate the task tree.
TASK_TREE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "definitions": {
        "TaskNode": {
            "type": "object",
            "required": ["task_id", "description", "execution_mode", "status"],
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": (
                        'The unique id of the task, must be in the format '
                        'of "task_NNN" where NNN is the number'
                    ),
                },
                "description": {
                    "type": "string",
                    "description": (
                        "Detailed explanation of what fulfilling this "
                        "objective entails."
                    ),
                },
                "execution_mode": {
                    "type": "string",
                    "description": (
                        "Defines how immediate subtasks should be executed. "
                        "'serial' means one by one in order; 'concurrent' "
                        "means all at the same time."
                    ),
                    "enum": ["serial", "concurrent"],
                },
                "status": {
                    "type": "string",
                    "description": "The current status of a task",
                    "enum": ["not_started", "in_progress", "complete"],
                },
                "subtasks": {
                    "type": "array",
                    "description": (
                        "Ordered list of child tasks. If execution_mode is "
                        "serial, the order matters."
                    ),
                    "items": {"$ref": "#/definitions/TaskNode"},
                },
            },
        },
    },
    "properties": {
        "task_tree": {
            "type": "object",
            "$ref": "#/definitions/TaskNode",
        },
    },
}


class TaskTreeManager:
    """Manages a hierarchical task tree persisted in the agent file system.

    The agent creates a task tree via ``system_create_task_tree`` and updates
    task statuses via ``system_mark_completed_tasks``. The tree is saved to
    ``/mnt/task_tree.json`` after every mutation.
    """

    def __init__(self, file_system: AgentFileSystem) -> None:
        self._file_system = file_system
        self._tree: dict[str, Any] | None = None
        self._task_map: dict[str, dict[str, Any]] = {}
        self._message_map: dict[str, str] = {}

    def set(self, tree: dict[str, Any]) -> str:
        """Set the task tree, index all nodes by task_id, and save."""
        self._tree = tree
        self._task_map.clear()
        self._message_map.clear()
        self._update_task_map([self._tree])
        return self._save()

    def get(self) -> str:
        """Return the task tree as a JSON string."""
        if self._tree is None:
            return ""
        return json.dumps(self._tree)

    def set_in_progress(
        self, task_id: str | None, progress_message: str
    ) -> None:
        """Mark a task as in-progress with a status message."""
        if not task_id:
            return
        trimmed = self._trim_task_id(task_id)
        task = self._task_map.get(trimmed)
        if task is None:
            return
        task["status"] = "in_progress"
        self._message_map[trimmed] = progress_message
        self._save()

    def set_complete(self, task_ids: list[str]) -> str:
        """Mark multiple tasks as complete and save."""
        for task_id in task_ids:
            task = self._task_map.get(self._trim_task_id(task_id))
            if task is None:
                continue
            task["status"] = "complete"
        return self._save()

    # ---- Private helpers ----

    def _save(self) -> str:
        """Persist the task tree to the file system."""
        return self._file_system.overwrite(
            "task_tree.json", json.dumps(self._tree)
        )

    def _update_task_map(self, tasks: list[dict[str, Any]]) -> None:
        """Recursively index all tasks by their task_id."""
        for task in tasks:
            self._task_map[task["task_id"]] = task
            subtasks = task.get("subtasks")
            if subtasks:
                self._update_task_map(subtasks)

    @staticmethod
    def _trim_task_id(task_id: str) -> str:
        """Trim a task_id like 'task_001_1' to 'task_001'."""
        parts = task_id.split("_")
        return "_".join(parts[:2])
