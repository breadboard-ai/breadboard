# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the agents function group."""

from __future__ import annotations

import pytest
import yaml
from pathlib import Path
from unittest.mock import MagicMock

from bees.functions.agents import _make_handlers
from bees.subagent_scope import SubagentScope
from bees.unified_agent_store import UnifiedAgentStore


GLOBAL_STORE: UnifiedAgentStore | None = None


@pytest.fixture(autouse=True)
def _temp_dirs(tmp_path):
    """Set up a fresh swarm-layout store with config directory."""
    global GLOBAL_STORE
    # Don't create tickets/ — force swarm layout.
    GLOBAL_STORE = UnifiedAgentStore(tmp_path)

    config_dir = tmp_path / "config"
    config_dir.mkdir()
    hooks_dir = config_dir / "hooks"
    hooks_dir.mkdir()

    yield tmp_path


@pytest.fixture
def write_template(tmp_path):
    """Helper to write template entries to the temp TEMPLATES.yaml."""
    templates_path = tmp_path / "config" / "TEMPLATES.yaml"

    def _write(*templates: dict) -> Path:
        templates_path.write_text(
            yaml.dump(list(templates), default_flow_style=False)
        )
        return templates_path

    return _write


def _scheduler_mock():
    """Create a mock scheduler with the global store."""
    mock = MagicMock()
    mock.store = GLOBAL_STORE
    mock.cancel_task = MagicMock(return_value=True)
    mock.deliver_to_task = MagicMock(return_value=None)
    return mock


# ---------------------------------------------------------------------------
# agents_list_types
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_list_types_scoped(write_template):
    write_template(
        {
            "name": "researcher",
            "title": "Researcher",
            "description": "Research agent",
            "objective": "Research things.",
        },
        {
            "name": "writer",
            "title": "Writer",
            "description": "Writing agent",
            "objective": "Write things.",
        },
    )

    caller = GLOBAL_STORE.create("I'm the caller")
    caller.metadata.tasks = ["researcher"]  # Only researcher allowed
    GLOBAL_STORE.save_metadata(caller)

    scope = SubagentScope(workspace_root_id=caller.id)
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        scope=scope, caller_agent_id=caller.id, scheduler=scheduler,
    )

    result = await handlers["agents_list_types"]({}, None)

    assert "agent_types" in result
    assert len(result["agent_types"]) == 1
    assert result["agent_types"][0]["name"] == "researcher"


# ---------------------------------------------------------------------------
# agents_assign_task — implicit creation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_assign_task_creates_new_agent(write_template):
    write_template({
        "name": "writer",
        "title": "Writer",
        "objective": "Write things.",
        "functions": ["files.*", "system.*"],
    })

    caller = GLOBAL_STORE.create("I'm the orchestrator")
    caller.metadata.tasks = ["writer"]
    GLOBAL_STORE.save_metadata(caller)

    scope = SubagentScope(workspace_root_id=caller.id)
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        scope=scope, caller_agent_id=caller.id, scheduler=scheduler,
    )

    result = await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "objective": "Write a haiku about bees",
        "summary": "Haiku Writer",
    }, None)

    assert result["agent_slug"] == "poet"
    assert result["status"] == "created"

    # Verify the child agent was created.
    child = GLOBAL_STORE.find_child_by_slug(caller.id, "poet")
    assert child is not None
    assert child.metadata.parent_id == caller.id
    assert child.metadata.type == "writer"
    assert child.metadata.title == "Haiku Writer"
    assert child.metadata.context == "Write a haiku about bees"


@pytest.mark.asyncio
async def test_agents_assign_task_missing_required_fields(write_template):
    write_template({
        "name": "writer",
        "title": "Writer",
        "objective": "Write things.",
    })

    caller = GLOBAL_STORE.create("I'm the orchestrator")
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=caller.id, scheduler=scheduler,
    )

    # Missing slug
    result = await handlers["agents_assign_task"]({
        "type": "writer",
        "objective": "Write a haiku",
        "summary": "Haiku Writer",
    }, None)
    assert "error" in result

    # Missing objective
    result = await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "summary": "Haiku Writer",
    }, None)
    assert "error" in result


@pytest.mark.asyncio
async def test_agents_assign_task_invalid_type(write_template):
    write_template({
        "name": "writer",
        "title": "Writer",
        "objective": "Write things.",
    })

    caller = GLOBAL_STORE.create("I'm the orchestrator")
    caller.metadata.tasks = ["writer"]
    GLOBAL_STORE.save_metadata(caller)

    scope = SubagentScope(workspace_root_id=caller.id)
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        scope=scope, caller_agent_id=caller.id, scheduler=scheduler,
    )

    result = await handlers["agents_assign_task"]({
        "type": "nonexistent",
        "slug": "poet",
        "objective": "Write a haiku",
        "summary": "Haiku Writer",
    }, None)

    assert "error" in result
    assert "not found" in result["error"]


# ---------------------------------------------------------------------------
# agents_assign_task — fresh instance (terminal slug reuse)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_assign_task_fresh_instance(write_template):
    """A terminal agent with the same slug gets reset for reuse."""
    write_template({
        "name": "writer",
        "title": "Writer",
        "objective": "Write things.",
        "functions": ["files.*", "system.*"],
    })

    caller = GLOBAL_STORE.create("I'm the orchestrator")
    caller.metadata.tasks = ["writer"]
    GLOBAL_STORE.save_metadata(caller)

    scope = SubagentScope(workspace_root_id=caller.id)
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        scope=scope, caller_agent_id=caller.id, scheduler=scheduler,
    )

    # First assignment — creates the agent.
    result1 = await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "objective": "Write haiku #1",
        "summary": "First Haiku",
    }, None)
    assert result1["status"] == "created"

    # Mark the agent as completed (simulating scheduler behavior).
    child = GLOBAL_STORE.find_child_by_slug(caller.id, "poet")
    assert child is not None
    original_id = child.id
    child.metadata.status = "completed"
    child.metadata.outcome = "Done with haiku #1"
    GLOBAL_STORE.save_metadata(child)

    # Second assignment to the same slug — should reuse.
    result2 = await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "objective": "Write haiku #2",
        "summary": "Second Haiku",
    }, None)
    assert result2["status"] == "reused"
    assert result2["agent_slug"] == "poet"

    # Same UUID — slug→UUID mapping is stable.
    reused = GLOBAL_STORE.find_child_by_slug(caller.id, "poet")
    assert reused is not None
    assert reused.id == original_id
    assert reused.metadata.status == "available"
    assert "Write haiku #2" in reused.objective  # reset_for_reuse writes to objective


# ---------------------------------------------------------------------------
# agents_assign_task — busy agent
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_assign_task_busy_agent(write_template):
    """A non-terminal agent returns an error (queuing deferred to Phase 4)."""
    write_template({
        "name": "writer",
        "title": "Writer",
        "objective": "Write things.",
        "functions": ["files.*", "system.*"],
    })

    caller = GLOBAL_STORE.create("I'm the orchestrator")
    caller.metadata.tasks = ["writer"]
    GLOBAL_STORE.save_metadata(caller)

    scope = SubagentScope(workspace_root_id=caller.id)
    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        scope=scope, caller_agent_id=caller.id, scheduler=scheduler,
    )

    # Create agent.
    await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "objective": "Write haiku #1",
        "summary": "First Haiku",
    }, None)

    # Mark as running (not terminal).
    child = GLOBAL_STORE.find_child_by_slug(caller.id, "poet")
    child.metadata.status = "running"
    GLOBAL_STORE.save_metadata(child)

    # Try to assign again — should get error.
    result = await handlers["agents_assign_task"]({
        "type": "writer",
        "slug": "poet",
        "objective": "Write haiku #2",
        "summary": "Second Haiku",
    }, None)

    assert "error" in result
    assert "busy" in result["error"]


# ---------------------------------------------------------------------------
# agents_check_status
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_check_status_by_slug():
    """Status tree uses slug-based naming."""
    parent = GLOBAL_STORE.create("Parent objective")

    child = GLOBAL_STORE.create("Child objective")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "researcher"
    child.metadata.type = "researcher"
    child.metadata.status = "running"
    GLOBAL_STORE.save_metadata(child)

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_check_status"]({}, None)

    assert "agents" in result
    agents = result["agents"]
    assert len(agents) == 1
    assert agents[0]["agent_slug"] == "researcher"
    assert agents[0]["status"] == "running"


@pytest.mark.asyncio
async def test_agents_check_status_empty():
    parent = GLOBAL_STORE.create("Parent objective")

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_check_status"]({}, None)
    assert result["message"] == "There are no agents."


@pytest.mark.asyncio
async def test_agents_check_status_nested_tree():
    """Nested children appear in the tree."""
    root = GLOBAL_STORE.create("Root")

    child = GLOBAL_STORE.create("Child")
    child.metadata.parent_id = root.id
    child.metadata.slug = "orchestrator"
    child.metadata.type = "orchestrator"
    child.metadata.status = "suspended"
    GLOBAL_STORE.save_metadata(child)

    grandchild = GLOBAL_STORE.create("Grandchild")
    grandchild.metadata.parent_id = child.id
    grandchild.metadata.slug = "orchestrator/worker"
    grandchild.metadata.type = "worker"
    grandchild.metadata.status = "completed"
    grandchild.metadata.outcome = "Done!"
    GLOBAL_STORE.save_metadata(grandchild)

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=root.id, scheduler=scheduler,
    )

    result = await handlers["agents_check_status"]({}, None)

    assert len(result["agents"]) == 1
    orch = result["agents"][0]
    assert orch["agent_slug"] == "orchestrator"
    assert "agents" in orch
    assert len(orch["agents"]) == 1
    assert orch["agents"][0]["agent_slug"] == "worker"
    assert orch["agents"][0]["outcome"] == "Done!"


# ---------------------------------------------------------------------------
# agents_send_event
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_send_event_by_slug():
    parent = GLOBAL_STORE.create("Parent")

    child = GLOBAL_STORE.create("Child")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "researcher"
    child.metadata.status = "suspended"
    GLOBAL_STORE.save_metadata(child)

    scheduler = _scheduler_mock()
    scope = SubagentScope(workspace_root_id=parent.id)
    handlers = _make_handlers(
        scope=scope, caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_send_event"]({
        "slug": "researcher",
        "type": "clarification",
        "message": "Please focus on pricing",
    }, None)

    assert result["delivered"] is True
    assert result["agent_slug"] == "researcher"
    scheduler.deliver_to_task.assert_called_once()
    call_args = scheduler.deliver_to_task.call_args
    assert call_args[0][0] == child.id


@pytest.mark.asyncio
async def test_agents_send_event_not_found():
    parent = GLOBAL_STORE.create("Parent")

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_send_event"]({
        "slug": "nonexistent",
        "type": "clarification",
        "message": "Hello",
    }, None)

    assert "error" in result
    assert "not found" in result["error"]


# ---------------------------------------------------------------------------
# agents_cancel
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_cancel_by_slug():
    parent = GLOBAL_STORE.create("Parent")

    child = GLOBAL_STORE.create("Child")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "researcher"
    child.metadata.status = "running"
    GLOBAL_STORE.save_metadata(child)

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_cancel"]({
        "slug": "researcher",
    }, None)

    assert result["cancelled"] is True
    assert result["agent_slug"] == "researcher"
    scheduler.cancel_task.assert_called_once_with(child.id)


@pytest.mark.asyncio
async def test_agents_cancel_not_found():
    parent = GLOBAL_STORE.create("Parent")

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=parent.id, scheduler=scheduler,
    )

    result = await handlers["agents_cancel"]({
        "slug": "nonexistent",
    }, None)

    assert "error" in result
    assert "not found" in result["error"]


# ---------------------------------------------------------------------------
# agents_await
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_agents_await_with_pending_updates():
    """agents_await returns immediately when context updates are buffered."""
    from bees.protocols.handler_types import CONTEXT_PARTS_KEY

    caller = GLOBAL_STORE.create("I'm the caller")
    caller.metadata.pending_context_updates = [
        {"type": "task_completed", "message": "Agent done"},
    ]
    GLOBAL_STORE.save_metadata(caller)

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=caller.id, scheduler=scheduler,
    )

    result = await handlers["agents_await"]({}, None)

    assert result["resumed"] is True
    assert CONTEXT_PARTS_KEY in result

    fresh = GLOBAL_STORE.get(caller.id)
    assert fresh.metadata.pending_context_updates == []


@pytest.mark.asyncio
async def test_agents_await_suspends_when_no_updates():
    """agents_await raises SuspendError when no updates are pending."""
    from bees.protocols.handler_types import SuspendError

    caller = GLOBAL_STORE.create("I'm the caller")
    caller.metadata.pending_context_updates = []
    GLOBAL_STORE.save_metadata(caller)

    scheduler = _scheduler_mock()
    handlers = _make_handlers(
        caller_agent_id=caller.id, scheduler=scheduler,
    )

    with pytest.raises(SuspendError) as exc_info:
        await handlers["agents_await"]({}, None)

    fc = exc_info.value.function_call_part
    assert fc["functionCall"]["name"] == "agents_await"


# ---------------------------------------------------------------------------
# UnifiedAgentStore — find_child_by_slug / reset_for_reuse
# ---------------------------------------------------------------------------


def test_find_child_by_slug():
    parent = GLOBAL_STORE.create("Parent")

    child = GLOBAL_STORE.create("Child")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "researcher"
    GLOBAL_STORE.save_metadata(child)

    found = GLOBAL_STORE.find_child_by_slug(parent.id, "researcher")
    assert found is not None
    assert found.id == child.id


def test_find_child_by_slug_not_found():
    parent = GLOBAL_STORE.create("Parent")
    found = GLOBAL_STORE.find_child_by_slug(parent.id, "nonexistent")
    assert found is None


def test_find_child_by_slug_nested_path():
    """Slug stored as 'app/tests' should match tail segment 'tests'."""
    parent = GLOBAL_STORE.create("Parent")

    child = GLOBAL_STORE.create("Child")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "app/tests"
    GLOBAL_STORE.save_metadata(child)

    found = GLOBAL_STORE.find_child_by_slug(parent.id, "tests")
    assert found is not None
    assert found.id == child.id


def test_reset_for_reuse():
    parent = GLOBAL_STORE.create("Parent")

    child = GLOBAL_STORE.create("Child objective #1")
    child.metadata.parent_id = parent.id
    child.metadata.slug = "poet"
    child.metadata.status = "completed"
    child.metadata.outcome = "Old outcome"
    child.metadata.turns = 5
    GLOBAL_STORE.save_metadata(child)

    original_session = child.metadata.active_session

    GLOBAL_STORE.reset_for_reuse(
        child,
        "New objective #2",
        title="New Title",
    )

    # Verify reset.
    assert child.metadata.status == "available"
    assert child.metadata.outcome is None
    assert child.metadata.error is None
    assert child.metadata.turns == 0
    assert child.metadata.active_session != original_session
    assert child.objective == "New objective #2"
    assert child.metadata.title == "New Title"


def test_reset_for_reuse_rejects_non_terminal():
    child = GLOBAL_STORE.create("Child")
    child.metadata.status = "running"
    GLOBAL_STORE.save_metadata(child)

    with pytest.raises(ValueError, match="not terminal"):
        GLOBAL_STORE.reset_for_reuse(child, "New objective")
