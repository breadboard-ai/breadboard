# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Suspend primitives for the reconnect-based suspend/resume protocol.

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
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SuspendResult:
    """Returned by the loop when a function handler suspends.

    The caller uses this to emit the suspend event, store the interaction
    state, and close the stream.
    """

    interaction_id: str
    suspend_event: dict[str, Any]
    contents: list[dict[str, Any]]
    function_call_part: dict[str, Any]


class SuspendError(Exception):
    """Raised by function handlers that need client input.

    The function handler constructs the suspend event (e.g., waitForInput)
    and raises this exception. The loop catches it, saves state, and
    returns a ``SuspendResult``.

    Args:
        event: The suspend event dict to send to the client.
               Must include ``type`` and ``requestId``.
    """

    def __init__(self, event: dict[str, Any]) -> None:
        self.event = event
        # Assign a unique interaction ID for the reconnect protocol.
        self.interaction_id = str(uuid.uuid4())
        super().__init__(f"Suspend: {event.get('type', 'unknown')}")
