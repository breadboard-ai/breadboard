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
from bees.ticket import create_ticket


@pytest.fixture(autouse=True)
def _temp_tickets(tmp_path, monkeypatch):
    """Redirect ticket storage to a temp directory for each test."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
    monkeypatch.setattr("bees.playbook.PLAYBOOKS_DIR", tmp_path / "playbooks")
    (tmp_path / "playbooks").mkdir()
    yield tickets_dir


@pytest.fixture
def write_playbook(tmp_path):
    """Helper to write a playbook YAML to the temp playbooks dir."""
    def _write(name: str, data: dict) -> Path:
        pb_dir = tmp_path / "playbooks" / name
        pb_dir.mkdir(parents=True, exist_ok=True)
        path = pb_dir / "PLAYBOOK.yaml"
        path.write_text(yaml.dump(data, default_flow_style=False))
        return path
    return _write


@pytest.mark.asyncio
async def test_tasks_list_types_scoped(write_playbook):
    # 1. Create task template playbooks
    write_playbook("task-a", {
        "name": "task-a",
        "title": "Task A",
        "description": "Description A",
        "type": "task-template",
        "steps": {
            "main": {"objective": "Do it."}
        }
    })
    
    write_playbook("task-b", {
        "name": "task-b",
        "title": "Task B",
        "description": "Description B",
        "type": "task-template",
        "steps": {
            "main": {"objective": "Do it."}
        }
    })

    # 2. Create a calling ticket with allowed tasks
    ticket = create_ticket("Objective")
    ticket.metadata.tasks = ["task-a"] # Only task-a is allowed
    ticket.save_metadata()

    # 3. Get handlers
    scope = SubagentScope(workspace_root_id=ticket.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id)
    
    # 4. Call tasks_list_types
    result = await handlers["tasks_list_types"]({}, None)
    
    assert "task_types" in result
    task_types = result["task_types"]
    assert len(task_types) == 1
    assert task_types[0]["name"] == "task-a"
    assert task_types[0]["title"] == "Task A"
    assert task_types[0]["description"] == "Description A"


@pytest.mark.asyncio
async def test_tasks_list_types_filters_invalid(write_playbook):
    # Create a task template with multiple steps (invalid)
    write_playbook("invalid-task", {
        "name": "invalid-task",
        "title": "Invalid Task",
        "type": "task-template",
        "steps": {
            "step1": {"objective": "Do 1"},
            "step2": {"objective": "Do 2"}
        }
    })

    ticket = create_ticket("Objective")
    ticket.metadata.tasks = ["invalid-task"]
    ticket.save_metadata()

    scope = SubagentScope(workspace_root_id=ticket.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id)
    
    result = await handlers["tasks_list_types"]({}, None)
    
    assert "task_types" in result
    assert len(result["task_types"]) == 0


@pytest.mark.asyncio
async def test_tasks_check_status(write_playbook):
    # 1. Create a ticket that acts as the task
    task_ticket = create_ticket("Do something")
    task_ticket.metadata.creator_ticket_id = "caller-id"
    task_ticket.metadata.title = "My Task"
    task_ticket.metadata.status = "running"
    task_ticket.save_metadata()

    # Create another ticket not owned by caller
    other_ticket = create_ticket("Do something else")
    other_ticket.metadata.creator_ticket_id = "other-id"
    other_ticket.save_metadata()

    # 2. Get handlers with caller_ticket_id = "caller-id"
    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id")
    
    # 3. Call tasks_check_status
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
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id")
    result = await handlers["tasks_check_status"]({}, None)
    assert "message" in result
    assert result["message"] == "There are no tasks."


@pytest.mark.asyncio
async def test_tasks_create_task_async(write_playbook):
    write_playbook("my-task", {
        "name": "my-task",
        "title": "My Task Template",
        "type": "task-template",
        "steps": {
            "main": {"objective": "Do it."}
        }
    })

    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id")
    
    args = {
        "type": "my-task",
        "summary": "Testing create",
        "objective": "Full objective",
        "slug": "my-slug"
    }
    result = await handlers["tasks_create_task"](args, None)
    
    assert "task_id" in result
    assert result["status"] == "available"
    
    from bees.ticket import load_ticket
    ticket = load_ticket(result["task_id"])
    assert ticket is not None
    
    assert ticket.metadata.creator_ticket_id == "caller-id"
    assert ticket.metadata.slug == "my-slug"
    assert ticket.metadata.title == "Testing create"
    assert "You are assigned to work in the subdirectory: ./my-slug" in ticket.objective
    assert (ticket.fs_dir / "my-slug").exists()


@pytest.mark.asyncio
async def test_tasks_create_task_sync_wait_timeout(write_playbook, monkeypatch):
    write_playbook("my-task", {
        "name": "my-task",
        "title": "My Task Template",
        "type": "task-template",
        "steps": {
            "main": {"objective": "Do it."}
        }
    })

    mock_scheduler = MagicMock()
    mock_scheduler.wait_for_ticket = AsyncMock(return_value="running")
    
    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)
    
    args = {
        "type": "my-task",
        "summary": "Testing create sync",
        "objective": "Full objective",
        "slug": "my-slug",
        "wait_ms_before_async": 1000
    }
    
    result = await handlers["tasks_create_task"](args, None)
    
    assert "task_id" in result
    assert result["status"] == "running"
    mock_scheduler.wait_for_ticket.assert_called_once()


@pytest.mark.asyncio
async def test_tasks_cancel_task():
    mock_scheduler = MagicMock()
    mock_scheduler.cancel_ticket = MagicMock(return_value=True)
    
    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)
    
    args = {"task_id": "target-id"}
    result = await handlers["tasks_cancel_task"](args, None)
    
    assert "message" in result
    assert "cancellation requested" in result["message"]
    mock_scheduler.cancel_ticket.assert_called_once_with("target-id")


@pytest.mark.asyncio
async def test_tasks_cancel_task_not_found():
    mock_scheduler = MagicMock()
    mock_scheduler.cancel_ticket = MagicMock(return_value=False)
    
    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id", scheduler=mock_scheduler)
    
    args = {"task_id": "target-id"}
    result = await handlers["tasks_cancel_task"](args, None)
    
    assert "error" in result
    assert "not found" in result["error"]


@pytest.mark.asyncio
async def test_tasks_create_task_nested_slug(write_playbook):
    """When parent has a slug, child slug is composed as parent/child."""
    write_playbook("my-task", {
        "name": "my-task",
        "title": "My Task Template",
        "type": "task-template",
        "steps": {
            "main": {"objective": "Do it."}
        }
    })

    # Parent is a subagent with slug "research"
    parent_scope = SubagentScope(
        workspace_root_id="root-id",
        slug_path="research",
    )
    handlers = _make_handlers(
        scope=parent_scope,
        caller_ticket_id="parent-id",
    )

    args = {
        "type": "my-task",
        "summary": "Deep dive",
        "objective": "Go deeper",
        "slug": "deep-dive",
    }
    result = await handlers["tasks_create_task"](args, None)

    assert "task_id" in result

    from bees.ticket import load_ticket
    ticket = load_ticket(result["task_id"])
    assert ticket is not None

    # Slug should be composed: research/deep-dive
    assert ticket.metadata.slug == "research/deep-dive"
    # Creator should be parent, not workspace root
    assert ticket.metadata.creator_ticket_id == "parent-id"
    # Sandbox instructions should reference the full path
    assert "./research/deep-dive" in ticket.objective
    # Directory should be created at the composed path
    assert (ticket.fs_dir / "research" / "deep-dive").exists()

