# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""In-memory EventBus implementation for the dev and fake servers.

Uses ``asyncio.Queue`` per subscriber — the same mechanism that the
old ``Subscribers`` class used, now behind the ``EventBus`` protocol.

Since asyncio is single-threaded, there are no race conditions. The
production implementation would use a pub/sub system for cross-server
delivery.
"""

from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator

from ..event_bus import EventBus

__all__ = ["InMemoryEventBus"]


class InMemoryEventBus:
    """EventBus backed by asyncio.Queue — single-process only.

    Each call to ``subscribe()`` creates a new queue. ``publish()``
    fans out to all queues. ``close()`` sends a ``None`` sentinel
    and removes all queues for the session.

    Satisfies the ``EventBus`` protocol.
    """

    def __init__(self) -> None:
        self._queues: dict[str, list[asyncio.Queue]] = {}

    def subscribe(
        self, session_id: str,
    ) -> AsyncIterator[dict[str, Any] | None]:
        """Create and register a subscriber for a session.

        Returns an async iterator backed by an asyncio.Queue. The
        iterator yields event dicts until a ``None`` sentinel arrives.
        """
        queue: asyncio.Queue = asyncio.Queue()
        self._queues.setdefault(session_id, []).append(queue)
        return _QueueIterator(queue, self, session_id)

    async def publish(
        self, session_id: str, event: dict[str, Any],
    ) -> None:
        """Push an event dict to all subscriber queues."""
        for queue in self._queues.get(session_id, []):
            await queue.put(event)

    async def close(self, session_id: str) -> None:
        """Send sentinel to all subscribers and clean up."""
        for queue in self._queues.get(session_id, []):
            await queue.put(None)
        self._queues.pop(session_id, None)

    def unsubscribe(
        self, session_id: str,
        subscription: AsyncIterator[dict[str, Any] | None],
    ) -> None:
        """Remove a subscription's underlying queue."""
        if not isinstance(subscription, _QueueIterator):
            return
        queues = self._queues.get(session_id, [])
        if subscription._queue in queues:
            queues.remove(subscription._queue)


class _QueueIterator:
    """Async iterator wrapper around an asyncio.Queue.

    Yields event dicts until a ``None`` sentinel is received, then
    stops iteration.
    """

    def __init__(
        self,
        queue: asyncio.Queue,
        bus: InMemoryEventBus,
        session_id: str,
    ) -> None:
        self._queue = queue
        self._bus = bus
        self._session_id = session_id

    def __aiter__(self) -> AsyncIterator[dict[str, Any] | None]:
        return self

    async def __anext__(self) -> dict[str, Any] | None:
        item = await self._queue.get()
        if item is None:
            raise StopAsyncIteration
        return item
