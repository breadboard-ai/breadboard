# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
SSEAgentEventSink — writes AgentEvents to an SSE response stream.

This is the server-side counterpart to the TypeScript ``AgentEventSink``.
For fire-and-forget events it pushes a JSON line to the SSE queue.
For suspend events it pushes the JSON line, then blocks on
``PendingRequestMap.wait()`` until the client POSTs a response.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from ..events import AgentEvent, SuspendEvent
from .pending_requests import PendingRequestMap


class SSEAgentEventSink:
    """Server-side event sink that serializes events to an async queue.

    The SSE response handler reads from ``self.queue`` and streams each
    item as an SSE ``data:`` line.
    """

    def __init__(self, pending: PendingRequestMap) -> None:
        self.queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._pending = pending

    def _serialize(self, event: AgentEvent) -> str:
        """Serialize a typed event to JSON using camelCase keys."""
        return json.dumps(event.to_dict())

    async def emit(self, event: AgentEvent) -> None:
        """Fire-and-forget: push a JSON line to the SSE stream."""
        await self.queue.put(self._serialize(event))

    async def suspend(self, event: SuspendEvent) -> Any:
        """Push the suspend event to the stream, then block until the
        client responds via POST /input.

        The event must have a ``request_id`` attribute (serialized as
        ``requestId`` in JSON).
        """
        request_id: str = event.request_id
        await self.queue.put(self._serialize(event))
        return await self._pending.wait(request_id)

    async def close(self) -> None:
        """Signal the SSE stream to end."""
        await self.queue.put(None)
