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
def _temp_dirs(tmp_path, monkeypatch):
    """Redirect ticket and template storage to temp directories."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)

    config_dir = tmp_path / "config"
    config_dir.mkdir()
    templates_path = config_dir / "TEMPLATES.yaml"
    hooks_dir = config_dir / "hooks"
    hooks_dir.mkdir()

    monkeypatch.setattr("bees.playbook.CONFIG_DIR", config_dir)
    monkeypatch.setattr("bees.playbook.TEMPLATES_PATH", templates_path)
    monkeypatch.setattr("bees.playbook.HOOKS_DIR", hooks_dir)
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

    ticket = create_ticket("Objective")
    ticket.metadata.tasks = ["task-a"]  # Only task-a is allowed
    ticket.save_metadata()

    scope = SubagentScope(workspace_root_id=ticket.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id)

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

    ticket = create_ticket("Objective")
    ticket.metadata.tasks = ["allowed-task"]  # Only allowed-task
    ticket.save_metadata()

    scope = SubagentScope(workspace_root_id=ticket.id)
    handlers = _make_handlers(scope=scope, caller_ticket_id=ticket.id)

    result = await handlers["tasks_list_types"]({}, None)

    assert "task_types" in result
    assert len(result["task_types"]) == 1
    assert result["task_types"][0]["name"] == "allowed-task"


@pytest.mark.asyncio
async def test_tasks_check_status(write_template):
    task_ticket = create_ticket("Do something")
    task_ticket.metadata.creator_ticket_id = "caller-id"
    task_ticket.metadata.title = "My Task"
    task_ticket.metadata.status = "running"
    task_ticket.save_metadata()

    other_ticket = create_ticket("Do something else")
    other_ticket.metadata.creator_ticket_id = "other-id"
    other_ticket.save_metadata()

    scope = SubagentScope(workspace_root_id="caller-id")
    handlers = _make_handlers(scope=scope, caller_ticket_id="caller-id")

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
async def test_tasks_create_task_async(write_template):
    write_template({
        "name": "my-task",
        "title": "My Task Template",

        "objective": "Do it.",
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
async def test_tasks_create_task_sync_wait_timeout(write_template, monkeypatch):
    write_template({
        "name": "my-task",
        "title": "My Task Template",

        "objective": "Do it.",
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
async def test_tasks_create_task_nested_slug(write_template):
    """When parent has a slug, child slug is composed as parent/child."""
    write_template({
        "name": "my-task",
        "title": "My Task Template",

        "objective": "Do it.",
    })

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

    assert ticket.metadata.slug == "research/deep-dive"
    assert ticket.metadata.creator_ticket_id == "parent-id"
    assert "./research/deep-dive" in ticket.objective
    assert (ticket.fs_dir / "research" / "deep-dive").exists()
