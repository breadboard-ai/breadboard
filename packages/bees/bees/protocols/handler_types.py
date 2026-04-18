# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees-native handler types for suspend/resume and session termination.

These are bees-native copies of types from ``opal_backend`` that function
handlers use for:

- **Suspend/resume**: ``SuspendError``, ``WaitForInputEvent``,
  ``WaitForChoiceEvent``, ``ChoiceItem``
- **Session termination**: ``SessionTerminator``, ``AgentResult``, ``FileData``
- **Context injection**: ``CONTEXT_PARTS_KEY``
- **Chat callbacks**: ``ChatEntryCallback``

The shapes mirror ``opal_backend`` exactly — same field names, same defaults,
same ``to_dict()`` output. Python's structural subtyping means opal's concrete
types satisfy these definitions without changes.

See ``spec/handler-types.md`` for design rationale.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol, Union, runtime_checkable

__all__ = [
    "AgentResult",
    "ChatEntryCallback",
    "ChoiceItem",
    "CONTEXT_PARTS_KEY",
    "FileData",
    "LLMContent",
    "SessionTerminator",
    "SuspendError",
    "SuspendEvent",
    "WaitForChoiceEvent",
    "WaitForInputEvent",
]

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

LLMContent = dict[str, Any]
"""Gemini content structure: ``{"parts": [...], "role": "..."}``.

Mirrors ``opal_backend.events.LLMContent``.
"""

# Sentinel key in handler return dicts — signals "inject these parts into
# the conversation context."  Mirrors ``opal_backend.function_caller``.
CONTEXT_PARTS_KEY = "__context_parts__"

# Type alias for the optional chat log entry callback.
# Signature: (role: "agent" | "user", content: str) -> None
ChatEntryCallback = Callable[[str, str], None] | None


# ---------------------------------------------------------------------------
# Wire-format data structures
# ---------------------------------------------------------------------------


@dataclass
class FileData:
    """A file from the agent file system, keyed by path.

    Mirrors ``opal_backend.events.FileData``.
    """

    path: str
    content: LLMContent

    def to_dict(self) -> dict[str, Any]:
        return {"path": self.path, "content": self.content}


# Transitional coupling: the session loop (still in opal_backend) checks
# isinstance(result, AgentResult) using opal's class. Until the loop moves
# to bees-gemini, bees' AgentResult must pass that check. Inheriting from
# the opal class makes isinstance() work across the boundary.
# This import is removed when the session loop migrates.
from opal_backend.events import AgentResult as _OpalAgentResult


@dataclass
class AgentResult(_OpalAgentResult):
    """Result of an agent loop run.

    Subclasses ``opal_backend.events.AgentResult`` so the session loop
    (which still lives in opal_backend) recognizes it via isinstance().
    When the loop migrates to bees-gemini, this becomes standalone.
    """

    success: bool
    href: str = "/"
    outcomes: LLMContent | None = None
    intermediate: list[FileData] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"success": self.success}
        if self.href != "/":
            d["href"] = self.href
        if self.outcomes is not None:
            d["outcomes"] = self.outcomes
        if self.intermediate is not None:
            d["intermediate"] = [f.to_dict() for f in self.intermediate]
        return d


# ---------------------------------------------------------------------------
# SessionTerminator protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class SessionTerminator(Protocol):
    """Contract: terminate the session with a result.

    Bees-native protocol for the termination side of
    ``opal_backend.loop.LoopController``. Function handlers call
    ``terminate(result)`` to stop the loop.
    """

    def terminate(self, result: AgentResult | dict[str, Any]) -> None: ...


# ---------------------------------------------------------------------------
# Suspend event types
# ---------------------------------------------------------------------------


@dataclass
class WaitForInputEvent:
    """Needs user text/file input.

    Mirrors ``opal_backend.events.WaitForInputEvent``.
    """

    type: str = "waitForInput"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    input_type: str = "text"
    skip_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "prompt": self.prompt,
            "inputType": self.input_type,
        }
        if self.skip_label is not None:
            payload["skipLabel"] = self.skip_label
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"waitForInput": payload}


@dataclass
class ChoiceItem:
    """A single choice in a WaitForChoiceEvent.

    Mirrors ``opal_backend.events.ChoiceItem``.
    """

    id: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "content": self.content}


@dataclass
class WaitForChoiceEvent:
    """Needs user choice selection.

    Mirrors ``opal_backend.events.WaitForChoiceEvent``.
    """

    type: str = "waitForChoice"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    choices: list[ChoiceItem] = field(default_factory=list)
    selection_mode: str = "single"
    layout: str | None = None
    none_of_the_above_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "prompt": self.prompt,
            "choices": [c.to_dict() for c in self.choices],
            "selectionMode": self.selection_mode,
        }
        if self.layout is not None:
            payload["layout"] = self.layout
        if self.none_of_the_above_label is not None:
            payload["noneOfTheAboveLabel"] = self.none_of_the_above_label
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"waitForChoice": payload}


# Union of suspend event types that bees handlers construct.
# Narrower than opal's SuspendEvent — graph-editing events belong in
# bees-gemini.
SuspendEvent = Union[WaitForInputEvent, WaitForChoiceEvent]


# ---------------------------------------------------------------------------
# SuspendError
# ---------------------------------------------------------------------------

# Transitional coupling: the session loop (still in opal_backend) catches
# opal_backend.suspend.SuspendError. Until the loop moves to bees-gemini,
# bees' SuspendError must be catchable by those except clauses. Inheriting
# from the opal class makes isinstance() and except work across the boundary.
# This import is removed when the session loop migrates.
from opal_backend.suspend import SuspendError as _OpalSuspendError


class SuspendError(_OpalSuspendError):
    """Raised by function handlers that need client input.

    Subclasses ``opal_backend.suspend.SuspendError`` so the session loop
    (which still lives in opal_backend) catches it. When the loop migrates
    to bees-gemini, this becomes a standalone Exception subclass.

    Args:
        event: The typed suspend event to send to the client.
        function_call_part: The function call part that triggered this
            suspend.
        is_precondition_check: Whether this suspend is a precondition
            check (skippable).
    """

    def __init__(
        self,
        event: SuspendEvent,
        function_call_part: dict[str, Any] | None = None,
        *,
        is_precondition_check: bool = False,
    ) -> None:
        self.event = event
        self.function_call_part = function_call_part or {}
        self.is_precondition_check = is_precondition_check
        # Assign a unique interaction ID for the reconnect protocol.
        self.interaction_id = str(uuid.uuid4())
        # Populated by FunctionCaller.get_results() with results from
        # sibling function calls that completed before this suspend.
        self.completed_responses: list = []
        # Call Exception.__init__ directly — we don't want the parent
        # class to re-initialize fields.
        Exception.__init__(self, f"Suspend: {getattr(event, 'type', 'unknown')}")

