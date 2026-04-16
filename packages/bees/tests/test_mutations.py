# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for bees.mutations — MutationManager."""

from __future__ import annotations

import json
import pytest
from pathlib import Path

from bees.mutations import MutationManager, PendingMutation
from bees.task_store import TaskStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_mutation(hive_dir: Path, data: dict) -> Path:
    """Write a mutation JSON file and return its path."""
    mutations_dir = hive_dir / "mutations"
    mutations_dir.mkdir(parents=True, exist_ok=True)
    import uuid

    path = mutations_dir / f"{uuid.uuid4()}.json"
    path.write_text(json.dumps(data))
    return path


def _create_task(store: TaskStore, status: str = "available", **kwargs) -> str:
    """Create a task and return its ID."""
    task = store.create(objective="Test task", **kwargs)
    task.metadata.status = status
    store.save_metadata(task)
    return task.id


@pytest.fixture
def hive(tmp_path):
    """Create a minimal hive directory."""
    (tmp_path / "tickets").mkdir()
    (tmp_path / "mutations").mkdir()
    return tmp_path


@pytest.fixture
def store(hive):
    """A TaskStore rooted at the hive."""
    return TaskStore(hive)


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------


class TestScanning:
    """Pending mutation scanning."""

    def test_scan_empty(self, hive):
        manager = MutationManager(hive)
        assert manager._scan_pending() == []

    def test_scan_finds_unprocessed(self, hive):
        _write_mutation(hive, {"type": "respond-to-task", "task_id": "abc"})
        manager = MutationManager(hive)
        pending = manager._scan_pending()
        assert len(pending) == 1
        assert pending[0].mutation_type == "respond-to-task"

    def test_scan_skips_processed(self, hive):
        path = _write_mutation(hive, {"type": "reset"})
        # Write result file.
        result_path = path.with_suffix("").with_suffix(".result.json")
        result_path.write_text(json.dumps({"status": "ok"}))

        manager = MutationManager(hive)
        assert manager._scan_pending() == []

    def test_scan_skips_malformed(self, hive):
        mutations_dir = hive / "mutations"
        bad = mutations_dir / "bad.json"
        bad.write_text(json.dumps({"no_type": True}))

        manager = MutationManager(hive)
        pending = manager._scan_pending()
        assert len(pending) == 0

        # Should have written an error result.
        result = bad.with_suffix("").with_suffix(".result.json")
        assert result.exists()


# ---------------------------------------------------------------------------
# Reset (cold)
# ---------------------------------------------------------------------------


class TestReset:
    """Reset mutation clears tickets, logs, and mutations."""

    def test_reset_clears_dirs(self, hive, store):
        _create_task(store)
        (hive / "logs").mkdir()
        (hive / "logs" / "session.log").write_text("log")

        _write_mutation(hive, {"type": "reset"})
        manager = MutationManager(hive)
        manager.process_all()

        assert list((hive / "tickets").iterdir()) == []
        assert list((hive / "logs").iterdir()) == []

    def test_reset_is_cold(self, hive):
        _write_mutation(hive, {"type": "reset"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()
        assert outcome.cold_pending is True
        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Respond
# ---------------------------------------------------------------------------


class TestRespond:
    """respond-to-task mutation writes a response and flips assignee."""

    def test_respond_writes_response(self, hive, store):
        task_id = _create_task(store, status="suspended")
        task = store.get(task_id)
        task.metadata.assignee = "user"
        store.save_metadata(task)

        _write_mutation(hive, {
            "type": "respond-to-task",
            "task_id": task_id,
            "response": {"text": "hello"},
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1

        updated = store.get(task_id)
        assert updated.metadata.assignee == "agent"

        response_path = hive / "tickets" / task_id / "response.json"
        assert response_path.exists()
        assert json.loads(response_path.read_text())["text"] == "hello"

    def test_respond_missing_task_id(self, hive):
        _write_mutation(hive, {
            "type": "respond-to-task",
            "response": {"text": "hello"},
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        # Should fail gracefully.
        assert outcome.hot_processed == 0

    def test_respond_missing_response(self, hive, store):
        task_id = _create_task(store)
        _write_mutation(hive, {
            "type": "respond-to-task",
            "task_id": task_id,
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Create task group
# ---------------------------------------------------------------------------


class TestCreateGroup:
    """create-task-group mutation creates multiple tasks with ref resolution."""

    def test_basic_group(self, hive):
        _write_mutation(hive, {
            "type": "create-task-group",
            "tasks": [
                {"ref": "a", "objective": "First task"},
                {"ref": "b", "objective": "Second task"},
            ],
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1
        assert "a" in outcome.created_tasks
        assert "b" in outcome.created_tasks

        store = TaskStore(hive)
        task_a = store.get(outcome.created_tasks["a"])
        assert task_a is not None
        assert "First task" in task_a.objective

    def test_group_with_dependencies(self, hive):
        _write_mutation(hive, {
            "type": "create-task-group",
            "tasks": [
                {"ref": "a", "objective": "First"},
                {
                    "ref": "b",
                    "objective": "Second",
                    "depends_on": ["a"],
                },
            ],
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1
        store = TaskStore(hive)
        task_b = store.get(outcome.created_tasks["b"])
        assert task_b.metadata.status == "blocked"
        assert outcome.created_tasks["a"] in task_b.metadata.depends_on

    def test_group_unresolved_ref_fails(self, hive):
        _write_mutation(hive, {
            "type": "create-task-group",
            "tasks": [
                {
                    "ref": "b",
                    "objective": "Depends on nothing",
                    "depends_on": ["nonexistent"],
                },
            ],
        })
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Pause / Resume (all)
# ---------------------------------------------------------------------------


class TestPauseAll:
    """pause-all and resume-paused mutations."""

    def test_pause_all(self, hive, store):
        id1 = _create_task(store, status="available")
        id2 = _create_task(store, status="running")
        id3 = _create_task(store, status="suspended")
        id4 = _create_task(store, status="completed")

        _write_mutation(hive, {"type": "pause-all"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1

        assert store.get(id1).metadata.status == "paused"
        assert store.get(id1).metadata.paused_from == "available"
        assert store.get(id2).metadata.status == "paused"
        assert store.get(id2).metadata.paused_from == "running"
        assert store.get(id3).metadata.status == "paused"
        assert store.get(id3).metadata.paused_from == "suspended"
        # Completed task should not be paused.
        assert store.get(id4).metadata.status == "completed"

    def test_resume_paused(self, hive, store):
        id1 = _create_task(store, status="paused")
        task1 = store.get(id1)
        task1.metadata.paused_from = "suspended"
        store.save_metadata(task1)

        id2 = _create_task(store, status="paused")
        task2 = store.get(id2)
        task2.metadata.paused_from = "available"
        store.save_metadata(task2)

        _write_mutation(hive, {"type": "resume-paused"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1

        assert store.get(id1).metadata.status == "suspended"
        assert store.get(id1).metadata.paused_from is None
        assert store.get(id2).metadata.status == "available"

    def test_cancel_all_alias(self, hive, store):
        """cancel-all is a backward-compatible alias for pause-all."""
        _create_task(store, status="available")

        _write_mutation(hive, {"type": "cancel-all"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1

    def test_resume_cancelled_alias(self, hive, store):
        """resume-cancelled is a backward-compatible alias."""
        id1 = _create_task(store, status="paused")
        task = store.get(id1)
        task.metadata.paused_from = "running"
        store.save_metadata(task)

        _write_mutation(hive, {"type": "resume-cancelled"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1
        assert store.get(id1).metadata.status == "running"


# ---------------------------------------------------------------------------
# Pause / Resume (single task)
# ---------------------------------------------------------------------------


class TestPauseTask:
    """pause-task and resume-task mutations."""

    def test_pause_single_task(self, hive, store):
        id1 = _create_task(store, status="suspended")
        id2 = _create_task(store, status="available")

        _write_mutation(hive, {"type": "pause-task", "task_id": id1})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1
        assert store.get(id1).metadata.status == "paused"
        assert store.get(id1).metadata.paused_from == "suspended"
        # Other task should not be affected.
        assert store.get(id2).metadata.status == "available"

    def test_pause_completed_task_fails(self, hive, store):
        id1 = _create_task(store, status="completed")

        _write_mutation(hive, {"type": "pause-task", "task_id": id1})
        manager = MutationManager(hive)
        manager.process_inline()

        # Should remain completed.
        assert store.get(id1).metadata.status == "completed"

    def test_resume_single_task(self, hive, store):
        id1 = _create_task(store, status="paused")
        task = store.get(id1)
        task.metadata.paused_from = "suspended"
        store.save_metadata(task)

        _write_mutation(hive, {"type": "resume-task", "task_id": id1})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 1
        assert store.get(id1).metadata.status == "suspended"
        assert store.get(id1).metadata.paused_from is None

    def test_resume_non_paused_task_fails(self, hive, store):
        id1 = _create_task(store, status="available")

        _write_mutation(hive, {"type": "resume-task", "task_id": id1})
        manager = MutationManager(hive)
        manager.process_inline()

        # Should remain available.
        assert store.get(id1).metadata.status == "available"

    def test_pause_task_missing_id(self, hive):
        _write_mutation(hive, {"type": "pause-task"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()
        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Unknown mutations
# ---------------------------------------------------------------------------


class TestUnknown:
    """Unknown mutation types produce error results."""

    def test_unknown_type(self, hive):
        path = _write_mutation(hive, {"type": "bogus"})
        manager = MutationManager(hive)
        outcome = manager.process_inline()

        assert outcome.hot_processed == 0

        result_path = path.with_suffix("").with_suffix(".result.json")
        assert result_path.exists()
        result = json.loads(result_path.read_text())
        assert result["status"] == "error"
        assert "Unknown" in result["error"]


# ---------------------------------------------------------------------------
# Result writing
# ---------------------------------------------------------------------------


class TestResultWriting:
    """Result files are written with correct structure."""

    def test_result_includes_timestamp(self, hive, store):
        _create_task(store, status="available")
        _write_mutation(hive, {"type": "pause-all"})
        manager = MutationManager(hive)
        manager.process_inline()

        results = list((hive / "mutations").glob("*.result.json"))
        assert len(results) == 1
        result = json.loads(results[0].read_text())
        assert result["status"] == "ok"
        assert "timestamp" in result


# ---------------------------------------------------------------------------
# PendingMutation dataclass
# ---------------------------------------------------------------------------


class TestPendingMutation:
    """PendingMutation properties."""

    def test_mutation_type(self):
        m = PendingMutation(path=Path("/x.json"), data={"type": "reset"})
        assert m.mutation_type == "reset"

    def test_is_cold(self):
        m = PendingMutation(path=Path("/x.json"), data={"type": "reset"})
        assert m.is_cold is True

    def test_is_hot(self):
        m = PendingMutation(path=Path("/x.json"), data={"type": "pause-all"})
        assert m.is_cold is False

    def test_result_path(self):
        m = PendingMutation(path=Path("/mutations/abc.json"), data={"type": "reset"})
        assert m.result_path == Path("/mutations/abc.result.json")


# ---------------------------------------------------------------------------
# Sentinel lifecycle
# ---------------------------------------------------------------------------


class TestSentinel:
    """Box-active sentinel file lifecycle."""

    def test_activate_creates_sentinel(self, hive):
        manager = MutationManager(hive)
        manager.activate()
        sentinel = hive / "mutations" / ".box-active"
        assert sentinel.exists()
        assert "pid=" in sentinel.read_text()

    def test_deactivate_removes_sentinel(self, hive):
        manager = MutationManager(hive)
        manager.activate()
        manager.deactivate()
        sentinel = hive / "mutations" / ".box-active"
        assert not sentinel.exists()

    def test_deactivate_without_activate(self, hive):
        """Deactivating without prior activation should not raise."""
        manager = MutationManager(hive)
        manager.deactivate()  # Should not raise.

    def test_sentinel_ignored_by_scanning(self, hive):
        """The sentinel file should not appear as a pending mutation."""
        manager = MutationManager(hive)
        manager.activate()
        pending = manager._scan_pending()
        assert len(pending) == 0
