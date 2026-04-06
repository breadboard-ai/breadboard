# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the chat function group."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock
from bees.functions.chat import get_chat_function_group_factory
from bees.ticket import create_ticket, load_ticket


@pytest.fixture(autouse=True)
def _temp_tickets(tmp_path, monkeypatch):
    """Redirect ticket storage to a temp directory for each test."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
    yield tickets_dir


@pytest.mark.asyncio
async def test_chat_await_context_update_from_metadata(monkeypatch):
    # 1. Create a ticket with pending updates
    ticket = create_ticket("Objective")
    ticket.metadata.pending_context_updates = [{"task_id": "sub-1", "outcome": "done"}]
    ticket.save_metadata()

    # 2. Get handlers via factory
    factory = get_chat_function_group_factory(workspace_root_id=ticket.id)
    mock_hooks = MagicMock()
    
    # Mock assemble_function_group to just return the handlers
    monkeypatch.setattr("bees.functions.chat.assemble_function_group", lambda dec, hand: hand)
    
    handlers = factory(mock_hooks)
    
    # 3. Call chat_await_context_update
    result = await handlers["chat_await_context_update"]({}, None)
    
    assert "context_updates" in result
    assert result["context_updates"][0]["task_id"] == "sub-1"
    
    # Verify metadata cleared
    updated_ticket = load_ticket(ticket.id)
    assert updated_ticket.metadata.pending_context_updates == []
