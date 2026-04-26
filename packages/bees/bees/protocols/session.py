# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Session types — observation, configuration, stream, and runner protocols.

Defines the types that sit at the session boundary:

**Observation** (output contract):

- ``SessionResult`` — structured result of a completed or suspended run.
- ``SUSPEND_TYPES`` — event type strings that signal session suspension.
- ``PAUSE_TYPES`` — event type strings that signal transient pause.
- ``SessionEvent`` — type alias for a single event dict.

**Configuration** (provisioning output):

- ``SessionConfiguration`` — everything a session runner needs to start.

**Stream** (runner return type):

- ``SessionStream`` — async iterable of events with back-channel methods.

**Runner** (execution contract):

- ``SessionRunner`` — the contract between bees and a model provider.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol, runtime_checkable

from bees.protocols.filesystem import FileSystem
from bees.protocols.functions import FunctionGroupFactory

__all__ = [
    "PAUSE_TYPES",
    "SUSPEND_TYPES",
    "SessionConfiguration",
    "SessionEvent",
    "SessionResult",
    "SessionRunner",
    "SessionStream",
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


# ---------------------------------------------------------------------------
# Session event
# ---------------------------------------------------------------------------


SessionEvent = dict[str, Any]
"""A single session event.

Each event is a dict with a single key naming the event type (e.g.
``{"thought": {"text": "..."}}``, ``{"functionCall": {...}}``).
Event types include observations (thought, functionCall, usageMetadata,
complete, error), suspend signals (from ``SUSPEND_TYPES``), pause signals,
and — for runners with external tool dispatch — tool_call requests.
"""


# ---------------------------------------------------------------------------
# Session configuration
# ---------------------------------------------------------------------------


@dataclass
class SessionConfiguration:
    """Everything a session runner needs to start a run.

    Assembled by the provisioning function from a task's metadata,
    skills, and function declarations.  The runner brings its own
    auth — no credentials appear here.
    """

    segments: list[dict[str, Any]]
    """Input segments for the session (text, structured data)."""

    function_groups: list[FunctionGroupFactory]
    """Assembled function group factories for tool declarations."""

    function_filter: list[str] | None
    """Optional allowlist of function names."""

    model: str | None
    """Model identifier (e.g. ``'gemini-2.5-flash'``)."""

    file_system: FileSystem
    """Disk-backed file system for the session's workspace."""

    ticket_id: str | None = None
    """Unique identifier for the task being executed."""

    ticket_dir: Path | None = None
    """Path to the task's directory on disk."""

    label: str = ""
    """Short label for log prefixes (usually ``ticket_id[:8]``)."""

    log_path: Path | None = None
    """Path for the eval log output.

    .. note:: Observation concern — may move to a separate
       ``ObservationConfig`` in a future spec.
    """

    on_chat_entry: Callable[[str, str], None] | None = None
    """Optional callback for chat log entries.

    .. note:: Observation concern — may move to a separate
       ``ObservationConfig`` in a future spec.
    """

    extract_chat_from_context: bool = False
    """Extract chat log entries from ``sendRequest`` context.

    When ``True``, ``drain_session`` scans each ``sendRequest`` event for
    new user/model text turns and writes them to the chat log via
    ``on_chat_entry``.  Used by live sessions, which lack function-level
    chat handlers.  Batch sessions leave this ``False`` — their chat
    function handlers write log entries directly.
    """

    voice: str | None = None
    """Prebuilt voice name for Live API audio output (e.g. ``'Kore'``)."""


# ---------------------------------------------------------------------------
# Session stream
# ---------------------------------------------------------------------------


@runtime_checkable
class SessionStream(Protocol):
    """A running session's event stream — one run.

    A ``SessionStream`` represents a single **run** — a sequence of turns
    that starts fresh or resumes and ends when the model terminates,
    suspends, or pauses.  See `architecture.md`_ for terminology.

    The async iterator yields ``SessionEvent`` dicts until the run ends
    (``StopAsyncIteration``).  Events include observations (thought,
    functionCall, usageMetadata, complete, error, suspend, pause) and —
    for runners with external tool dispatch — tool_call requests.

    Back-channel methods allow the framework to respond to tool calls
    and inject context updates mid-run.

    .. _architecture.md: ../docs/architecture.md
    """

    def __aiter__(self) -> AsyncIterator[SessionEvent]: ...

    async def __anext__(self) -> SessionEvent: ...

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """Send tool execution results back to the model.

        Called when the event stream yields a ``tool_call`` event.  The
        runner blocks on ``__anext__`` until this is called.
        """
        ...

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """Inject context parts into the running session.

        Used for mid-session context updates (e.g. child task
        completion notifications).
        """
        ...

    def resume_state(self) -> bytes | None:
        """Opaque blob the runner needs to resume this session.

        Returns ``None`` if the run completed (no resume needed).
        Available after the stream exhausts (``StopAsyncIteration``).

        The resume state is runner-internal.  Bees persists it as an
        opaque blob and hands it back on resume.  For the batch runner
        this is serialized ``opal_backend`` ``InteractionState``.  For
        the Live runner this would be a session resumption token.
        """
        ...


# ---------------------------------------------------------------------------
# Session runner
# ---------------------------------------------------------------------------


@runtime_checkable
class SessionRunner(Protocol):
    """Contract: execute a session and return an event stream.

    The runner owns the model interaction — API calls, turn management,
    function dispatch.  It receives a provisioned configuration (function
    groups, file system, segments) and returns a stream of events.

    The framework (bees) owns observation (``EvalCollector``), orchestration
    (``Scheduler``), and persistence (resume state to disk).
    """

    async def run(
        self,
        config: SessionConfiguration,
    ) -> SessionStream:
        """Start a new session and return an event stream.

        The stream yields events until the run ends (completion,
        suspension, pause, or error).  After the stream exhausts,
        ``stream.resume_state()`` provides the opaque blob needed
        to resume (or ``None`` if the run completed).
        """
        ...

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> SessionStream:
        """Resume a suspended session.

        Args:
            config: Same provisioned configuration as ``run()``.
            state: Opaque resume state from a previous
                ``stream.resume_state()`` call.
            response: The user's response dict (text, structured data).
            context_parts: Pre-formatted context parts to inject at
                the start of the resumed session.  Assembled by bees
                from ``response.context_updates`` and
                ``pending_context_updates`` in task metadata.
        """
        ...
