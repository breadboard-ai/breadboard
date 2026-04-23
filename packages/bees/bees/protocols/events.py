# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Typed scheduler events for the Observation API.

Each event is a ``@dataclass`` with named fields, replacing the positional
callback signatures of the former ``SchedulerHooks``.  Events subclass
``SchedulerEvent`` so consumers can subscribe to individual types or
handle the base type uniformly.

The ``EventEmitter`` type alias defines the callback signature threaded
through ``Scheduler`` and ``TaskRunner``.

See ``spec/observation.md`` for design rationale.
"""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any, Awaitable, Callable, TypeVar

from bees.ticket import Ticket

__all__ = [
    "CycleComplete",
    "CycleStarted",
    "EventEmitter",
    "SchedulerEvent",
    "TaskAdded",
    "TaskDone",
    "TaskEvent",
    "TaskStarted",
]


# ---------------------------------------------------------------------------
# Base event
# ---------------------------------------------------------------------------


@dataclass
class SchedulerEvent:
    """Base for all scheduler-emitted events.

    Every event carries a ``type`` discriminator for uniform logging,
    serialization, and fan-out.
    """

    type: str = field(init=False, default="unknown")

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict for JSON / SSE transport."""
        result: dict[str, Any] = {}
        for f in fields(self):
            value = getattr(self, f.name)
            result[f.name] = value.to_dict() if hasattr(value, "to_dict") else value
        return result


# ---------------------------------------------------------------------------
# Concrete events
# ---------------------------------------------------------------------------


@dataclass
class TaskAdded(SchedulerEvent):
    """A new task was created or discovered."""

    type: str = field(init=False, default="task_added")
    task: Ticket = field(default=None)  # type: ignore[assignment]


@dataclass
class CycleStarted(SchedulerEvent):
    """A new scheduling cycle is beginning."""

    type: str = field(init=False, default="cycle_started")
    cycle: int = 0
    available: int = 0
    resumable: int = 0


@dataclass
class TaskEvent(SchedulerEvent):
    """A running session emitted a raw event."""

    type: str = field(init=False, default="task_event")
    task_id: str = ""
    event: dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskStarted(SchedulerEvent):
    """A task transitioned to running."""

    type: str = field(init=False, default="task_started")
    task: Ticket = field(default=None)  # type: ignore[assignment]


@dataclass
class TaskDone(SchedulerEvent):
    """A task reached a resting state (completed/failed/suspended/paused)."""

    type: str = field(init=False, default="task_done")
    task: Ticket = field(default=None)  # type: ignore[assignment]


@dataclass
class CycleComplete(SchedulerEvent):
    """All work is done — the scheduler is idle."""

    type: str = field(init=False, default="cycle_complete")
    total_cycles: int = 0


# ---------------------------------------------------------------------------
# Emitter type
# ---------------------------------------------------------------------------

# The single callback signature used by Scheduler and TaskRunner.
EventEmitter = Callable[[SchedulerEvent], Awaitable[None]]
