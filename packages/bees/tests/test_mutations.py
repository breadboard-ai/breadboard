# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for bees.mutations — MutationManager."""

from __future__ import annotations

import asyncio
import json
import pytest
from pathlib import Path

from bees.mutations import MutationManager, PendingMutation
from bees.unified_agent_store import UnifiedAgentStore


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


def _create_task(store: UnifiedAgentStore, status: str = "available", **kwargs) -> str:
    """Create a task and return its ID."""
    task = store.create(objective="Test task", **kwargs)
    task.metadata.status = status
    store.save_metadata(task)
    return task.id


@pytest.fixture
def hive(tmp_path):
    """Create a minimal hive directory."""
    (tmp_path / "mutations").mkdir()
    return tmp_path


@pytest.fixture
def store(hive):
    """A TaskStore rooted at the hive."""
    return UnifiedAgentStore(hive)


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
        asyncio.run(manager.process_all())

        assert list((hive / "agents").iterdir()) == []
        assert list((hive / "logs").iterdir()) == []

    def test_reset_is_cold(self, hive):
        _write_mutation(hive, {"type": "reset"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
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
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        updated = store.get(task_id)
        assert updated.metadata.assignee == "agent"

        response_path = hive / "agents" / task_id / "response.json"
        assert response_path.exists()
        assert json.loads(response_path.read_text())["text"] == "hello"

    def test_respond_missing_task_id(self, hive):
        _write_mutation(hive, {
            "type": "respond-to-task",
            "response": {"text": "hello"},
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        # Should fail gracefully.
        assert outcome.hot_processed == 0

    def test_respond_missing_response(self, hive, store):
        task_id = _create_task(store)
        _write_mutation(hive, {
            "type": "respond-to-task",
            "task_id": task_id,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

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
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1
        assert "a" in outcome.created_tasks
        assert "b" in outcome.created_tasks

        store = UnifiedAgentStore(hive)
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
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1
        store = UnifiedAgentStore(hive)
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
        outcome = asyncio.run(manager.process_inline())

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
        outcome = asyncio.run(manager.process_inline())

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
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        assert store.get(id1).metadata.status == "suspended"
        assert store.get(id1).metadata.paused_from is None
        assert store.get(id2).metadata.status == "available"

    def test_cancel_all_alias(self, hive, store):
        """cancel-all is a backward-compatible alias for pause-all."""
        _create_task(store, status="available")

        _write_mutation(hive, {"type": "cancel-all"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

    def test_resume_cancelled_alias(self, hive, store):
        """resume-cancelled is a backward-compatible alias."""
        id1 = _create_task(store, status="paused")
        task = store.get(id1)
        task.metadata.paused_from = "running"
        store.save_metadata(task)

        _write_mutation(hive, {"type": "resume-cancelled"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

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
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1
        assert store.get(id1).metadata.status == "paused"
        assert store.get(id1).metadata.paused_from == "suspended"
        # Other task should not be affected.
        assert store.get(id2).metadata.status == "available"

    def test_pause_completed_task_fails(self, hive, store):
        id1 = _create_task(store, status="completed")

        _write_mutation(hive, {"type": "pause-task", "task_id": id1})
        manager = MutationManager(hive)
        asyncio.run(manager.process_inline())

        # Should remain completed.
        assert store.get(id1).metadata.status == "completed"

    def test_resume_single_task(self, hive, store):
        id1 = _create_task(store, status="paused")
        task = store.get(id1)
        task.metadata.paused_from = "suspended"
        store.save_metadata(task)

        _write_mutation(hive, {"type": "resume-task", "task_id": id1})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1
        assert store.get(id1).metadata.status == "suspended"
        assert store.get(id1).metadata.paused_from is None

    def test_resume_non_paused_task_fails(self, hive, store):
        id1 = _create_task(store, status="available")

        _write_mutation(hive, {"type": "resume-task", "task_id": id1})
        manager = MutationManager(hive)
        asyncio.run(manager.process_inline())

        # Should remain available.
        assert store.get(id1).metadata.status == "available"

    def test_pause_task_missing_id(self, hive):
        _write_mutation(hive, {"type": "pause-task"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Rollback to Turn
# ---------------------------------------------------------------------------


class TestRollbackToTurn:
    """rollback-to-turn mutation forks a session at a prior turn boundary."""

    def test_rollback_guard_rejects_non_suspended(self, hive, store):
        task_id = _create_task(store, status="available")
        
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": task_id,
            "turn_index": 1,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 0
        
        # Task should remain available
        assert store.get(task_id).metadata.status == "available"

    def test_rollback_successful_fork(self, hive, store):
        # Create a suspended task
        task_id = _create_task(store, status="suspended")
        task = store.get(task_id)
        
        # Set active session ID
        session_id = "test-session-123"
        task.metadata.active_session = session_id
        store.save_metadata(task)

        # Setup the active session directory
        sdir = hive / "agents" / task_id / "sessions" / session_id
        sdir.mkdir(parents=True, exist_ok=True)

        # Create workspace directory
        (sdir / "workspace").mkdir(parents=True, exist_ok=True)
        (sdir / "workspace" / "notes.md").write_text("hello world")

        # Create a mock events.jsonl with two turns
        events_lines = [
            json.dumps({"sendRequest": {"body": {"contents": [{"parts": [{"text": "Objective"}], "role": "user"}]}}}),
            json.dumps({"thought": {"text": "Thought 1"}}),
            json.dumps({"functionCall": {"name": "chat_request_user_input", "args": {"user_message": "hi"}}}),
            json.dumps({"sendRequest": {"body": {"contents": [{"parts": [{"text": "Objective"}], "role": "user"}, {"parts": [{"text": "Thought 1"}], "role": "model"}]}}}),
            json.dumps({"thought": {"text": "Thought 2"}})
        ]
        (sdir / "events.jsonl").write_text("\n".join(events_lines) + "\n", encoding="utf-8")

        # Setup turn checkpoints
        turns_data = [
            {
                "turn": 0,
                "context_length": 1,
                "file_system": None,
                "token_metadata": None
            },
            {
                "turn": 1,
                "context_length": 3,
                "file_system": {
                    "files": {
                        "notes.md": {
                            "data": "hello",
                            "mime_type": "text/plain",
                            "type": "text"
                        }
                    },
                    "routes": {},
                    "file_count": 1
                },
                "token_metadata": None
            }
        ]
        (sdir / "turns.json").write_text(json.dumps(turns_data))

        # Create interaction.json
        interaction_data = {
            "session_id": session_id,
            "contents": [
                {"parts": [{"text": "Objective"}], "role": "user"},
                {"parts": [{"text": "Thought 1"}], "role": "model"},
                {"parts": [{"text": "Action 1"}], "role": "model"},
                {"parts": [{"text": "Result 1"}], "role": "user"},
                {"parts": [{"text": "Thought 2"}], "role": "model"}
            ],
            "file_system": {
                "files": {
                    "notes.md": {
                        "data": "hello world",
                        "mime_type": "text/plain",
                        "type": "text"
                    }
                },
                "routes": {},
                "file_count": 1
            },
            "function_call_part": {},
            "task_tree": {"tree": None},
            "consents_granted": [],
            "flags": {},
            "graph": {},
            "model": "gemini-2.5-pro",
            "completed_function_responses": [],
            "is_precondition_check": False
        }
        (sdir / "interaction.json").write_text(json.dumps(interaction_data))

        # Trigger rollback-to-turn mutation to fork at turn 1 (which has context_length 3)
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": task_id,
            "turn_index": 1,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        # Task metadata should be updated
        updated_task = store.get(task_id)
        assert updated_task.metadata.status == "available"
        new_session_id = updated_task.metadata.active_session
        assert new_session_id != session_id
        assert updated_task.metadata.turns == 1

        # Lineage should be recorded correctly
        old_lineage = json.loads((sdir / "lineage.json").read_text())
        assert old_lineage["forked_to"]["session"] == new_session_id
        assert old_lineage["forked_to"]["at_turn"] == 1

        new_sdir = hive / "agents" / task_id / "sessions" / new_session_id
        new_lineage = json.loads((new_sdir / "lineage.json").read_text())
        assert new_lineage["forked_from"]["session"] == session_id
        assert new_lineage["forked_from"]["at_turn"] == 1

        # New interaction state should be seeded and have dummy resume_id
        new_interaction = json.loads((new_sdir / "interaction.json").read_text())
        assert len(new_interaction["contents"]) == 3
        assert (new_sdir / "resume_id").read_text() == "fork-resume-id"

        # File system workspace should be hydrated correctly to the turn 1 snapshot ("hello")
        assert (new_sdir / "workspace" / "notes.md").read_text() == "hello"

        # Events file should be sliced and copied correctly up to turn 1 (only the first 3 events)
        new_events_content = (new_sdir / "events.jsonl").read_text(encoding="utf-8")
        new_events_lines = new_events_content.splitlines()
        assert len(new_events_lines) == 3
        assert "Thought 1" in new_events_content
        assert "Thought 2" not in new_events_content

    def test_rollback_fork_superseded_session(self, hive, store):
        # Create a suspended task
        task_id = _create_task(store, status="suspended")
        task = store.get(task_id)
        
        # Set active session ID to session_2
        session_1 = "superseded-session-111"
        session_2 = "active-session-222"
        task.metadata.active_session = session_2
        store.save_metadata(task)

        # Setup session_1 directory (superseded)
        sdir_1 = hive / "agents" / task_id / "sessions" / session_1
        sdir_1.mkdir(parents=True, exist_ok=True)
        (sdir_1 / "status").write_text("superseded", encoding="utf-8")
        (sdir_1 / "workspace").mkdir(parents=True, exist_ok=True)
        (sdir_1 / "workspace" / "notes.md").write_text("hello from session 1")

        # Setup turn checkpoints for session_1
        turns_data = [
            {
                "turn": 0,
                "context_length": 1,
                "file_system": None,
                "token_metadata": None
            },
            {
                "turn": 1,
                "context_length": 3,
                "file_system": {
                    "files": {
                        "notes.md": {
                            "data": "hello from session 1",
                            "mime_type": "text/plain",
                            "type": "text"
                        }
                    },
                    "routes": {},
                    "file_count": 1
                },
                "token_metadata": None
            }
        ]
        (sdir_1 / "turns.json").write_text(json.dumps(turns_data))

        # Create interaction.json for session_1
        interaction_data = {
            "session_id": session_1,
            "contents": [
                {"parts": [{"text": "Objective"}], "role": "user"},
                {"parts": [{"text": "Thought 1"}], "role": "model"},
                {"parts": [{"text": "Action 1"}], "role": "model"}
            ],
            "file_system": {
                "files": {
                    "notes.md": {
                        "data": "hello from session 1",
                        "mime_type": "text/plain",
                        "type": "text"
                    }
                },
                "routes": {},
                "file_count": 1
            },
            "function_call_part": {},
            "task_tree": {"tree": None},
            "consents_granted": [],
            "flags": {},
            "graph": {},
            "model": "gemini-2.5-pro",
            "completed_function_responses": [],
            "is_precondition_check": False
        }
        (sdir_1 / "interaction.json").write_text(json.dumps(interaction_data))

        # Setup session_2 directory (active)
        sdir_2 = hive / "agents" / task_id / "sessions" / session_2
        sdir_2.mkdir(parents=True, exist_ok=True)
        (sdir_2 / "status").write_text("suspended", encoding="utf-8")

        # Trigger rollback-to-turn mutation targeting the superseded session_1
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": task_id,
            "turn_index": 1,
            "session_id": session_1,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        # Task metadata should be updated to the new active session ID
        updated_task = store.get(task_id)
        assert updated_task.metadata.status == "available"
        new_session_id = updated_task.metadata.active_session
        assert new_session_id != session_1
        assert new_session_id != session_2
        assert updated_task.metadata.turns == 1

        # The old active session (session_2) should be marked superseded
        assert (sdir_2 / "status").read_text(encoding="utf-8") == "superseded"

        # The cloned source session (session_1) should remain superseded
        assert (sdir_1 / "status").read_text(encoding="utf-8") == "superseded"

        # Lineage for session_1 and new session should link correctly
        old_lineage = json.loads((sdir_1 / "lineage.json").read_text())
        assert old_lineage["forked_to"]["session"] == new_session_id
        assert old_lineage["forked_to"]["at_turn"] == 1

        new_sdir = hive / "agents" / task_id / "sessions" / new_session_id
        new_lineage = json.loads((new_sdir / "lineage.json").read_text())
        assert new_lineage["forked_from"]["session"] == session_1
        assert new_lineage["forked_from"]["at_turn"] == 1

        # File system workspace should hydrate from session_1's snapshot
        assert (new_sdir / "workspace" / "notes.md").read_text() == "hello from session 1"

    def _create_swarm_agent_for_rollback(
        self, hive: Path, *, session_id: str = "test-session-999"
    ) -> tuple[str, Path]:
        """Helper: create a suspended swarm agent with a session, turns, and interaction."""
        from bees.agent import AgentMetadata
        from bees.agent_store import AgentStore

        agent_store = AgentStore(hive)
        agent = agent_store.create(
            type="infinite-poet",
            slug="poet",
            finite=False,
            runner="generate",
        )
        agent.metadata.status = "suspended"
        agent.metadata.active_session = session_id
        agent.metadata.turns = 4
        agent_store.save_metadata(agent)

        # Write objective for backward compat.
        (agent.dir / "objective.md").write_text("Write poems")

        sdir = agent.dir / "sessions" / session_id
        sdir.mkdir(parents=True, exist_ok=True)

        # Minimal interaction state.
        interaction_data = {
            "session_id": session_id,
            "contents": [
                {"parts": [{"text": f"Turn {i}"}], "role": "user"} for i in range(8)
            ],
            "file_system": {"files": {}, "routes": {}, "file_count": 0},
            "function_call_part": {},
            "task_tree": {"tree": None},
            "consents_granted": [],
            "flags": {},
            "graph": {},
            "model": "gemini-2.5-pro",
            "completed_function_responses": [],
            "is_precondition_check": False,
        }
        (sdir / "interaction.json").write_text(json.dumps(interaction_data))

        # Turn checkpoints.
        turns_data = [
            {"turn": i, "context_length": (i + 1) * 2, "file_system": None, "token_metadata": None}
            for i in range(4)
        ]
        (sdir / "turns.json").write_text(json.dumps(turns_data))

        # Events (minimal — one sendRequest per turn).
        events_lines = [
            json.dumps({"sendRequest": {"body": {"contents": [{"parts": [{"text": f"Turn {i}"}], "role": "user"}]}}})
            for i in range(4)
        ]
        (sdir / "events.jsonl").write_text("\n".join(events_lines) + "\n")

        return agent.id, sdir

    def test_rollback_requeues_tasks_after_fork_point(self, tmp_path):
        """Tasks completed after the fork turn revert to available."""
        from bees.task_file_store import TaskFileStore

        hive = tmp_path
        (hive / "mutations").mkdir(parents=True, exist_ok=True)

        agent_id, sdir = self._create_swarm_agent_for_rollback(hive)

        # Create three completed tasks via TaskFileStore.
        task_store = TaskFileStore(hive)
        task_a = task_store.create(objective="Task A", assignee=agent_id)
        task_a.status = "completed"
        task_a.outcome = "Done A"
        task_a.completed_at = "2026-05-01T00:00:00Z"
        task_store.save(task_a)

        task_b = task_store.create(objective="Task B", assignee=agent_id)
        task_b.status = "completed"
        task_b.outcome = "Done B"
        task_b.completed_at = "2026-05-02T00:00:00Z"
        task_store.save(task_b)

        task_c = task_store.create(objective="Task C", assignee=agent_id)
        task_c.status = "completed"
        task_c.outcome = "Done C"
        task_c.completed_at = "2026-05-03T00:00:00Z"
        task_store.save(task_c)

        # Write task_completions.json: A at turn 1, B at turn 2, C at turn 3.
        completions = [
            {"task_id": task_a.id, "turn": 1, "completed_at": task_a.completed_at},
            {"task_id": task_b.id, "turn": 2, "completed_at": task_b.completed_at},
            {"task_id": task_c.id, "turn": 3, "completed_at": task_c.completed_at},
        ]
        (sdir / "task_completions.json").write_text(json.dumps(completions))

        # Rollback to turn 1 — tasks B and C should be re-queued.
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": agent_id,
            "turn_index": 1,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
        assert outcome.hot_processed == 1

        # Task A stays completed (turn 1 <= fork point 1).
        assert task_store.get(task_a.id).status == "completed"
        assert task_store.get(task_a.id).outcome == "Done A"

        # Task B reverts to available (turn 2 > fork point 1).
        reloaded_b = task_store.get(task_b.id)
        assert reloaded_b.status == "available"
        assert reloaded_b.outcome is None
        assert reloaded_b.completed_at is None

        # Task C reverts to available (turn 3 > fork point 1).
        reloaded_c = task_store.get(task_c.id)
        assert reloaded_c.status == "available"
        assert reloaded_c.outcome is None

        # New session should carry only the pre-fork completion (task A).
        from bees.unified_agent_store import UnifiedAgentStore
        store = UnifiedAgentStore(hive)
        agent = store.get(agent_id)
        new_sdir = agent.dir / "sessions" / agent.metadata.active_session
        new_completions = json.loads(
            (new_sdir / "task_completions.json").read_text()
        )
        assert len(new_completions) == 1
        assert new_completions[0]["task_id"] == task_a.id

        # Re-queued tasks should be buffered as pending context updates
        # so the agent receives them on resume.
        pending = agent.metadata.pending_context_updates
        assert pending is not None
        assert len(pending) == 2
        objectives = {u["objective"] for u in pending}
        assert "Task B" in objectives
        assert "Task C" in objectives
        assert all(u["type"] == "task_assigned" for u in pending)

    def test_rollback_no_completions_file_is_backward_compat(self, tmp_path):
        """Rollback works if there's no task_completions.json (legacy/finite agent)."""
        hive = tmp_path
        (hive / "mutations").mkdir(parents=True, exist_ok=True)

        agent_id, sdir = self._create_swarm_agent_for_rollback(hive)

        # No task_completions.json — simulate a legacy or finite agent.
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": agent_id,
            "turn_index": 1,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
        assert outcome.hot_processed == 1

        # Agent should still be rolled back correctly.
        from bees.unified_agent_store import UnifiedAgentStore
        store = UnifiedAgentStore(hive)
        agent = store.get(agent_id)
        assert agent.metadata.status == "available"
        assert agent.metadata.turns == 1

    def test_rollback_all_tasks_before_fork_point(self, tmp_path):
        """When all completions are before the fork point, nothing is re-queued."""
        from bees.task_file_store import TaskFileStore

        hive = tmp_path
        (hive / "mutations").mkdir(parents=True, exist_ok=True)

        agent_id, sdir = self._create_swarm_agent_for_rollback(hive)

        task_store = TaskFileStore(hive)
        task_a = task_store.create(objective="Task A", assignee=agent_id)
        task_a.status = "completed"
        task_a.outcome = "Done A"
        task_a.completed_at = "2026-05-01T00:00:00Z"
        task_store.save(task_a)

        completions = [
            {"task_id": task_a.id, "turn": 1, "completed_at": task_a.completed_at},
        ]
        (sdir / "task_completions.json").write_text(json.dumps(completions))

        # Rollback to turn 2 — task A at turn 1 is before fork point.
        _write_mutation(hive, {
            "type": "rollback-to-turn",
            "task_id": agent_id,
            "turn_index": 2,
        })
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
        assert outcome.hot_processed == 1

        # Task A stays completed.
        assert task_store.get(task_a.id).status == "completed"
        assert task_store.get(task_a.id).outcome == "Done A"


# ---------------------------------------------------------------------------
# Delete task
# ---------------------------------------------------------------------------


class TestDeleteTask:
    """delete-task mutation removes agent directories AND task records."""

    def test_delete_removes_task_records(self, hive, store):
        """Deleting an agent also removes its tasks/*.json files."""
        agent_id = _create_task(store)

        # Verify task records exist.
        tasks_before = store._task_file_store.query_by_assignee(agent_id)
        assert len(tasks_before) == 1

        _write_mutation(hive, {"type": "delete-task", "task_id": agent_id})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        # Agent directory should be gone.
        assert not store.entity_dir(agent_id).exists()

        # Task records should also be gone.
        tasks_after = store._task_file_store.query_by_assignee(agent_id)
        assert tasks_after == []

    def test_delete_recursive_cleans_child_task_records(self, hive, store):
        """Deleting a parent removes task records for all descendants."""
        parent_id = _create_task(store)
        child_id = _create_task(store, parent_task_id=parent_id)

        # Verify both have task records.
        assert len(store._task_file_store.query_by_assignee(parent_id)) == 1
        assert len(store._task_file_store.query_by_assignee(child_id)) == 1

        _write_mutation(hive, {"type": "delete-task", "task_id": parent_id})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

        assert outcome.hot_processed == 1

        # Both agent dirs gone.
        assert not store.entity_dir(parent_id).exists()
        assert not store.entity_dir(child_id).exists()

        # Both task records gone.
        assert store._task_file_store.query_by_assignee(parent_id) == []
        assert store._task_file_store.query_by_assignee(child_id) == []

    def test_delete_missing_task_id(self, hive):
        _write_mutation(hive, {"type": "delete-task"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())
        assert outcome.hot_processed == 0


# ---------------------------------------------------------------------------
# Unknown mutations
# ---------------------------------------------------------------------------


class TestUnknown:
    """Unknown mutation types produce error results."""

    def test_unknown_type(self, hive):
        path = _write_mutation(hive, {"type": "bogus"})
        manager = MutationManager(hive)
        outcome = asyncio.run(manager.process_inline())

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
        asyncio.run(manager.process_inline())

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
