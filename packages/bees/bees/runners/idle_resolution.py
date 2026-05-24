# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Idle resolution state machine for the Antigravity runner.

When the Antigravity SDK's step stream exhausts (``StopAsyncIteration``),
the runner must decide what terminal event to emit.  This module
encodes that decision as a pure function: dataclass in, enum + event
dict out.

The decision priority chain:

1. **Already complete** — the SDK emitted a FINISH step during this
   turn.  Nothing more to decide.
2. **Deferred suspend** — a tool (e.g. ``agents_await``) requested
   suspension via the suspend queue.  The agent MUST suspend so the
   scheduler can deliver the result asynchronously.
3. **Active child tasks** — child agents are still running.  Synthesize
   a deferred suspend so the scheduler keeps the session alive.
4. **Chat idle** — the session has ``chat.*`` in its function filter and
   the model produced user-facing text.  Suspend for user input.
5. **Worker done** — none of the above.  The agent finished its work.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Any

__all__ = ["IdleInputs", "IdleOutcome", "resolve_idle"]


class IdleOutcome(Enum):
    """Terminal state after an SDK turn ends."""

    ALREADY_COMPLETE = "already_complete"
    COMPLETE = "complete"
    SUSPEND_DEFERRED = "suspend_deferred"
    SUSPEND_CHAT = "suspend_chat"


@dataclass
class IdleInputs:
    """Accumulated state at SDK turn end.

    Attributes:
        emitted_complete: The SDK emitted a FINISH step during this turn.
        pending_suspend: A tool requested deferred suspension.
        suspend_request_id: Request ID from the pending suspend (empty if none).
        has_active_tasks: Child agents are still running.
        has_chat: Session has ``chat.*`` in its function filter.
        last_user_text: Accumulated model text directed at the user.
    """

    emitted_complete: bool = False
    pending_suspend: bool = False
    suspend_request_id: str = ""
    has_active_tasks: bool = False
    has_chat: bool = False
    last_user_text: str = ""


def resolve_idle(inputs: IdleInputs) -> tuple[IdleOutcome, dict[str, Any]]:
    """Given turn-end state, determine the terminal event to emit.

    Returns a tuple of (outcome, event_dict).  The event_dict is ready
    to be yielded as a ``SessionEvent``.
    """
    # Priority 0: SDK already emitted a FINISH step — nothing to decide.
    if inputs.emitted_complete:
        return IdleOutcome.ALREADY_COMPLETE, {}

    # Priority 1: Chat mode — chat sessions are infinite and always suspend
    # for user input, even if there are pending tool suspends or active child tasks.
    if inputs.has_chat:
        return IdleOutcome.SUSPEND_CHAT, _chat_event(inputs.last_user_text)

    # Priority 2: Active child tasks without an existing suspend →
    # synthesize a deferred suspend so the scheduler keeps us alive.
    if inputs.has_active_tasks and not inputs.pending_suspend:
        request_id = str(uuid.uuid4())
        return IdleOutcome.SUSPEND_DEFERRED, _deferred_event(request_id)

    # Priority 3: A tool requested suspension (deferred result pattern).
    if inputs.pending_suspend:
        return IdleOutcome.SUSPEND_DEFERRED, _deferred_event(
            inputs.suspend_request_id,
        )

    # Default: Worker mode — idle without FINISH = done.
    return IdleOutcome.COMPLETE, _complete_event()


# ---------------------------------------------------------------------------
# Event constructors
# ---------------------------------------------------------------------------


def _deferred_event(request_id: str) -> dict[str, Any]:
    """Build a ``waitForInput`` event for deferred/system-initiated suspend."""
    return {
        "waitForInput": {
            "requestId": request_id,
            "prompt": {},
            "inputType": "any",
        },
    }


def _chat_event(user_text: str) -> dict[str, Any]:
    """Build a ``waitForInput`` event for chat-mode suspend."""
    prompt: dict[str, Any] = {}
    if user_text:
        prompt = {"parts": [{"text": user_text}]}
    return {
        "waitForInput": {
            "requestId": str(uuid.uuid4()),
            "prompt": prompt,
            "inputType": "text",
        },
    }


def _complete_event() -> dict[str, Any]:
    """Build a ``complete`` event for worker-mode idle."""
    return {
        "complete": {
            "result": {
                "success": True,
                "outcomes": {"parts": [{"text": ""}]},
            },
        },
    }
