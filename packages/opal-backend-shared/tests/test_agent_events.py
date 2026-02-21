# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the AgentEventSink and build_hooks_from_sink (Phase 4.4c).
"""

from __future__ import annotations

import asyncio
import pytest

from opal_backend_shared.agent_events import (
    AgentEventSink,
    build_hooks_from_sink,
)


# =============================================================================
# AgentEventSink tests
# =============================================================================


class TestAgentEventSink:
    """Tests for the async event queue."""

    @pytest.mark.asyncio
    async def test_emit_and_iterate(self):
        sink = AgentEventSink()
        sink.emit({"type": "start", "objective": {}})
        sink.emit({"type": "thought", "text": "hello"})
        sink.close()

        collected = []
        async for event in sink:
            collected.append(event)

        assert len(collected) == 2
        assert collected[0]["type"] == "start"
        assert collected[1]["type"] == "thought"

    @pytest.mark.asyncio
    async def test_close_stops_iteration(self):
        sink = AgentEventSink()
        sink.close()

        collected = []
        async for event in sink:
            collected.append(event)

        assert collected == []

    @pytest.mark.asyncio
    async def test_emit_after_close_is_ignored(self):
        sink = AgentEventSink()
        sink.close()
        # Should not raise, just warn.
        sink.emit({"type": "late"})

    @pytest.mark.asyncio
    async def test_concurrent_producer_consumer(self):
        sink = AgentEventSink()
        n = 50

        async def produce():
            for i in range(n):
                sink.emit({"type": "thought", "text": str(i)})
                await asyncio.sleep(0)
            sink.close()

        collected = []

        async def consume():
            async for event in sink:
                collected.append(event)

        await asyncio.gather(produce(), consume())
        assert len(collected) == n


# =============================================================================
# build_hooks_from_sink tests
# =============================================================================


class TestBuildHooksFromSink:
    """Tests for the LoopHooks → event bridge."""

    @pytest.mark.asyncio
    async def test_on_start_emits_start_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        objective = {"parts": [{"text": "goal"}], "role": "user"}
        hooks.on_start(objective)
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert len(events) == 1
        assert events[0] == {"type": "start", "objective": objective}

    @pytest.mark.asyncio
    async def test_on_thought_emits_thought_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        hooks.on_thought("thinking about it")
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {"type": "thought", "text": "thinking about it"}

    @pytest.mark.asyncio
    async def test_on_finish_emits_finish_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        hooks.on_finish()
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {"type": "finish"}

    @pytest.mark.asyncio
    async def test_on_content_emits_content_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        content = {"parts": [{"text": "result"}]}
        hooks.on_content(content)
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {"type": "content", "content": content}

    @pytest.mark.asyncio
    async def test_on_turn_complete_emits_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        hooks.on_turn_complete()
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {"type": "turnComplete"}

    @pytest.mark.asyncio
    async def test_on_function_call_emits_event_and_returns_call_id(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        part = {"functionCall": {"name": "system_do_thing", "args": {"a": 1}}}
        result = hooks.on_function_call(part, "wrench", "Doing thing")

        assert "callId" in result
        assert "reporter" in result

        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert len(events) == 1
        fc_event = events[0]
        assert fc_event["type"] == "functionCall"
        assert fc_event["callId"] == result["callId"]
        assert fc_event["name"] == "system_do_thing"
        assert fc_event["args"] == {"a": 1}
        assert fc_event["icon"] == "wrench"
        assert fc_event["title"] == "Doing thing"

    @pytest.mark.asyncio
    async def test_function_call_without_icon_omits_icon(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        part = {"functionCall": {"name": "fn", "args": {}}}
        hooks.on_function_call(part, None, None)
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert "icon" not in events[0]
        assert "title" not in events[0]

    @pytest.mark.asyncio
    async def test_reporter_emits_subagent_events(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        part = {"functionCall": {"name": "fn", "args": {}}}
        result = hooks.on_function_call(part)
        reporter = result["reporter"]
        call_id = result["callId"]

        reporter["addJson"]("Step 1", {"progress": 50}, "loader")
        err = reporter["addError"]({"$error": "oops"})
        reporter["finish"]()
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        # First event is the functionCall itself.
        assert events[1] == {
            "type": "subagentAddJson",
            "callId": call_id,
            "title": "Step 1",
            "data": {"progress": 50},
            "icon": "loader",
        }
        assert events[2] == {
            "type": "subagentError",
            "callId": call_id,
            "error": {"$error": "oops"},
        }
        assert events[3] == {
            "type": "subagentFinish",
            "callId": call_id,
        }
        # addError returns the error for chaining.
        assert err == {"$error": "oops"}

    @pytest.mark.asyncio
    async def test_on_function_call_update_emits_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        hooks.on_function_call_update("call-1", "loading data")
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {
            "type": "functionCallUpdate",
            "callId": "call-1",
            "status": "loading data",
        }

    @pytest.mark.asyncio
    async def test_on_function_result_emits_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        content = {"parts": [{"text": "result data"}]}
        hooks.on_function_result("call-1", content)
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {
            "type": "functionResult",
            "callId": "call-1",
            "content": content,
        }

    @pytest.mark.asyncio
    async def test_on_send_request_emits_event(self):
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        body = {"contents": [{"parts": [{"text": "hello"}]}]}
        hooks.on_send_request("gemini-3-flash", body)
        sink.close()

        events = []
        async for event in sink:
            events.append(event)

        assert events[0] == {
            "type": "sendRequest",
            "model": "gemini-3-flash",
            "body": body,
        }
