# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""EventBus protocol — live event delivery from background tasks to clients.

Extracted from the concrete ``Subscribers`` class that was previously
embedded in ``sessions/api.py``. This protocol enables injectable
implementations:

- ``InMemoryEventBus`` (``local/event_bus_impl.py``) — asyncio.Queue,
  single-process. Used by the dev and fake servers.
- Production — database change streams or pub/sub for cross-server
  delivery.

Both agent sessions and graph sessions share this protocol for live
event delivery to SSE streams.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Protocol, runtime_checkable

__all__ = ["EventBus"]


@runtime_checkable
class EventBus(Protocol):
    """Live event delivery from background tasks to clients.

    Each session has zero or more subscribers. ``publish()`` fans out
    events to all subscribers. ``subscribe()`` returns an async
    iterator that yields events as they arrive. ``close()`` sends an
    end-of-stream sentinel to all subscribers.

    ``unsubscribe()`` removes a single subscription (returned by
    ``subscribe()``) before the stream ends naturally.
    """

    def subscribe(
        self, session_id: str,
    ) -> AsyncIterator[dict[str, Any] | None]:
        """Subscribe to live events for a session.

        Returns an async iterator that yields event dicts. A ``None``
        value is the end-of-stream sentinel — no more events will
        follow for this session.
        """
        ...

    async def publish(
        self, session_id: str, event: dict[str, Any],
    ) -> None:
        """Publish an event to all subscribers of a session."""
        ...

    async def close(self, session_id: str) -> None:
        """Signal end-of-stream to all subscribers and clean up."""
        ...

    def unsubscribe(
        self, session_id: str, subscription: AsyncIterator[dict[str, Any] | None],
    ) -> None:
        """Remove a subscription before the stream ends naturally.

        Called in ``finally`` blocks to clean up when clients
        disconnect early. Safe to call after the stream has already
        ended.
        """
        ...
