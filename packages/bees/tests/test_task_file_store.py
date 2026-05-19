# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the TaskFileStore CRUD operations."""

from __future__ import annotations

import json
import pytest
from pathlib import Path

from bees.task_file_store import TaskRecord, TaskFileStore


@pytest.fixture
def store(tmp_path: Path) -> TaskFileStore:
    """Create a TaskFileStore backed by a temp directory."""
    return TaskFileStore(tmp_path)


class TestCreate:
    def test_creates_json_file(self, store: TaskFileStore) -> None:
        task = store.create("Find pricing for product X")

        assert task.id
        task_path = store.tasks_dir / f"{task.id}.json"
        assert task_path.exists()

        data = json.loads(task_path.read_text())
        assert data["objective"] == "Find pricing for product X"
        assert data["status"] == "available"
        assert data["kind"] == "work"
        assert "created_at" in data

    def test_with_assignee(self, store: TaskFileStore) -> None:
        task = store.create(
            "Find pricing",
            assignee="agent-123",
            created_by="parent-456",
        )
        assert task.assignee == "agent-123"
        assert task.created_by == "parent-456"

        data = json.loads((store.tasks_dir / f"{task.id}.json").read_text())
        assert data["assignee"] == "agent-123"
        assert data["created_by"] == "parent-456"

    def test_with_all_fields(self, store: TaskFileStore) -> None:
        task = store.create(
            "Compare X vs Y",
            assignee="agent-123",
            created_by="parent-456",
            kind="coordination",
            title="Comparison task",
            context="Additional context here",
            tags=["research", "pricing"],
            depends_on=["task-789"],
        )

        data = json.loads((store.tasks_dir / f"{task.id}.json").read_text())
        assert data["kind"] == "coordination"
        assert data["title"] == "Comparison task"
        assert data["context"] == "Additional context here"
        assert data["tags"] == ["research", "pricing"]
        assert data["depends_on"] == ["task-789"]


class TestGet:
    def test_get_existing(self, store: TaskFileStore) -> None:
        created = store.create("Do something")
        loaded = store.get(created.id)

        assert loaded is not None
        assert loaded.id == created.id
        assert loaded.objective == "Do something"
        assert loaded.status == "available"

    def test_get_nonexistent_returns_none(self, store: TaskFileStore) -> None:
        assert store.get("nonexistent-id") is None

    def test_get_malformed_json_returns_none(self, store: TaskFileStore) -> None:
        store.tasks_dir.mkdir(parents=True, exist_ok=True)
        (store.tasks_dir / "bad.json").write_text("{invalid")
        assert store.get("bad") is None


class TestQueryAll:
    def test_empty_store(self, store: TaskFileStore) -> None:
        assert store.query_all() == []

    def test_returns_all_tasks(self, store: TaskFileStore) -> None:
        store.create("Task A")
        store.create("Task B")

        tasks = store.query_all()
        assert len(tasks) == 2

    def test_filter_by_status(self, store: TaskFileStore) -> None:
        a = store.create("Task A")
        b = store.create("Task B")

        a.status = "completed"
        store.save(a)

        available = store.query_all(status="available")
        assert len(available) == 1
        assert available[0].id == b.id

    def test_skips_non_json_files(self, store: TaskFileStore) -> None:
        store.create("Task A")
        store.tasks_dir.mkdir(parents=True, exist_ok=True)
        (store.tasks_dir / "README.md").write_text("Not a task")

        tasks = store.query_all()
        assert len(tasks) == 1


class TestQueryByAssignee:
    def test_returns_matching_tasks(self, store: TaskFileStore) -> None:
        store.create("Task for agent-1", assignee="agent-1")
        store.create("Task for agent-2", assignee="agent-2")
        store.create("Another for agent-1", assignee="agent-1")

        agent1_tasks = store.query_by_assignee("agent-1")
        assert len(agent1_tasks) == 2

        agent2_tasks = store.query_by_assignee("agent-2")
        assert len(agent2_tasks) == 1

    def test_no_matching_tasks(self, store: TaskFileStore) -> None:
        store.create("Unassigned task")
        assert store.query_by_assignee("agent-x") == []


class TestSave:
    def test_update_status_and_outcome(self, store: TaskFileStore) -> None:
        task = store.create("Find pricing")
        task.status = "completed"
        task.outcome = "Found: $99/month"
        task.completed_at = "2026-05-17T00:00:00Z"
        store.save(task)

        reloaded = store.get(task.id)
        assert reloaded is not None
        assert reloaded.status == "completed"
        assert reloaded.outcome == "Found: $99/month"
        assert reloaded.completed_at == "2026-05-17T00:00:00Z"


class TestTaskRecordRoundTrip:
    def test_to_dict_omits_none(self) -> None:
        task = TaskRecord(id="abc", objective="Do it", status="available")
        d = task.to_dict()
        assert "assignee" not in d
        assert "title" not in d
        assert d["id"] == "abc"
        assert d["objective"] == "Do it"

    def test_from_dict_defaults(self) -> None:
        task = TaskRecord.from_dict({"id": "abc", "objective": "Do it"})
        assert task.status == "available"
        assert task.kind == "work"
        assert task.assignee is None


class TestDelete:
    def test_delete_existing(self, store: TaskFileStore) -> None:
        task = store.create("Find pricing")
        task_path = store.tasks_dir / f"{task.id}.json"
        assert task_path.exists()

        result = store.delete(task.id)
        assert result is True
        assert not task_path.exists()
        assert store.get(task.id) is None

    def test_delete_nonexistent_returns_false(self, store: TaskFileStore) -> None:
        assert store.delete("nonexistent-id") is False


class TestDeleteByAssignee:
    def test_deletes_matching_tasks(self, store: TaskFileStore) -> None:
        store.create("Task 1", assignee="agent-1")
        store.create("Task 2", assignee="agent-1")
        store.create("Task 3", assignee="agent-2")

        deleted = store.delete_by_assignee("agent-1")
        assert len(deleted) == 2

        # Only agent-2's task should remain.
        remaining = store.query_all()
        assert len(remaining) == 1
        assert remaining[0].assignee == "agent-2"

    def test_no_matching_tasks(self, store: TaskFileStore) -> None:
        store.create("Unrelated", assignee="agent-x")
        deleted = store.delete_by_assignee("agent-y")
        assert deleted == []
        assert len(store.query_all()) == 1

