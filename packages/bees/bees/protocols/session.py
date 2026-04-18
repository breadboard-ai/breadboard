# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Session observation types — the output contract of a session.

Defines the types that the orchestration layer (``TaskRunner``,
``Scheduler``, ``EvalCollector``) uses to interpret session output:

- ``SessionResult`` — structured result of a completed or suspended session.
- ``SUSPEND_TYPES`` — event type strings that signal session suspension.
- ``PAUSE_TYPES`` — event type strings that signal transient pause.

These types are the shared vocabulary between the runner (which produces
events) and the orchestrator (which categorizes them).  They are
prerequisites for the ``SessionRunner`` protocol.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "PAUSE_TYPES",
    "SUSPEND_TYPES",
    "SessionResult",
]


# ---------------------------------------------------------------------------
# Event type constants
# ---------------------------------------------------------------------------

SUSPEND_TYPES: frozenset[str] = frozenset({
    "waitForInput",
    "waitForChoice",
    "readGraph",
    "inspectNode",
    "applyEdits",
    "queryConsent",
})
"""Event type strings that indicate the session has suspended.

The event stream is a sequence of ``dict[str, Any]`` where each dict has a
single key naming the event type.  If that key is in ``SUSPEND_TYPES``, the
session is waiting for a client response before continuing.
"""

PAUSE_TYPES: frozenset[str] = frozenset({"paused"})
"""Event type strings that indicate a transient infrastructure pause.

The scheduler can retry the session later without user intervention.
"""


# ---------------------------------------------------------------------------
# Session result
# ---------------------------------------------------------------------------


@dataclass
class SessionResult:
    """Result of a completed or suspended session.

    Produced by the session runner and consumed by ``TaskRunner`` for
    metadata bookkeeping and by ``Scheduler`` for orchestration decisions.
    """

    session_id: str
    status: str
    events: int
    output: str
    turns: int = 0
    thoughts: int = 0
    outcome: str | None = None
    error: str | None = None
    files: list[dict[str, str]] = field(default_factory=list)
    intermediate: list[dict[str, Any]] | None = None
    suspended: bool = False
    suspend_event: dict[str, Any] | None = None
    outcome_content: dict[str, Any] | None = None
    paused: bool = False
    paused_event: dict[str, Any] | None = None
