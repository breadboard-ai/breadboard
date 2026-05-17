# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the tasks function group."""

from __future__ import annotations

import asyncio
import pytest
import yaml
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock

from bees.functions.tasks import _make_handlers
from bees.subagent_scope import SubagentScope
from bees.task_store import TaskStore


GLOBAL_STORE = None

@pytest.fixture(autouse=True)
def _temp_dirs(tmp_path):
    """Redirect ticket and template storage to temp directories."""
    global GLOBAL_STORE
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    GLOBAL_STORE = TaskStore(tmp_path)

    config_dir = tmp_path / "config"
    config_dir.mkdir()
    templates_path = config_dir / "TEMPLATES.yaml"
    hooks_dir = config_dir / "hooks"
    hooks_dir.mkdir()

    yield tickets_dir


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


@pytest.mark.asyncio
async def test_tasks_list_types_scoped(write_template):
    write_template(
        {
            "name": "task-a",
            "title": "Task A",
            "description": "Description A",

            "objective": "Do it.",
        },
        {
            "name": "task-b",
            "title": "Task B",
            "description": "Description B",

            "objective": "Do it.",
        },
    )

    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.tasks = ["task-a"]  # Only task-a is allowed
    GLOBAL_STORE.save_metadata(ticket)

    scope = SubagentScope(workspace_root_id=ticket.id)
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id, scheduler=mock_scheduler)

    result = await handlers["tasks_list_types"]({}, None)

    assert "task_types" in result
    task_types = result["task_types"]
    assert len(task_types) == 1
    assert task_types[0]["name"] == "task-a"
    assert task_types[0]["title"] == "Task A"
    assert task_types[0]["description"] == "Description A"


@pytest.mark.asyncio
async def test_tasks_list_types_filters_by_allowlist(write_template):
    # Templates not in the caller's allowlist should not appear.
    write_template(
        {
            "name": "allowed-task",
            "title": "Allowed Task",
            "description": "I am allowed",
            "objective": "Do it.",
        },
        {
            "name": "not-allowed-task",
            "title": "Not Allowed Task",
            "description": "I am not allowed",
            "objective": "Do it.",
        },
    )

    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.tasks = ["allowed-task"]  # Only allowed-task
    GLOBAL_STORE.save_metadata(ticket)

    scope = SubagentScope(workspace_root_id=ticket.id)
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id, scheduler=mock_scheduler)

    result = await handlers["tasks_list_types"]({}, None)

    assert "task_types" in result
    assert len(result["task_types"]) == 1
    assert result["task_types"][0]["name"] == "allowed-task"


@pytest.mark.asyncio
async def test_tasks_check_status(write_template):
    task_ticket = GLOBAL_STORE.create("Do something")
    task_ticket.metadata.parent_task_id = "caller-id"
    task_ticket.metadata.title = "My Task"
    task_ticket.metadata.status = "running"
    GLOBAL_STORE.save_metadata(task_ticket)

    other_ticket = GLOBAL_STORE.create("Do something else")
    other_ticket.metadata.parent_task_id = "other-id"
    GLOBAL_STORE.save_metadata(other_ticket)

    scope = SubagentScope(workspace_root_id="caller-id")
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)

    result = await handlers["tasks_check_status"]({}, None)

    assert "tasks" in result
    tasks = result["tasks"]
    assert len(tasks) == 1
    assert tasks[0]["task_id"] == task_ticket.id
    assert tasks[0]["summary"] == "My Task"
    assert tasks[0]["status"] == "running"


@pytest.mark.asyncio
async def test_tasks_check_status_empty():
    scope = SubagentScope(workspace_root_id="caller-id")
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)
    result = await handlers["tasks_check_status"]({}, None)
    assert "message" in result
    assert result["message"] == "There are no tasks."


@pytest.mark.asyncio
async def test_tasks_create_task_async(write_template):
    write_template({
        "name": "my-task",
        "title": "My Task Template",

        "objective": "Do it.",
    })

    caller = GLOBAL_STORE.create("I'm the caller")
    scope = SubagentScope(workspace_root_id=caller.id)
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(scope=scope, caller_ticket_id=caller.id, scheduler=mock_scheduler)

    args = {
        "type": "my-task",
        "summary": "Testing create",
        "objective": "Full objective",
        "slug": "my-slug"
    }
    result = await handlers["tasks_create_task"](args, None)

    assert "task_id" in result
    assert result["status"] == "available"

    ticket = GLOBAL_STORE.get(result["task_id"])
    assert ticket is not None

    assert ticket.metadata.parent_task_id == caller.id
    assert ticket.metadata.slug == "my-slug"
    assert ticket.metadata.title == "Testing create"
    assert "You are assigned to work in the subdirectory: ./my-slug" in ticket.objective
    assert (ticket.fs_dir / "my-slug").exists()


@pytest.mark.asyncio
async def test_tasks_await_with_pending_updates():
    """tasks_await returns immediately when context updates are buffered."""
    from bees.protocols.handler_types import CONTEXT_PARTS_KEY

    caller = GLOBAL_STORE.create("I'm the caller")
    caller.metadata.pending_context_updates = [
        {"type": "task_completed", "message": "Task abc done"},
    ]
    GLOBAL_STORE.save_metadata(caller)

    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE

    scope = SubagentScope(workspace_root_id=caller.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=caller.id, scheduler=mock_scheduler)

    result = await handlers["tasks_await"]({}, None)

    assert result["resumed"] is True
    assert CONTEXT_PARTS_KEY in result

    # Pending updates should be drained.
    fresh = GLOBAL_STORE.get(caller.id)
    assert fresh.metadata.pending_context_updates == []


@pytest.mark.asyncio
async def test_tasks_await_suspends_when_no_updates():
    """tasks_await raises SuspendError when no updates are pending."""
    from bees.protocols.handler_types import SuspendError

    caller = GLOBAL_STORE.create("I'm the caller")
    caller.metadata.pending_context_updates = []
    GLOBAL_STORE.save_metadata(caller)

    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE

    scope = SubagentScope(workspace_root_id=caller.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=caller.id, scheduler=mock_scheduler)

    with pytest.raises(SuspendError) as exc_info:
        await handlers["tasks_await"]({}, None)

    # The function call part should identify as tasks_await.
    fc = exc_info.value.function_call_part
    assert fc["functionCall"]["name"] == "tasks_await"


@pytest.mark.asyncio
async def test_tasks_cancel_task():
    mock_scheduler = MagicMock()
    mock_scheduler.cancel_task = MagicMock(return_value=True)

    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)

    args = {"task_id": "target-id"}
    result = await handlers["tasks_cancel_task"](args, None)

    assert "message" in result
    assert "cancellation requested" in result["message"]
    mock_scheduler.cancel_task.assert_called_once_with("target-id")


@pytest.mark.asyncio
async def test_tasks_cancel_task_not_found():
    mock_scheduler = MagicMock()
    mock_scheduler.cancel_task = MagicMock(return_value=False)

    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)

    args = {"task_id": "target-id"}
    result = await handlers["tasks_cancel_task"](args, None)

    assert "error" in result
    assert "not found" in result["error"]


@pytest.mark.asyncio
async def test_tasks_create_task_nested_slug(write_template):
    """When parent has a slug, child slug is composed as parent/child."""
    write_template({
        "name": "my-task",
        "title": "My Task Template",

        "objective": "Do it.",
    })

    caller = GLOBAL_STORE.create("I'm the caller")
    parent_scope = SubagentScope(
        workspace_root_id=caller.id,
        slug_path="research",
    )
    mock_scheduler = MagicMock()
    mock_scheduler.store = GLOBAL_STORE
    handlers = _make_handlers(
        scope=parent_scope,
        caller_ticket_id=caller.id,
        scheduler=mock_scheduler,
    )

    args = {
        "type": "my-task",
        "summary": "Deep dive",
        "objective": "Go deeper",
        "slug": "deep-dive",
    }
    result = await handlers["tasks_create_task"](args, None)

    assert "task_id" in result

    ticket = GLOBAL_STORE.get(result["task_id"])
    assert ticket is not None

    assert ticket.metadata.slug == "research/deep-dive"
    assert ticket.metadata.parent_task_id == caller.id
    assert "./research/deep-dive" in ticket.objective
    assert (ticket.fs_dir / "research" / "deep-dive").exists()


def test_task_store_get_malformed_metadata():
    """Verify TaskStore.get() gracefully returns None if metadata.json is empty or malformed during live scanning."""
    store = GLOBAL_STORE
    assert store is not None
    
    ticket_id = "malformed-ticket"
    ticket_dir = store.tickets_dir / ticket_id
    ticket_dir.mkdir()
    
    (ticket_dir / "objective.md").write_text("Some objective")
    (ticket_dir / "metadata.json").write_text("")  # Empty file causing standard JSONDecodeError
    
    assert store.get(ticket_id) is None
    
    # Partially written JSON
    (ticket_dir / "metadata.json").write_text('{"status": "avail')
    assert store.get(ticket_id) is None


# ---------------------------------------------------------------------------
# UnifiedAgentStore integration — regression tests
#
# These tests exercise the production code path where scheduler.store is a
# UnifiedAgentStore (returns Agent objects). The bug: function handlers
# received Agent objects but passed them to Ticket-typed APIs, silently
# dropping parent_task_id and producing empty trees.
# ---------------------------------------------------------------------------


@pytest.fixture
def unified_store(tmp_path):
    """Create a UnifiedAgentStore backed by a temp directory."""
    from bees.unified_agent_store import UnifiedAgentStore
    (tmp_path / "tickets").mkdir(exist_ok=True)
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)
    config_dir.joinpath("hooks").mkdir(exist_ok=True)
    return UnifiedAgentStore(tmp_path)


@pytest.mark.asyncio
async def test_create_task_sets_parent_id_via_unified_store(
    unified_store, write_template,
):
    """parent_task_id must survive the Agent→Ticket round-trip in stamp_child_task."""
    write_template({
        "name": "child-type",
        "title": "Child",
        "objective": "Do child work.",
    })

    # Create a parent via the unified store (returns Agent).
    parent = unified_store.create("I'm the parent")
    parent.metadata.tasks = ["child-type"]
    unified_store.save_metadata(parent)

    scope = SubagentScope(workspace_root_id=parent.id)
    mock_scheduler = MagicMock()
    mock_scheduler.store = unified_store
    handlers = _make_handlers(
        scope=scope,
        caller_ticket_id=parent.id,
        scheduler=mock_scheduler,
    )

    result = await handlers["tasks_create_task"]({
        "type": "child-type",
        "summary": "Child task",
        "objective": "Full child objective",
        "slug": "child-slug",
    }, None)

    assert "task_id" in result, f"Expected task_id, got: {result}"

    # Read the child back via the inner TaskStore to verify the on-disk
    # Ticket has parent_task_id set correctly.
    child_ticket = unified_store._ticket_store.get(result["task_id"])
    assert child_ticket is not None
    assert child_ticket.metadata.parent_task_id == parent.id


@pytest.mark.asyncio
async def test_check_status_builds_tree_via_unified_store(unified_store):
    """tasks_check_status must find children when store is UnifiedAgentStore."""
    parent = unified_store.create("Parent objective")

    # Create a child with parent_task_id set on the inner TaskStore
    # (simulating what stamp_child_task does after the fix).
    child_ticket = unified_store._ticket_store.create("Child objective")
    child_ticket.metadata.parent_task_id = parent.id
    child_ticket.metadata.title = "Child Title"
    child_ticket.metadata.status = "running"
    unified_store._ticket_store.save_metadata(child_ticket)

    mock_scheduler = MagicMock()
    mock_scheduler.store = unified_store
    handlers = _make_handlers(
        caller_ticket_id=parent.id,
        scheduler=mock_scheduler,
    )

    result = await handlers["tasks_check_status"]({}, None)

    assert "tasks" in result, f"Expected tree, got: {result}"
    assert len(result["tasks"]) == 1
    assert result["tasks"][0]["task_id"] == child_ticket.id
    assert result["tasks"][0]["summary"] == "Child Title"
    assert result["tasks"][0]["status"] == "running"
