# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the Scheduler wait_for_ticket mechanism."""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

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
