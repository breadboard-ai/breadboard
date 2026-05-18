# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the events function group handlers."""

from __future__ import annotations


import pytest
from unittest.mock import MagicMock

from bees.unified_agent_store import UnifiedAgentStore
from bees.subagent_scope import SubagentScope


@pytest.fixture
def task_store(tmp_path):
    """Create a TaskStore in a temp directory."""
    return UnifiedAgentStore(tmp_path)


# ---- events_broadcast ----


@pytest.mark.asyncio
async def test_events_broadcast_creates_ticket(task_store):
    """events_broadcast creates a coordination ticket and calls the callback."""
    from bees.functions.events import _make_handlers

    callback = MagicMock()
    mock_scheduler = MagicMock()
    mock_scheduler.store = task_store
    handlers = _make_handlers(on_events_broadcast=callback, scheduler=mock_scheduler)

    result = await handlers["events_broadcast"](
        {"type": "app_update", "message": "New app"}, None,
    )

    assert result["broadcast"] is True
    assert result["type"] == "app_update"
    assert "agent_id" in result
    callback.assert_called_once()

    # The callback receives a Ticket object.
    ticket = callback.call_args[0][0]
    assert ticket.metadata.kind == "coordination"
    assert ticket.metadata.signal_type == "app_update"


@pytest.mark.asyncio
async def test_events_broadcast_requires_type():
    """events_broadcast returns an error if type is missing."""
    from bees.functions.events import _make_handlers

    handlers = _make_handlers()
    result = await handlers["events_broadcast"]({"message": "hello"}, None)
    assert "error" in result


# ---- events_send_to_parent ----


@pytest.mark.asyncio
async def test_events_send_to_parent_delivers():
    """events_send_to_parent calls deliver_to_parent with enriched payload."""
    from bees.functions.events import _make_handlers

    deliver = MagicMock()
    scope = SubagentScope(workspace_root_id="r", slug_path="research")
    handlers = _make_handlers(
        deliver_to_parent=deliver,
        ticket_id="child-123",
        scope=scope,
    )

    result = await handlers["events_send_to_parent"](
        {"type": "progress", "message": "50% done"}, None,
    )

    assert result["delivered"] is True
    assert result["type"] == "progress"

    deliver.assert_called_once()
    payload = deliver.call_args[0][0]
    assert payload["type"] == "progress"
    assert payload["message"] == "50% done"
    assert payload["from_ticket_id"] == "child-123"
    assert payload["from_slug"] == "research"


@pytest.mark.asyncio
async def test_events_send_to_parent_requires_type():
    """events_send_to_parent returns an error if type is missing."""
    from bees.functions.events import _make_handlers

    deliver = MagicMock()
    handlers = _make_handlers(deliver_to_parent=deliver)
    result = await handlers["events_send_to_parent"]({"message": "hello"}, None)
    assert "error" in result
    deliver.assert_not_called()


@pytest.mark.asyncio
async def test_events_send_to_parent_no_parent():
    """events_send_to_parent returns an error when no parent exists."""
    from bees.functions.events import _make_handlers

    handlers = _make_handlers(deliver_to_parent=None)
    result = await handlers["events_send_to_parent"](
        {"type": "progress", "message": "hello"}, None,
    )
    assert "error" in result


# ---------------------------------------------------------------------------
# UnifiedAgentStore regression
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_events_broadcast_returns_agent_via_unified_store(tmp_path):
    """Callback must receive an Agent when store is UnifiedAgentStore."""
    from bees.functions.events import _make_handlers
    from bees.unified_agent_store import UnifiedAgentStore
    from bees.agent import Agent

    store = UnifiedAgentStore(tmp_path)

    callback = MagicMock()
    mock_scheduler = MagicMock()
    mock_scheduler.store = store
    handlers = _make_handlers(on_events_broadcast=callback, scheduler=mock_scheduler)

    result = await handlers["events_broadcast"](
        {"type": "app_update", "message": "New app"}, None,
    )

    assert result["broadcast"] is True
    callback.assert_called_once()

    # The callback must receive an Agent.
    task = callback.call_args[0][0]
    assert isinstance(task, Agent), (
        f"Expected Agent, got {type(task).__name__}"
    )
    assert task.metadata.kind == "coordination"
    assert task.metadata.signal_type == "app_update"


