# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Agent event sink and hooks adapter.

Port of the ``buildHooksFromSink`` pattern from ``loop-setup.ts``. The event
sink is an asyncio queue of typed event dicts that mirrors the TS
``AgentEventSink``. The ``build_hooks_from_sink`` function creates
``LoopHooks`` that push events into the queue — matching the TS version
exactly.

The events are plain dicts with a ``type`` key that matches the TS
``AgentEvent`` union types (``start``, ``thought``, ``functionCall``, etc.).
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from .loop import GeminiBody, LLMContent, LoopHooks

logger = logging.getLogger(__name__)


class AgentEventSink:
    """An async queue of agent events.

    Mirrors the TS ``AgentEventSink.emit()`` pattern. Events are pushed
    with ``emit()`` and consumed with ``__aiter__()`` (or ``get()``).

    Call ``close()`` to signal that no more events will be emitted.
    The async iterator will stop once the queue is drained and closed.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self._closed = False

    def emit(self, event: dict[str, Any]) -> None:
        """Push an event into the sink."""
        if self._closed:
            logger.warning("emit() called on closed sink: %s", event.get("type"))
            return
        self._queue.put_nowait(event)

    def close(self) -> None:
        """Signal that no more events will be emitted."""
        self._closed = True
        self._queue.put_nowait(None)  # Sentinel to unblock consumers.

    async def __aiter__(self):
        """Async iteration over events until closed."""
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item


def build_hooks_from_sink(sink: AgentEventSink) -> LoopHooks:
    """Build LoopHooks that emit AgentEvents through a sink.

    Port of ``buildHooksFromSink`` from ``loop-setup.ts``.

    Each hook emits an AgentEvent dict instead of calling managers directly.
    The consumer on the other end of the sink dispatches events to the
    appropriate handlers (progress UI, SSE stream, etc.).
    """
    return LoopHooks(
        on_start=lambda objective: sink.emit(
            {"type": "start", "objective": objective}
        ),
        on_finish=lambda: sink.emit({"type": "finish"}),
        on_content=lambda content: sink.emit(
            {"type": "content", "content": content}
        ),
        on_thought=lambda text: sink.emit({"type": "thought", "text": text}),
        on_function_call=_make_on_function_call(sink),
        on_function_call_update=lambda call_id, status: sink.emit(
            {"type": "functionCallUpdate", "callId": call_id, "status": status}
        ),
        on_function_result=lambda call_id, content: sink.emit(
            {"type": "functionResult", "callId": call_id, "content": content}
        ),
        on_turn_complete=lambda: sink.emit({"type": "turnComplete"}),
        on_send_request=lambda model, body: sink.emit(
            {"type": "sendRequest", "model": model, "body": body}
        ),
    )


def _make_on_function_call(sink: AgentEventSink):
    """Create the on_function_call hook with reporter proxy.

    Matches the TS version which creates a proxy ProgressReporter
    that emits subagentAddJson, subagentError, and subagentFinish
    events through the sink.
    """

    def on_function_call(
        part: dict[str, Any],
        icon: str | None = None,
        title: str | None = None,
    ) -> dict[str, Any]:
        call_id = str(uuid.uuid4())

        fc = part.get("functionCall", {})
        sink.emit({
            "type": "functionCall",
            "callId": call_id,
            "name": fc.get("name", ""),
            "args": fc.get("args", {}),
            **({"icon": icon} if icon else {}),
            **({"title": title} if title else {}),
        })

        # Return a proxy reporter that emits subagent events through the sink.
        # Function handlers call addJson/addError/finish as usual — the events
        # travel through the event layer to the consumer.
        reporter = {
            "addJson": lambda json_title, data, json_icon=None: sink.emit({
                "type": "subagentAddJson",
                "callId": call_id,
                "title": json_title,
                "data": data,
                **({"icon": json_icon} if json_icon else {}),
            }),
            "addError": lambda error: (
                sink.emit({
                    "type": "subagentError",
                    "callId": call_id,
                    "error": error,
                }),
                error,
            )[-1],
            "finish": lambda: sink.emit({
                "type": "subagentFinish",
                "callId": call_id,
            }),
        }

        return {"callId": call_id, "reporter": reporter}

    return on_function_call
