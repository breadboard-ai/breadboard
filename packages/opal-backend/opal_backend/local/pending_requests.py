# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
PendingRequestMap — server-side suspend/resume keyed by requestId.

When the agent loop emits a suspend event, `wait(requestId)` blocks
until the client POSTs a response via `resolve(requestId, response)`.
"""

from __future__ import annotations

import asyncio
from typing import Any


class PendingRequestMap:
    """Maps requestId → (asyncio.Event, response slot).

    Usage from the SSE sink (producer side):
        response = await pending.wait("abc-123")

    Usage from the /input endpoint (consumer side):
        pending.resolve("abc-123", {"input": {"parts": [...]}})
    """

    def __init__(self) -> None:
        self._pending: dict[str, tuple[asyncio.Event, list[Any]]] = {}

    async def wait(self, request_id: str) -> Any:
        """Block until the client responds for this request_id."""
        event = asyncio.Event()
        # The response is stored in a single-element list (mutable slot).
        slot: list[Any] = [None]
        self._pending[request_id] = (event, slot)
        await event.wait()
        self._pending.pop(request_id, None)
        return slot[0]

    def resolve(self, request_id: str, response: Any) -> bool:
        """Resume a pending request with the client's response.

        Returns True if the request was found and resolved, False otherwise.
        """
        entry = self._pending.get(request_id)
        if entry is None:
            return False
        event, slot = entry
        slot[0] = response
        event.set()
        return True

    def has(self, request_id: str) -> bool:
        """Check if a request is currently pending."""
        return request_id in self._pending

    def abort_all(self) -> None:
        """Cancel all pending requests (used on run abort)."""
        for event, slot in self._pending.values():
            slot[0] = None
            event.set()
        self._pending.clear()
