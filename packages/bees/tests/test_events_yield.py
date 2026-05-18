# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for events_yield — the infinite agent yield+suspend primitive."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from bees.agent import Agent, AgentMetadata
from bees.functions.events import _make_handlers
from bees.protocols.handler_types import CONTEXT_PARTS_KEY, SuspendError
from bees.subagent_scope import SubagentScope
from bees.task_file_store import TaskFileStore
from bees.unified_agent_store import UnifiedAgentStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_agent(
    hive_dir: Path,
    *,
    agent_id: str = "agent-111",
    slug: str = "researcher",
    finite: bool = False,
    status: str = "running",
    parent_id: str | None = None,
    pending_context_updates: list | None = None,
) -> Agent:
    """Create a minimal agent directory and return an Agent object."""
    agent_dir = hive_dir / "agents" / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)
    meta = AgentMetadata(
        type="researcher",
        slug=slug,
        status=status,
        finite=finite,
        parent_id=parent_id,
        pending_context_updates=pending_context_updates,
    )
    (agent_dir / "metadata.json").write_text(
        json.dumps(meta.to_dict(), indent=2)
    )
    (agent_dir / "objective.md").write_text("role objective")
    return Agent(id=agent_id, dir=agent_dir, metadata=meta, objective="role objective")


def _make_in_progress_task(store: UnifiedAgentStore, agent_id: str = "agent-111"):
    """Create an in-progress task assigned to the agent via the store's TaskFileStore."""
    task_file_store = store._task_file_store
    task = task_file_store.create(
        objective="Find pricing",
        assignee=agent_id,
        created_by="parent-000",
        kind="work",
        title="Pricing Research",
    )
    # Manually set task status to in_progress (simulates agent running).
    task.status = "in_progress"
    task_file_store.save(task)
    return task_file_store, task


def _mock_scheduler(store: UnifiedAgentStore):
    """Create a mock scheduler backed by the given store."""
    scheduler = MagicMock()
    scheduler.store = store
    return scheduler


# ---------------------------------------------------------------------------
# events_yield — core flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_events_yield_marks_task_completed(tmp_path):
    """events_yield finds the in-progress task and marks it completed."""
    agent = _make_agent(tmp_path)
    store = UnifiedAgentStore(tmp_path)
    task_file_store, task = _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=MagicMock(),
    )

    with pytest.raises(SuspendError):
        await handlers["events_yield"](
            {"outcome": "Found pricing: $99/month"}, None,
        )

    # Verify task record is updated.
    updated = task_file_store.get(task.id)
    assert updated is not None
    assert updated.status == "completed"
    assert updated.outcome == "Found pricing: $99/month"
    assert updated.completed_at is not None


@pytest.mark.asyncio
async def test_events_yield_delivers_to_parent(tmp_path):
    """events_yield calls deliver_to_parent with the completion update."""
    agent = _make_agent(tmp_path)
    store = UnifiedAgentStore(tmp_path)
    _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    deliver = MagicMock()
    scope = SubagentScope(workspace_root_id="r", slug_path="researcher")
    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=deliver,
        scope=scope,
    )

    with pytest.raises(SuspendError):
        await handlers["events_yield"](
            {"outcome": "Done"}, None,
        )

    deliver.assert_called_once()
    payload = deliver.call_args[0][0]
    assert payload["status"] == "completed"
    assert payload["outcome"] == "Done"
    assert payload["type"] == "task_completed"
    assert payload["from_slug"] == "researcher"


@pytest.mark.asyncio
async def test_events_yield_suspends_when_no_pending(tmp_path):
    """events_yield raises SuspendError when no pending context updates."""
    agent = _make_agent(tmp_path)
    store = UnifiedAgentStore(tmp_path)
    _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=MagicMock(),
    )

    with pytest.raises(SuspendError) as exc_info:
        await handlers["events_yield"](
            {"outcome": "Done"}, None,
        )

    # Verify the SuspendError carries the right function call.
    suspend = exc_info.value
    assert suspend.function_call_part["functionCall"]["name"] == "events_yield"


@pytest.mark.asyncio
async def test_events_yield_returns_immediately_with_pending_updates(tmp_path):
    """events_yield returns buffered updates without suspending."""
    pending = [{"type": "task_assigned", "objective": "Next task"}]
    agent = _make_agent(
        tmp_path, pending_context_updates=pending,
    )
    store = UnifiedAgentStore(tmp_path)
    _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=MagicMock(),
    )

    # Should NOT raise SuspendError — updates are pending.
    result = await handlers["events_yield"](
        {"outcome": "Done"}, None,
    )

    assert result["resumed"] is True
    assert CONTEXT_PARTS_KEY in result

    # Verify pending_context_updates are cleared.
    refreshed = store.get("agent-111")
    assert not refreshed.metadata.pending_context_updates


@pytest.mark.asyncio
async def test_events_yield_sets_agent_outcome(tmp_path):
    """events_yield sets the outcome on agent metadata."""
    agent = _make_agent(tmp_path)
    store = UnifiedAgentStore(tmp_path)
    _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=MagicMock(),
    )

    with pytest.raises(SuspendError):
        await handlers["events_yield"](
            {"outcome": "Analysis complete"}, None,
        )

    refreshed = store.get("agent-111")
    assert refreshed.metadata.outcome == "Analysis complete"


@pytest.mark.asyncio
async def test_events_yield_records_task_completion(tmp_path):
    """events_yield writes a task_completions.json entry for rollback."""
    agent = _make_agent(tmp_path)
    # Create a session directory so the recording has somewhere to write.
    session_id = "test-session-111"
    agent_dir = tmp_path / "agents" / "agent-111"
    session_dir = agent_dir / "sessions" / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    # Set the agent's active_session and turns metadata.
    meta = agent.metadata
    meta.active_session = session_id
    meta.turns = 3
    (agent_dir / "metadata.json").write_text(
        json.dumps(meta.to_dict(), indent=2)
    )

    store = UnifiedAgentStore(tmp_path)
    task_file_store, task = _make_in_progress_task(store)
    scheduler = _mock_scheduler(store)

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=MagicMock(),
    )

    with pytest.raises(SuspendError):
        await handlers["events_yield"](
            {"outcome": "Done"}, None,
        )

    # Verify task_completions.json was created in the session directory.
    completions_file = session_dir / "task_completions.json"
    assert completions_file.exists()

    completions = json.loads(completions_file.read_text())
    assert len(completions) == 1
    assert completions[0]["task_id"] == task.id
    assert completions[0]["turn"] == 3
    assert completions[0]["completed_at"] is not None


# ---------------------------------------------------------------------------
# events_yield — error cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_events_yield_requires_outcome(tmp_path):
    """events_yield returns an error if outcome is empty."""
    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=MagicMock(),
    )

    result = await handlers["events_yield"]({"outcome": ""}, None)
    assert "error" in result


@pytest.mark.asyncio
async def test_events_yield_requires_scheduler():
    """events_yield returns an error if scheduler is not available."""
    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=None,
    )

    result = await handlers["events_yield"](
        {"outcome": "Done"}, None,
    )
    assert "error" in result


@pytest.mark.asyncio
async def test_events_yield_no_active_task_still_delivers(tmp_path):
    """events_yield works even if no in-progress task is found.

    This can happen on the first yield (task may still be 'available').
    The yield still delivers to parent and suspends.
    """
    agent = _make_agent(tmp_path)
    store = UnifiedAgentStore(tmp_path)
    scheduler = _mock_scheduler(store)
    deliver = MagicMock()

    handlers = _make_handlers(
        caller_agent_id="agent-111",
        scheduler=scheduler,
        deliver_to_parent=deliver,
    )

    with pytest.raises(SuspendError):
        await handlers["events_yield"](
            {"outcome": "Done"}, None,
        )

    # Parent still gets the delivery.
    deliver.assert_called_once()


# ---------------------------------------------------------------------------
# Task queueing in agents_assign_task
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_assign_task_queues_for_infinite_agent(tmp_path):
    """agents_assign_task queues a task for a non-terminal infinite agent."""
    from bees.functions.agents import _make_handlers as _make_agent_handlers

    # Create parent agent first.
    parent = _make_agent(
        tmp_path,
        agent_id="parent-000",
        slug="orchestrator",
        finite=True,
    )

    # Create an infinite agent that's currently suspended, with parent_id set.
    agent = _make_agent(
        tmp_path,
        agent_id="child-222",
        slug="deep-dive",
        finite=False,
        status="suspended",
        parent_id="parent-000",
    )

    store = UnifiedAgentStore(tmp_path)
    scheduler = _mock_scheduler(store)
    scheduler.deliver_to_task = MagicMock(return_value=None)

    # Create the playbook data that load_playbook would return.
    import yaml
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    templates = [
        {
            "name": "researcher",
            "title": "Researcher",
            "objective": "You are a researcher. {{system.context}}",
            "functions": ["files.*", "events.*"],
        }
    ]
    (config_dir / "TEMPLATES.yaml").write_text(
        yaml.dump(templates, sort_keys=False)
    )

    handlers = _make_agent_handlers(
        caller_agent_id="parent-000",
        scheduler=scheduler,
    )

    result = await handlers["agents_assign_task"](
        {
            "type": "researcher",
            "slug": "deep-dive",
            "objective": "Find pricing for X",
            "summary": "Pricing Research",
        },
        None,
    )

    assert result.get("status") == "queued"
    assert result.get("agent_slug") == "deep-dive"

    # Verify task record was created.
    task_file_store = store._task_file_store
    tasks = task_file_store.query_by_assignee("child-222")
    assert len(tasks) >= 1
    queued_task = tasks[0]
    assert queued_task.objective == "Find pricing for X"

    # Verify context update was delivered.
    scheduler.deliver_to_task.assert_called_once()
    call_args = scheduler.deliver_to_task.call_args
    assert call_args[0][0] == "child-222"
    update = call_args[0][1]
    assert update["type"] == "task_assigned"
    assert update["objective"] == "Find pricing for X"


@pytest.mark.asyncio
async def test_assign_task_rejects_busy_finite_agent(tmp_path):
    """agents_assign_task returns an error for a non-terminal finite agent."""
    from bees.functions.agents import _make_handlers as _make_agent_handlers

    # Create parent agent first.
    parent = _make_agent(
        tmp_path,
        agent_id="parent-000",
        slug="orchestrator",
        finite=True,
    )

    # Create a finite agent that's currently running, with parent_id set.
    agent = _make_agent(
        tmp_path,
        agent_id="child-333",
        slug="writer",
        finite=True,
        status="running",
        parent_id="parent-000",
    )

    store = UnifiedAgentStore(tmp_path)
    scheduler = _mock_scheduler(store)

    import yaml
    config_dir = tmp_path / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    templates = [
        {
            "name": "writer",
            "title": "Writer",
            "objective": "Write something.",
            "functions": ["files.*", "system.*"],
        }
    ]
    (config_dir / "TEMPLATES.yaml").write_text(
        yaml.dump(templates, sort_keys=False)
    )

    handlers = _make_agent_handlers(
        caller_agent_id="parent-000",
        scheduler=scheduler,
    )

    result = await handlers["agents_assign_task"](
        {
            "type": "writer",
            "slug": "writer",
            "objective": "Write a poem",
            "summary": "Poem",
        },
        None,
    )

    assert "error" in result
    assert "busy" in result["error"]
