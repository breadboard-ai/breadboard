# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the agent loop core (4.4a).

Uses mock Gemini responses to test the Loop, FunctionCaller, and their
interaction without making real API calls.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend_shared.function_caller import FunctionCaller
from opal_backend_shared.function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from opal_backend_shared.loop import (
    AgentResult,
    AgentRunArgs,
    Loop,
    LoopHooks,
    err,
    ok,
)


# =============================================================================
# Helpers
# =============================================================================


def make_text_chunk(text: str, thought: bool = False) -> dict:
    """Create a Gemini response chunk with a text part."""
    part: dict = {"text": text}
    if thought:
        part["thought"] = True
    return {
        "candidates": [
            {
                "content": {
                    "parts": [part],
                    "role": "model",
                }
            }
        ]
    }


def make_function_call_chunk(name: str, args: dict | None = None) -> dict:
    """Create a Gemini response chunk with a function call."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "functionCall": {
                                "name": name,
                                "args": args or {},
                            }
                        }
                    ],
                    "role": "model",
                }
            }
        ]
    }


def make_system_functions(controller) -> list[FunctionDefinition]:
    """Create the two system termination functions wired to a LoopController."""

    async def objective_fulfilled(args, status_cb):
        controller.terminate(
            AgentResult(
                success=True,
                href=args.get("href", "/"),
                outcomes={"parts": [{"text": args.get("objective_outcome", "")}]},
            )
        )
        return {}

    async def failed_to_fulfill(args, status_cb):
        controller.terminate(
            AgentResult(
                success=False,
                outcomes={"parts": [{"text": args.get("user_message", "")}]},
            )
        )
        return {}

    return [
        FunctionDefinition(
            name="system_objective_fulfilled",
            description="Indicates completion of the overall objective.",
            handler=objective_fulfilled,
            icon="check_circle",
            title="Returning final outcome",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "objective_outcome": {"type": "string"},
                    "href": {"type": "string", "default": "/"},
                },
                "required": ["objective_outcome"],
            },
        ),
        FunctionDefinition(
            name="system_failed_to_fulfill_objective",
            description="Indicates that the agent failed to fulfill the objective.",
            handler=failed_to_fulfill,
            icon="cancel",
            title="Unable to proceed",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "user_message": {"type": "string"},
                },
                "required": ["user_message"],
            },
        ),
    ]


# =============================================================================
# FunctionCaller Tests
# =============================================================================


class TestFunctionCaller:
    """Tests for the FunctionCaller dispatch."""

    @pytest.mark.asyncio
    async def test_no_calls_returns_none(self):
        caller = FunctionCaller({})
        result = await caller.get_results()
        assert result is None

    @pytest.mark.asyncio
    async def test_single_function_call(self):
        async def echo_handler(args, status_cb):
            return {"echo": args.get("input", "")}

        defn = FunctionDefinition(
            name="echo",
            description="Echoes input",
            handler=echo_handler,
        )
        caller = FunctionCaller({"echo": defn})

        caller.call(
            "call-1",
            {"functionCall": {"name": "echo", "args": {"input": "hello"}}},
        )

        result = await caller.get_results()
        assert result is not None
        assert len(result["results"]) == 1
        assert result["results"][0].call_id == "call-1"
        assert (
            result["results"][0].response["functionResponse"]["response"]["echo"]
            == "hello"
        )

    @pytest.mark.asyncio
    async def test_concurrent_function_calls(self):
        call_order = []

        async def slow_fn(args, status_cb):
            call_order.append(f"start-{args['id']}")
            await asyncio.sleep(0.01)
            call_order.append(f"end-{args['id']}")
            return {"id": args["id"]}

        defn = FunctionDefinition(
            name="slow", description="Slow fn", handler=slow_fn
        )
        caller = FunctionCaller({"slow": defn})

        caller.call("c1", {"functionCall": {"name": "slow", "args": {"id": "1"}}})
        caller.call("c2", {"functionCall": {"name": "slow", "args": {"id": "2"}}})

        result = await caller.get_results()
        assert result is not None
        assert len(result["results"]) == 2
        # Both should have started before either finished (concurrent)
        assert call_order[0].startswith("start-")
        assert call_order[1].startswith("start-")

    @pytest.mark.asyncio
    async def test_unknown_function_returns_error(self):
        caller = FunctionCaller({})
        caller.call(
            "c1",
            {"functionCall": {"name": "nonexistent", "args": {}}},
        )
        result = await caller.get_results()
        assert result is not None
        assert "error" in result["results"][0].response["functionResponse"]["response"]

    @pytest.mark.asyncio
    async def test_combined_content_has_user_role(self):
        async def noop(args, status_cb):
            return {"ok": True}

        defn = FunctionDefinition(name="noop", description="Noop", handler=noop)
        caller = FunctionCaller({"noop": defn})

        caller.call("c1", {"functionCall": {"name": "noop", "args": {}}})
        result = await caller.get_results()
        assert result["combined"]["role"] == "user"


# =============================================================================
# FunctionDefinition Tests
# =============================================================================


class TestFunctionDefinition:
    """Tests for function definition types and helpers."""

    def test_map_definitions(self):
        async def handler(args, status_cb):
            return {}

        defs = [
            FunctionDefinition(
                name="fn1",
                description="First function",
                handler=handler,
                parameters_json_schema={"type": "object"},
            ),
            FunctionDefinition(
                name="fn2",
                description="Second function",
                handler=handler,
            ),
        ]

        mapped = map_definitions(defs)
        assert len(mapped.definitions) == 2
        assert len(mapped.declarations) == 2
        assert mapped.declarations[0]["name"] == "fn1"
        assert "parametersJsonSchema" in mapped.declarations[0]
        assert mapped.declarations[1]["name"] == "fn2"
        assert "parametersJsonSchema" not in mapped.declarations[1]

    def test_function_group_inherits_mapped_definitions(self):
        group = FunctionGroup(
            definitions=[],
            declarations=[],
            instruction="You are an agent.",
        )
        assert group.instruction == "You are an agent."


# =============================================================================
# Loop Tests
# =============================================================================


class TestLoop:
    """Tests for the main agent loop with mocked Gemini."""

    @pytest.mark.asyncio
    async def test_loop_terminates_on_success(self):
        """The loop should stop when system_objective_fulfilled is called."""
        loop = Loop()

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
            instruction="Test instruction",
        )

        # Mock Gemini to return a function call to declare success
        chunks = [
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done!", "href": "/"},
            ),
        ]

        async def mock_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend_shared.loop.stream_generate_content",
            side_effect=mock_stream,
        ):
            result = await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Do something"}], "role": "user"},
                    function_groups=[group],
                )
            )

        assert isinstance(result, AgentResult)
        assert result.success is True
        assert result.outcomes is not None

    @pytest.mark.asyncio
    async def test_loop_terminates_on_failure(self):
        """The loop should stop when system_failed_to_fulfill is called."""
        loop = Loop()

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        chunks = [
            make_function_call_chunk(
                "system_failed_to_fulfill_objective",
                {"user_message": "Can't do it"},
            ),
        ]

        async def mock_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend_shared.loop.stream_generate_content",
            side_effect=mock_stream,
        ):
            result = await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Do something"}], "role": "user"},
                    function_groups=[group],
                )
            )

        assert isinstance(result, AgentResult)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_loop_emits_hooks(self):
        """Hooks should be called at the right lifecycle points."""
        loop = Loop()

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        events: list[str] = []

        hooks = LoopHooks(
            on_start=lambda obj: events.append("start"),
            on_finish=lambda: events.append("finish"),
            on_content=lambda c: events.append("content"),
            on_thought=lambda t: events.append(f"thought:{t}"),
            on_send_request=lambda m, b: events.append("send_request"),
            on_turn_complete=lambda: events.append("turn_complete"),
        )

        chunks = [
            make_text_chunk("Thinking...", thought=True),
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done!"},
            ),
        ]

        async def mock_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend_shared.loop.stream_generate_content",
            side_effect=mock_stream,
        ):
            await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Test"}], "role": "user"},
                    function_groups=[group],
                    hooks=hooks,
                )
            )

        assert "start" in events
        assert "finish" in events
        assert "send_request" in events
        assert "content" in events
        assert any(e.startswith("thought:") for e in events)
        assert "turn_complete" in events

    @pytest.mark.asyncio
    async def test_loop_handles_empty_candidates(self):
        """The loop should return an error if Gemini returns no candidates."""
        loop = Loop()

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        async def mock_stream(*args, **kwargs):
            yield {"candidates": []}

        with patch(
            "opal_backend_shared.loop.stream_generate_content",
            side_effect=mock_stream,
        ):
            result = await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Test"}], "role": "user"},
                    function_groups=[group],
                )
            )

        assert not ok(result)
        assert "$error" in result

    @pytest.mark.asyncio
    async def test_loop_multiple_turns(self):
        """The loop should handle multiple turns before termination."""
        loop = Loop()

        call_count = 0

        async def counting_fn(args, status_cb):
            nonlocal call_count
            call_count += 1
            return {"count": call_count}

        system_fns = make_system_functions(loop.controller)
        system_fns.append(
            FunctionDefinition(
                name="count",
                description="Count calls",
                handler=counting_fn,
                parameters_json_schema={"type": "object", "properties": {}},
            )
        )

        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        turn = 0

        async def mock_stream(*args, **kwargs):
            nonlocal turn
            turn += 1
            if turn < 3:
                yield make_function_call_chunk("count", {})
            else:
                yield make_function_call_chunk(
                    "system_objective_fulfilled",
                    {"objective_outcome": f"Called count {call_count} times"},
                )

        with patch(
            "opal_backend_shared.loop.stream_generate_content",
            side_effect=mock_stream,
        ):
            result = await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Count"}], "role": "user"},
                    function_groups=[group],
                )
            )

        assert isinstance(result, AgentResult)
        assert result.success is True
        assert call_count == 2


# =============================================================================
# Gemini Client Tests
# =============================================================================


class TestGeminiClient:
    """Tests for the Gemini streaming client."""

    @pytest.mark.asyncio
    async def test_parse_sse_chunks(self):
        from opal_backend_shared.gemini_client import _parse_sse_stream

        # Simulate an httpx response with SSE data
        chunks_data = [
            'data: {"candidates": [{"content": {"parts": [{"text": "Hello"}]}}]}',
            "",
            'data: {"candidates": [{"content": {"parts": [{"text": " World"}]}}]}',
        ]

        class FakeResponse:
            async def aiter_lines(self):
                for line in chunks_data:
                    yield line

        parsed = []
        async for chunk in _parse_sse_stream(FakeResponse()):
            parsed.append(chunk)

        assert len(parsed) == 2
        assert parsed[0]["candidates"][0]["content"]["parts"][0]["text"] == "Hello"
        assert parsed[1]["candidates"][0]["content"]["parts"][0]["text"] == " World"

    def test_has_content(self):
        from opal_backend_shared.gemini_client import has_content

        assert has_content(make_text_chunk("hello")) is True
        assert has_content({"candidates": []}) is False
        assert has_content({"candidates": [{"content": {}}]}) is False
        assert has_content({"candidates": [{"content": {"parts": []}}]}) is False
