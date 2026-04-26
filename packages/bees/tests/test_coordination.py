# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for coordination event routing.

Covers the Phase 1 objective: applications receive agent-level broadcast
events via the BroadcastReceived scheduler event.
"""

from __future__ import annotations

import pytest

from bees.coordination import route_coordination_task
from bees.protocols.events import BroadcastReceived, TaskDone
from bees.task_store import TaskStore


@pytest.fixture
def store(tmp_path):
    return TaskStore(tmp_path)


# ---------------------------------------------------------------------------
# BroadcastReceived emission
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_broadcast_received_emitted(store):
    """route_coordination_task emits a BroadcastReceived event."""
    coord = store.create(
        "",
        kind="coordination",
        signal_type="surface_updated",
        context="new content available",
    )

    emitted = []

    async def capture(event):
        emitted.append(event)

    await route_coordination_task(coord, store, set(), capture)

    broadcasts = [e for e in emitted if isinstance(e, BroadcastReceived)]
    assert len(broadcasts) == 1

    event = broadcasts[0]
    assert event.signal_type == "surface_updated"
    assert event.message == "new content available"
    assert event.source_task_id == coord.id


@pytest.mark.asyncio
async def test_broadcast_received_before_task_done(store):
    """BroadcastReceived fires before TaskDone in emission order."""
    coord = store.create(
        "",
        kind="coordination",
        signal_type="test_signal",
        context="payload",
    )

    order = []

    async def capture(event):
        order.append(type(event).__name__)

    await route_coordination_task(coord, store, set(), capture)

    assert order == ["BroadcastReceived", "TaskDone"]


@pytest.mark.asyncio
async def test_broadcast_received_carries_empty_fields(store):
    """BroadcastReceived handles missing context gracefully."""
    coord = store.create(
        "",
        kind="coordination",
        signal_type="ping",
    )

    emitted = []

    async def capture(event):
        emitted.append(event)

    await route_coordination_task(coord, store, set(), capture)

    broadcasts = [e for e in emitted if isinstance(e, BroadcastReceived)]
    assert len(broadcasts) == 1
    assert broadcasts[0].message == ""
    assert broadcasts[0].signal_type == "ping"


@pytest.mark.asyncio
async def test_broadcast_received_with_subscriber_delivery(store):
    """BroadcastReceived fires even when agent subscribers exist."""
    # Create a subscriber that watches for the signal type.
    subscriber = store.create(
        "watcher",
        watch_events=[{"type": "data_ready"}],
    )
    # Suspend it so it can receive delivery.
    subscriber.metadata.status = "suspended"
    subscriber.metadata.assignee = "user"
    store.save_metadata(subscriber)

    # Create the coordination task.
    coord = store.create(
        "",
        kind="coordination",
        signal_type="data_ready",
        context="here it comes",
    )

    emitted = []

    async def capture(event):
        emitted.append(event)

    await route_coordination_task(coord, store, set(), capture)

    # Both agent delivery AND consumer notification happened.
    broadcasts = [e for e in emitted if isinstance(e, BroadcastReceived)]
    assert len(broadcasts) == 1
    assert broadcasts[0].signal_type == "data_ready"

    # The subscriber was delivered to.
    updated = store.get(subscriber.id)
    assert updated.metadata.assignee == "agent"
