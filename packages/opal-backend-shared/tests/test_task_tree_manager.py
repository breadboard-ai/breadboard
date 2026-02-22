# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for TaskTreeManager (Phase 4.4f).
"""

from __future__ import annotations

import json

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.task_tree_manager import (
    TASK_TREE_SCHEMA,
    TaskTreeManager,
)


# =============================================================================
# Schema
# =============================================================================


class TestTaskTreeSchema:
    """Tests for the TASK_TREE_SCHEMA."""

    def test_schema_has_task_tree_property(self):
        assert "task_tree" in TASK_TREE_SCHEMA["properties"]

    def test_schema_defines_task_node(self):
        node_def = TASK_TREE_SCHEMA["definitions"]["TaskNode"]
        assert "task_id" in node_def["properties"]
        assert "description" in node_def["properties"]
        assert "execution_mode" in node_def["properties"]
        assert "status" in node_def["properties"]
        assert "subtasks" in node_def["properties"]

    def test_schema_required_fields(self):
        required = TASK_TREE_SCHEMA["definitions"]["TaskNode"]["required"]
        assert "task_id" in required
        assert "description" in required
        assert "execution_mode" in required
        assert "status" in required


# =============================================================================
# Set and Get
# =============================================================================


class TestSetAndGet:
    """Tests for setting and retrieving the task tree."""

    def _make_tree(self) -> dict:
        return {
            "task_id": "task_001",
            "description": "Root task",
            "execution_mode": "serial",
            "status": "not_started",
            "subtasks": [
                {
                    "task_id": "task_002",
                    "description": "Subtask A",
                    "execution_mode": "concurrent",
                    "status": "not_started",
                },
                {
                    "task_id": "task_003",
                    "description": "Subtask B",
                    "execution_mode": "serial",
                    "status": "not_started",
                },
            ],
        }

    def test_set_saves_to_file_system(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        tree = self._make_tree()
        path = mgr.set(tree)
        assert path == "/mnt/task_tree.json"
        # Verify it's in the file system
        content = fs.read_text(path)
        assert isinstance(content, str)
        parsed = json.loads(content)
        assert parsed["task_id"] == "task_001"

    def test_get_returns_json_string(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())
        result = mgr.get()
        parsed = json.loads(result)
        assert parsed["task_id"] == "task_001"

    def test_get_returns_empty_string_when_no_tree(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        assert mgr.get() == ""


# =============================================================================
# Status Tracking
# =============================================================================


class TestStatusTracking:
    """Tests for set_in_progress and set_complete."""

    def _make_tree(self) -> dict:
        return {
            "task_id": "task_001",
            "description": "Root",
            "execution_mode": "serial",
            "status": "not_started",
            "subtasks": [
                {
                    "task_id": "task_002",
                    "description": "A",
                    "execution_mode": "concurrent",
                    "status": "not_started",
                },
                {
                    "task_id": "task_003",
                    "description": "B",
                    "execution_mode": "serial",
                    "status": "not_started",
                },
            ],
        }

    def test_set_in_progress_updates_status(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())

        mgr.set_in_progress("task_002", "Working on A")
        tree = json.loads(mgr.get())
        assert tree["subtasks"][0]["status"] == "in_progress"

    def test_set_in_progress_with_none_is_noop(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())
        # Should not raise
        mgr.set_in_progress(None, "nothing")

    def test_set_in_progress_with_unknown_id_is_noop(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())
        mgr.set_in_progress("task_999", "nothing")
        tree = json.loads(mgr.get())
        # All statuses should remain not_started
        assert tree["status"] == "not_started"

    def test_set_complete_marks_tasks(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())

        mgr.set_complete(["task_002", "task_003"])
        tree = json.loads(mgr.get())
        assert tree["subtasks"][0]["status"] == "complete"
        assert tree["subtasks"][1]["status"] == "complete"

    def test_set_complete_with_unknown_ids_is_noop(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())
        # Should not raise
        mgr.set_complete(["task_999"])

    def test_trim_task_id_handles_suffixed_ids(self):
        """Gemini sometimes uses task_001_1 for sub-parts of task_001."""
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())

        mgr.set_in_progress("task_002_1", "Part 1 of A")
        tree = json.loads(mgr.get())
        assert tree["subtasks"][0]["status"] == "in_progress"

    def test_complete_persists_to_file_system(self):
        fs = AgentFileSystem()
        mgr = TaskTreeManager(fs)
        mgr.set(self._make_tree())

        mgr.set_complete(["task_002"])
        # Read directly from file system
        content = fs.read_text("/mnt/task_tree.json")
        assert isinstance(content, str)
        parsed = json.loads(content)
        assert parsed["subtasks"][0]["status"] == "complete"
