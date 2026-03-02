# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Suspend primitives for the reconnect-based suspend/resume protocol.

No direct TypeScript counterpart — the TS implementation handles suspend
inline within the loop. This module was created for the Python backend's
reconnect-based architecture.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path.

When a function handler needs client input (e.g., ``chat_request_user_input``),
it raises ``SuspendError``. The loop catches this, saves its state via
``InteractionStore``, and returns a ``SuspendResult`` to the caller.

The caller (dev backend) emits the suspend event, closes the SSE stream,
and waits for the client to POST back with ``{interactionId, response}``.

On resume, the loop is reconstructed from saved state, the client's response
is injected as the function result, and the loop continues.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from .events import LLMContent, SuspendEvent


@dataclass
class SuspendResult:
    """Returned by the loop when a function handler suspends.

    The caller uses this to emit the suspend event, store the interaction
    state, and close the stream.
    """

    interaction_id: str
    suspend_event: SuspendEvent
    contents: list[LLMContent]
    function_call_part: dict[str, Any]


class SuspendError(Exception):
    """Raised by function handlers that need client input.

    The function handler constructs the suspend event (e.g., WaitForInputEvent)
    and raises this exception. The loop catches it, saves state, and
    returns a ``SuspendResult``.

    Args:
        event: The typed suspend event to send to the client.
        function_call_part: The function call part that triggered this suspend.
    """

    def __init__(
        self,
        event: SuspendEvent,
        function_call_part: dict[str, Any] | None = None,
    ) -> None:
        self.event = event
        self.function_call_part = function_call_part or {}
        # Assign a unique interaction ID for the reconnect protocol.
        self.interaction_id = str(uuid.uuid4())
        super().__init__(f"Suspend: {getattr(event, 'type', 'unknown')}")
