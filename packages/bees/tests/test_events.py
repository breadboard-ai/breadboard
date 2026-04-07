# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the events function group handlers."""

from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock

from bees.ticket import TICKETS_DIR


@pytest.fixture(autouse=True)
def tickets_dir(tmp_path, monkeypatch):
    """Point TICKETS_DIR to a temp directory."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
    return tickets_dir


# ---- events_broadcast ----


@pytest.mark.asyncio
async def test_events_broadcast_creates_ticket(tickets_dir):
    """events_broadcast creates a coordination ticket and calls the callback."""
    from bees.functions.events import _make_handlers

    callback = MagicMock()
    handlers = _make_handlers(on_events_broadcast=callback)

    result = await handlers["events_broadcast"](
        {"type": "app_update", "message": "New app"}, None,
    )

    assert result["broadcast"] is True
    assert result["type"] == "app_update"
    assert "ticket_id" in result
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
    handlers = _make_handlers(
        deliver_to_parent=deliver,
        ticket_id="child-123",
        slug="research",
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


# ---- coordination_pull_digest_tiles ----


@pytest.mark.asyncio
async def test_pull_digest_tiles_empty(tickets_dir):
    """coordination_pull_digest_tiles returns empty list when no tiles exist."""
    from bees.functions.events import _make_handlers

    handlers = _make_handlers()
    result = await handlers["coordination_pull_digest_tiles"]({}, None)
    assert result["tiles"] == []


@pytest.mark.asyncio
async def test_pull_digest_tiles_finds_tiles(tickets_dir):
    """coordination_pull_digest_tiles finds tiles in ticket filesystems."""
    from bees.functions.events import _make_handlers

    # Seed a digest tile.
    run_dir = tickets_dir / "run-abc"
    fs_dir = run_dir / "filesystem"
    fs_dir.mkdir(parents=True)
    tile_data = {"title": "Test Journey", "summary": "Testing"}
    (fs_dir / "digest_tile.json").write_text(json.dumps(tile_data))

    handlers = _make_handlers()
    result = await handlers["coordination_pull_digest_tiles"]({}, None)
    assert len(result["tiles"]) == 1
    assert result["tiles"][0]["run_id"] == "run-abc"
    assert result["tiles"][0]["tile"]["title"] == "Test Journey"
