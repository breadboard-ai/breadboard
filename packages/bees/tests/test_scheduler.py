# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the Scheduler wait_for_ticket mechanism."""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from pathlib import Path
import yaml

from bees.scheduler import Scheduler
from bees.ticket import create_ticket


@pytest.fixture
def mock_clients():
    return AsyncMock(), MagicMock()


@pytest.fixture(autouse=True)
def tickets_dir(tmp_path, monkeypatch):
    """Point TICKETS_DIR to a temp directory."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
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
async def test_wait_for_ticket_already_completed(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    ticket = create_ticket("Objective")
    ticket.metadata.status = "completed"
    ticket.save_metadata()
    
    status = await scheduler.wait_for_ticket(ticket.id, timeout_ms=100)
    assert status == "completed"


@pytest.mark.asyncio
async def test_wait_for_ticket_blocks_and_completes(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    ticket = create_ticket("Objective")
    
    async def simulate_completion():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "completed"
        ticket.save_metadata()
        scheduler._notify_ticket_done(ticket.id)

    # Run wait and simulation concurrently
    wait_task = asyncio.create_task(scheduler.wait_for_ticket(ticket.id, timeout_ms=1000))
    await simulate_completion()
    
    status = await wait_task
    assert status == "completed"


@pytest.mark.asyncio
async def test_wait_for_ticket_timeout(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    ticket = create_ticket("Objective")
    ticket.metadata.status = "running"
    ticket.save_metadata()
    
    status = await scheduler.wait_for_ticket(ticket.id, timeout_ms=50)
    assert status == "running" # Returns current status on timeout


@pytest.mark.asyncio
async def test_wait_for_ticket_returns_early_on_suspend(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    ticket = create_ticket("Objective")
    ticket.metadata.status = "running"
    ticket.save_metadata()
    
    async def simulate_suspend():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "suspended"
        ticket.save_metadata()
        scheduler._notify_ticket_done(ticket.id)

    wait_task = asyncio.create_task(scheduler.wait_for_ticket(ticket.id, timeout_ms=1000))
    await simulate_suspend()
    
    status = await wait_task
    assert status == "suspended"


@pytest.mark.asyncio
async def test_wait_for_ticket_returns_early_on_fail(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    ticket = create_ticket("Objective")
    ticket.metadata.status = "running"
    ticket.save_metadata()
    
    async def simulate_fail():
        await asyncio.sleep(0.05)
        ticket.metadata.status = "failed"
        ticket.save_metadata()
        scheduler._notify_ticket_done(ticket.id)

    wait_task = asyncio.create_task(scheduler.wait_for_ticket(ticket.id, timeout_ms=1000))
    await simulate_fail()
    
    status = await wait_task
    assert status == "failed"


@pytest.mark.asyncio
async def test_deliver_context_update_immediate(mock_clients):
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)
    
    creator = create_ticket("Parent Objective")
    creator.metadata.status = "suspended"
    creator.metadata.assignee = "user"
    creator.save_metadata()
    
    update = {"task_id": "sub-1", "outcome": "done"}
    scheduler._deliver_context_update(creator.id, update)
    
    response_path = creator.dir / "response.json"
    assert response_path.exists()
    
    import json
    content = json.loads(response_path.read_text())
    assert "context_updates" in content
    assert content["context_updates"][0]["task_id"] == "sub-1"
    
    from bees.ticket import load_ticket
    fresh_creator = load_ticket(creator.id)
    assert fresh_creator.metadata.assignee == "agent"


# ---------------------------------------------------------------------------
# Tag enrichment tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enrich_creator_tags_merges(mock_clients):
    """Child tags are merged (union) into the creator's existing tags."""
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    creator = create_ticket("Parent", tags=["b", "c"])
    child = create_ticket("Child", tags=["a", "b"])
    child.metadata.creator_ticket_id = creator.id
    child.save_metadata()

    result = scheduler._enrich_creator_tags(child)

    assert result is not None
    assert result.id == creator.id
    from bees.ticket import load_ticket
    fresh = load_ticket(creator.id)
    assert fresh.metadata.tags == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_enrich_creator_tags_no_creator(mock_clients):
    """No crash when creator_ticket_id points to a nonexistent ticket."""
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    child = create_ticket("Child", tags=["a"])
    child.metadata.creator_ticket_id = "nonexistent-id"
    child.save_metadata()

    # Should not raise, returns None.
    assert scheduler._enrich_creator_tags(child) is None


@pytest.mark.asyncio
async def test_enrich_creator_tags_no_tags(mock_clients):
    """Creator is unchanged when the child has no tags."""
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    creator = create_ticket("Parent", tags=["x"])
    child = create_ticket("Child")  # No tags.
    child.metadata.creator_ticket_id = creator.id
    child.save_metadata()

    assert scheduler._enrich_creator_tags(child) is None

    from bees.ticket import load_ticket
    fresh = load_ticket(creator.id)
    assert fresh.metadata.tags == ["x"]


@pytest.mark.asyncio
async def test_enrich_creator_tags_creator_has_no_tags(mock_clients):
    """Creator with None tags receives the child's tags."""
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    creator = create_ticket("Parent")  # tags=None
    child = create_ticket("Child", tags=["a"])
    child.metadata.creator_ticket_id = creator.id
    child.save_metadata()

    result = scheduler._enrich_creator_tags(child)

    assert result is not None
    from bees.ticket import load_ticket
    fresh = load_ticket(creator.id)
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
    """Paused result → ticket status 'paused', completed_at is None."""
    from bees.session import SessionResult

    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = create_ticket("Objective")
    result = SessionResult(
        session_id="s1",
        status="paused",
        events=1,
        output="",
        paused=True,
        error="503 Service Unavailable",
    )

    scheduler._update_metadata(ticket, result)

    # _update_metadata sets completed_at, but for paused it should be None.
    assert ticket.metadata.completed_at is None
    # Status is set by _handle_pause, not _update_metadata.
    # _update_metadata only recognizes "completed", so result.paused
    # prevents it from setting "failed".


def test_handle_pause_sets_status(mock_clients):
    """_handle_pause sets ticket status to 'paused', assignee to None."""
    from bees.session import SessionResult

    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = create_ticket("Objective")
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

    scheduler._handle_pause(ticket, result)

    assert ticket.metadata.status == "paused"
    assert ticket.metadata.assignee is None


def test_promote_does_not_cascade_paused(mock_clients):
    """A blocked ticket with a paused dep stays blocked (no cascade)."""
    from bees.scheduler import promote_blocked_tickets

    parent = create_ticket("Parent")
    parent.metadata.status = "paused"
    parent.save_metadata()

    child = create_ticket("Child")
    child.metadata.status = "blocked"
    child.metadata.depends_on = [parent.id]
    child.save_metadata()

    promote_blocked_tickets()

    from bees.ticket import load_ticket
    fresh_child = load_ticket(child.id)
    # Should still be blocked, NOT failed.
    assert fresh_child.metadata.status == "blocked"


# --- boot_root_template ---

@pytest.mark.asyncio
async def test_boots_when_no_root_ticket_exists(mock_clients, write_template, tmp_path, monkeypatch):
    write_template({"name": "opie", "title": "Opie", "objective": "Be helpful."})
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.write_text(yaml.dump({"root": "opie"}))
    
    monkeypatch.setattr("bees.playbook.SYSTEM_PATH", system_path)
    monkeypatch.setattr("bees.playbook.TEMPLATES_PATH", tmp_path / "config" / "TEMPLATES.yaml")

    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = await scheduler._boot_root_template([])

    assert ticket is not None
    assert ticket.metadata.playbook_id == "opie"


@pytest.mark.asyncio
async def test_skips_when_root_already_booted(mock_clients, write_template, tmp_path, monkeypatch):
    write_template({"name": "opie", "title": "Opie", "objective": "Be helpful."})
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.write_text(yaml.dump({"root": "opie"}))
    
    monkeypatch.setattr("bees.playbook.SYSTEM_PATH", system_path)
    monkeypatch.setattr("bees.playbook.TEMPLATES_PATH", tmp_path / "config" / "TEMPLATES.yaml")

    from bees.playbook import run_playbook
    existing = run_playbook("opie")
    
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = await scheduler._boot_root_template([existing])

    assert ticket is None


@pytest.mark.asyncio
async def test_returns_none_when_no_root_configured(mock_clients, tmp_path, monkeypatch):
    system_path = tmp_path / "config" / "SYSTEM.yaml"
    system_path.parent.mkdir(parents=True, exist_ok=True)
    system_path.write_text(yaml.dump({"title": "My Hive"}))
    
    monkeypatch.setattr("bees.playbook.SYSTEM_PATH", system_path)

    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = await scheduler._boot_root_template([])
    assert ticket is None


@pytest.mark.asyncio
async def test_returns_none_when_no_system_yaml(mock_clients, tmp_path, monkeypatch):
    monkeypatch.setattr("bees.playbook.SYSTEM_PATH", tmp_path / "config" / "SYSTEM.yaml")
    
    http, backend = mock_clients
    scheduler = Scheduler(http=http, backend=backend)

    ticket = await scheduler._boot_root_template([])
    assert ticket is None
