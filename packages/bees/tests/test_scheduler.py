# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the Scheduler wait_for_task mechanism."""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from pathlib import Path
import yaml

from bees.scheduler import Scheduler
from bees.task_store import TaskStore


@pytest.fixture
def mock_clients():
    return AsyncMock(), MagicMock()


GLOBAL_STORE = None

@pytest.fixture(autouse=True)
def tickets_dir(tmp_path, monkeypatch):
    """Point TICKETS_DIR to a temp directory."""
    global GLOBAL_STORE
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    GLOBAL_STORE = TaskStore(tmp_path)
    return tickets_dir

@pytest.fixture
def write_template(tmp_path):
    """Helper to write template entries to the temp TEMPLATES.yaml.

    Accepts one or more template dicts and writes them as a YAML list.
    """
    templates_path = tmp_path / "config" / "TEMPLATES.yaml"
    templates_path.parent.mkdir(parents=True, exist_ok=True)

    def _write(*templates: dict) -> Path:
        templates_path.write_text(
            yaml.dump(list(templates), default_flow_style=False)
        )
        return templates_path

    return _write


@pytest.mark.asyncio
async def test_wait_for_task_already_completed(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.status = "completed"
    GLOBAL_STORE.save_metadata(ticket)
    
    status = await scheduler.wait_for_task(ticket.id, timeout_ms=100)
    assert status == "completed"


@pytest.mark.asyncio
async def test_wait_for_task_blocks_and_completes(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    ticket = GLOBAL_STORE.create("Objective")
    
    async def simulate_completion():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "completed"
        GLOBAL_STORE.save_metadata(ticket)
        scheduler._notify_task_done(ticket.id)

    # Run wait and simulation concurrently
    wait_task = asyncio.create_task(scheduler.wait_for_task(ticket.id, timeout_ms=1000))
    await simulate_completion()
    
    status = await wait_task
    assert status == "completed"


@pytest.mark.asyncio
async def test_wait_for_task_timeout(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.status = "running"
    GLOBAL_STORE.save_metadata(ticket)
    
    status = await scheduler.wait_for_task(ticket.id, timeout_ms=50)
    assert status == "running" # Returns current status on timeout


@pytest.mark.asyncio
async def test_wait_for_task_returns_early_on_suspend(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.status = "running"
    GLOBAL_STORE.save_metadata(ticket)
    
    async def simulate_suspend():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "suspended"
        GLOBAL_STORE.save_metadata(ticket)
        scheduler._notify_task_done(ticket.id)

    wait_task = asyncio.create_task(scheduler.wait_for_task(ticket.id, timeout_ms=1000))
    await simulate_suspend()
    
    status = await wait_task
    assert status == "suspended"


@pytest.mark.asyncio
async def test_wait_for_task_returns_early_on_fail(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.status = "running"
    GLOBAL_STORE.save_metadata(ticket)
    
    async def simulate_fail():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "failed"
        GLOBAL_STORE.save_metadata(ticket)
        scheduler._notify_task_done(ticket.id)

    wait_task = asyncio.create_task(scheduler.wait_for_task(ticket.id, timeout_ms=1000))
    await simulate_fail()
    
    status = await wait_task
    assert status == "failed"


@pytest.mark.asyncio
async def test_deliver_context_update_immediate(mock_clients):
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})
    
    creator = GLOBAL_STORE.create("Parent Objective")
    creator.metadata.status = "suspended"
    creator.metadata.assignee = "user"
    GLOBAL_STORE.save_metadata(creator)
    
    update = {"task_id": "sub-1", "outcome": "done"}
    scheduler._deliver_context_update(creator.id, update)
    
    response_path = creator.dir / "response.json"
    assert response_path.exists()
    
    import json
    content = json.loads(response_path.read_text())
    assert "context_updates" in content
    assert content["context_updates"][0]["task_id"] == "sub-1"
    
    fresh_creator = GLOBAL_STORE.get(creator.id)
    assert fresh_creator.metadata.assignee == "agent"


# ---------------------------------------------------------------------------
# Tag enrichment tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enrich_parent_tags_merges(mock_clients):
    """Child tags are merged (union) into the parent's existing tags."""
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    parent = GLOBAL_STORE.create("Parent", tags=["b", "c"])
    child = GLOBAL_STORE.create("Child", tags=["a", "b"])
    child.metadata.parent_task_id = parent.id
    GLOBAL_STORE.save_metadata(child)

    result = scheduler._enrich_parent_tags(child)

    assert result is not None
    assert result.id == parent.id
    fresh = GLOBAL_STORE.get(parent.id)
    assert fresh.metadata.tags == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_enrich_parent_tags_no_parent(mock_clients):
    """No crash when parent_task_id points to a nonexistent task."""
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    child = GLOBAL_STORE.create("Child", tags=["a"])
    child.metadata.parent_task_id = "nonexistent-id"
    GLOBAL_STORE.save_metadata(child)

    # Should not raise, returns None.
    assert scheduler._enrich_parent_tags(child) is None


@pytest.mark.asyncio
async def test_enrich_parent_tags_no_tags(mock_clients):
    """Parent is unchanged when the child has no tags."""
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    parent = GLOBAL_STORE.create("Parent", tags=["x"])
    child = GLOBAL_STORE.create("Child")  # No tags.
    child.metadata.parent_task_id = parent.id
    GLOBAL_STORE.save_metadata(child)

    assert scheduler._enrich_parent_tags(child) is None

    fresh = GLOBAL_STORE.get(parent.id)
    assert fresh.metadata.tags == ["x"]


@pytest.mark.asyncio
async def test_enrich_parent_tags_parent_has_no_tags(mock_clients):
    """Parent with None tags receives the child's tags."""
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    parent = GLOBAL_STORE.create("Parent")  # tags=None
    child = GLOBAL_STORE.create("Child", tags=["a"])
    child.metadata.parent_task_id = parent.id
    GLOBAL_STORE.save_metadata(child)

    result = scheduler._enrich_parent_tags(child)

    assert result is not None
    fresh = GLOBAL_STORE.get(parent.id)
    assert fresh.metadata.tags == ["a"]


# ---------------------------------------------------------------------------
# Pause tests
# ---------------------------------------------------------------------------


def test_eval_collector_detects_paused():
    """EvalCollector sets paused=True on a paused event."""
    from bees.session import EvalCollector

    collector = EvalCollector()
    collector.collect({"paused": {
        "message": "503 Service Unavailable",
        "statusCode": 503,
        "interactionId": "iid-pause-1",
    }})

    assert collector.paused is True
    assert collector.paused_event is not None
    assert collector.error == "503 Service Unavailable"


def test_update_metadata_paused(mock_clients):
    """Paused result → task status 'paused', completed_at is None."""
    from bees.protocols.session import SessionResult

    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = GLOBAL_STORE.create("Objective")
    result = SessionResult(
        session_id="s1",
        status="paused",
        events=1,
        output="",
        paused=True,
        error="503 Service Unavailable",
    )

    scheduler._task_runner._update_metadata(ticket, result)

    # _update_metadata sets completed_at, but for paused it should be None.
    assert ticket.metadata.completed_at is None
    # Status is set by _handle_pause, not _update_metadata.
    # _update_metadata only recognizes "completed", so result.paused
    # prevents it from setting "failed".


def test_handle_pause_sets_status(mock_clients):
    """_handle_pause sets task status to 'paused', assignee to None."""
    from bees.protocols.session import SessionResult

    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = GLOBAL_STORE.create("Objective")
    ticket.metadata.status = "running"
    ticket.metadata.assignee = "agent"

    result = SessionResult(
        session_id="s1",
        status="paused",
        events=1,
        output="",
        paused=True,
        error="503 Service Unavailable",
    )

    scheduler._task_runner._handle_pause(ticket, result)

    assert ticket.metadata.status == "paused"
    assert ticket.metadata.assignee is None


def test_promote_does_not_cascade_paused(mock_clients):
    """A blocked task with a paused dep stays blocked (no cascade)."""
    from bees.scheduler import promote_blocked_tasks

    parent = GLOBAL_STORE.create("Parent")
    parent.metadata.status = "paused"
    GLOBAL_STORE.save_metadata(parent)

    child = GLOBAL_STORE.create("Child")
    child.metadata.status = "blocked"
    child.metadata.depends_on = [parent.id]
    GLOBAL_STORE.save_metadata(child)

    promote_blocked_tasks(GLOBAL_STORE)

    fresh_child = GLOBAL_STORE.get(child.id)
    # Should still be blocked, NOT failed.
    assert fresh_child.metadata.status == "blocked"


# --- boot_root_template ---

@pytest.mark.asyncio
async def test_boots_when_no_root_ticket_exists(mock_clients, write_template, tmp_path, monkeypatch):
    write_template({"name": "opie", "title": "Opie", "objective": "Be helpful."})
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.write_text(yaml.dump({"root": "opie"}))

    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = await scheduler._boot_root_template([])

    assert ticket is not None
    assert ticket.metadata.playbook_id == "opie"


@pytest.mark.asyncio
async def test_skips_when_root_already_booted(mock_clients, write_template, tmp_path, monkeypatch):
    write_template({"name": "opie", "title": "Opie", "objective": "Be helpful."})
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.write_text(yaml.dump({"root": "opie"}))
    
    from bees.playbook import run_playbook
    existing = run_playbook("opie", store=GLOBAL_STORE)
    
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = await scheduler._boot_root_template([existing])

    assert ticket is None


@pytest.mark.asyncio
async def test_returns_none_when_no_root_configured(mock_clients, tmp_path, monkeypatch):
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.parent.mkdir(parents=True, exist_ok=True)
    system_path.write_text(yaml.dump({"title": "My Hive"}))

    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = await scheduler._boot_root_template([])
    assert ticket is None


@pytest.mark.asyncio
async def test_returns_none_when_no_system_yaml(mock_clients, tmp_path):
    
    _, backend = mock_clients
    scheduler = Scheduler(store=GLOBAL_STORE, runners={"generate": backend})

    ticket = await scheduler._boot_root_template([])
    assert ticket is None
