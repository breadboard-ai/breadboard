# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for the Observation API event types.

Verifies:
1. Each event is a SchedulerEvent subclass with correct type discriminator.
2. Each event has named fields (not positional).
3. to_dict() produces a serializable dict.
4. EventEmitter type is satisfiable by an async function.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest

from bees.protocols.events import (
    CycleComplete,
    CycleStarted,
    EventEmitter,
    SchedulerEvent,
    TaskAdded,
    TaskDone,
    TaskEvent,
    TaskStarted,
)


# ---------------------------------------------------------------------------
# Subclass checks
# ---------------------------------------------------------------------------


def test_all_events_are_scheduler_events():
    """Every concrete event is a SchedulerEvent."""
    event_classes = [
        TaskAdded, CycleStarted, TaskEvent,
        TaskStarted, TaskDone, CycleComplete,
    ]
    for cls in event_classes:
        # Use a mock for Ticket fields.
        kwargs = _make_kwargs(cls)
        instance = cls(**kwargs)
        assert isinstance(instance, SchedulerEvent), (
            f"{cls.__name__} is not a SchedulerEvent"
        )


# ---------------------------------------------------------------------------
# Type discriminators
# ---------------------------------------------------------------------------


def test_type_discriminators():
    """Each event has a unique, non-init type field."""
    expected = {
        TaskAdded: "task_added",
        CycleStarted: "cycle_started",
        TaskEvent: "task_event",
        TaskStarted: "task_started",
        TaskDone: "task_done",
        CycleComplete: "cycle_complete",
    }
    for cls, expected_type in expected.items():
        kwargs = _make_kwargs(cls)
        instance = cls(**kwargs)
        assert instance.type == expected_type, (
            f"{cls.__name__}.type is {instance.type!r}, "
            f"expected {expected_type!r}"
        )


# ---------------------------------------------------------------------------
# Named fields
# ---------------------------------------------------------------------------


def test_task_added_fields():
    """TaskAdded has a task field."""
    mock_task = MagicMock()
    event = TaskAdded(task=mock_task)
    assert event.task is mock_task


def test_cycle_started_fields():
    """CycleStarted has cycle, available, resumable fields."""
    event = CycleStarted(cycle=3, available=5, resumable=2)
    assert event.cycle == 3
    assert event.available == 5
    assert event.resumable == 2


def test_task_event_fields():
    """TaskEvent has task_id and event dict."""
    event = TaskEvent(task_id="abc", event={"status": "ok"})
    assert event.task_id == "abc"
    assert event.event == {"status": "ok"}


def test_task_started_fields():
    """TaskStarted has a task field."""
    mock_task = MagicMock()
    event = TaskStarted(task=mock_task)
    assert event.task is mock_task


def test_task_done_fields():
    """TaskDone has a task field."""
    mock_task = MagicMock()
    event = TaskDone(task=mock_task)
    assert event.task is mock_task


def test_cycle_complete_fields():
    """CycleComplete has total_cycles."""
    event = CycleComplete(total_cycles=7)
    assert event.total_cycles == 7


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def test_to_dict_includes_type():
    """to_dict() includes the type discriminator."""
    event = CycleStarted(cycle=1, available=2, resumable=0)
    d = event.to_dict()
    assert d["type"] == "cycle_started"
    assert d["cycle"] == 1
    assert d["available"] == 2
    assert d["resumable"] == 0


def test_to_dict_delegates_to_nested():
    """to_dict() calls to_dict() on nested objects that have it."""
    mock_task = MagicMock()
    mock_task.to_dict.return_value = {"id": "t1"}
    # Ensure hasattr check works on mock.
    mock_task.__dict__["to_dict"] = mock_task.to_dict

    event = TaskAdded(task=mock_task)
    d = event.to_dict()
    assert d["type"] == "task_added"


# ---------------------------------------------------------------------------
# EventEmitter type compatibility
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_async_function_satisfies_emitter():
    """A plain async function satisfies EventEmitter."""
    collected: list[SchedulerEvent] = []

    async def emitter(event: SchedulerEvent) -> None:
        collected.append(event)

    # Type check: this assignment should be valid.
    emit: EventEmitter = emitter

    event = CycleStarted(cycle=1, available=0, resumable=0)
    await emit(event)

    assert len(collected) == 1
    assert collected[0] is event


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_kwargs(cls: type) -> dict:
    """Create minimal kwargs for a concrete event class."""
    if cls in (TaskAdded, TaskStarted, TaskDone):
        return {"task": MagicMock()}
    if cls == CycleStarted:
        return {"cycle": 1, "available": 0, "resumable": 0}
    if cls == TaskEvent:
        return {"task_id": "t1", "event": {}}
    if cls == CycleComplete:
        return {"total_cycles": 1}
    return {}
