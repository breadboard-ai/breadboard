# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for UnifiedAgentStore operations."""

from __future__ import annotations

import pytest
from pathlib import Path

from bees.unified_agent_store import UnifiedAgentStore


@pytest.fixture
def store(tmp_path: Path) -> UnifiedAgentStore:
    """Create a UnifiedAgentStore backed by a temp directory."""
    return UnifiedAgentStore(tmp_path)


class TestHasPendingTasks:
    def test_no_tasks(self, store: UnifiedAgentStore) -> None:
        assert store.has_pending_tasks("agent-1") is False

    def test_with_pending_tasks(self, store: UnifiedAgentStore) -> None:
        # Create an in_progress task created by agent-1
        store._task_file_store.create(
            objective="Do task 1",
            assignee="agent-2",
            created_by="agent-1",
        )
        # Create a queued task created by agent-1
        task2 = store._task_file_store.create(
            objective="Do task 2",
            assignee="agent-3",
            created_by="agent-1",
        )
        task2.status = "queued"
        store._task_file_store.save(task2)

        # Check has_pending_tasks
        assert store.has_pending_tasks("agent-1") is True

    def test_with_only_completed_or_terminal_tasks(self, store: UnifiedAgentStore) -> None:
        # Create completed and cancelled tasks created by agent-1
        task1 = store._task_file_store.create(
            objective="Do task 1",
            assignee="agent-2",
            created_by="agent-1",
        )
        task1.status = "completed"
        store._task_file_store.save(task1)

        task2 = store._task_file_store.create(
            objective="Do task 2",
            assignee="agent-3",
            created_by="agent-1",
        )
        task2.status = "cancelled"
        store._task_file_store.save(task2)

        # Other agent has active task
        store._task_file_store.create(
            objective="Do task 3",
            assignee="agent-4",
            created_by="agent-other",
        )

        assert store.has_pending_tasks("agent-1") is False
