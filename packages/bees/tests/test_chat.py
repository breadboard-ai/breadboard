# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the chat function group."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock
from bees.functions.chat import get_chat_function_group_factory
from bees.task_store import TaskStore
from bees.context_updates import CONTEXT_UPDATE_TAG
from opal_backend.function_caller import CONTEXT_PARTS_KEY


@pytest.fixture
def task_store(tmp_path):
    """Create a TaskStore in a temp directory."""
    return TaskStore(tmp_path)


@pytest.mark.asyncio
async def test_chat_await_context_update_from_metadata(task_store, monkeypatch):
    # 1. Create a ticket with pending updates
    ticket = task_store.create("Objective")
    ticket.metadata.pending_context_updates = [{"task_id": "sub-1", "outcome": "done"}]
    task_store.save_metadata(ticket)

    # 2. Get handlers via factory
    mock_scheduler = MagicMock()
    mock_scheduler.store = task_store
    factory = get_chat_function_group_factory(workspace_root_id=ticket.id, scheduler=mock_scheduler)
    mock_hooks = MagicMock()
    
    # Mock assemble_function_group to just return the handlers
    monkeypatch.setattr("bees.functions.chat.assemble_function_group", lambda dec, hand: hand)
    
    handlers = factory(mock_hooks)
    
    # 3. Call chat_await_context_update
    result = await handlers["chat_await_context_update"]({}, None)
    
    # Should return resumed=True with context parts as text parts
    assert result["resumed"] is True
    assert CONTEXT_PARTS_KEY in result
    context_parts = result[CONTEXT_PARTS_KEY]
    assert len(context_parts) == 1
    # Each part should be a text dict with the context_update tag
    part = context_parts[0]
    assert "text" in part
    assert f"<{CONTEXT_UPDATE_TAG}>" in part["text"]
    assert f"</{CONTEXT_UPDATE_TAG}>" in part["text"]
    # The content should mention the task
    assert "sub-1" in part["text"]
    assert "done" in part["text"]
    
    # Verify metadata cleared
    updated_ticket = task_store.get(ticket.id)
    assert updated_ticket.metadata.pending_context_updates == []


