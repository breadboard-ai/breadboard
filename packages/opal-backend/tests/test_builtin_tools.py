# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for built-in tool extraction and loop integration.

Verifies that ``builtin.*`` entries in the function filter are correctly
extracted into Gemini API tool objects and that the Loop merges them
into the request body with ``includeServerSideToolInvocations``.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend.loop import AgentRunArgs, AgentResult, Loop
from opal_backend.function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from opal_backend.run import _extract_builtin_tools, BUILTIN_TOOL_MAP


# =============================================================================
# Helpers
# =============================================================================


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
    """Create the system termination function wired to a LoopController."""

    async def objective_fulfilled(args, status_cb):
        controller.terminate(
            AgentResult(
                success=True,
                outcomes={"parts": [{"text": args.get("objective_outcome", "")}]},
            )
        )
        return {}

    return [
        FunctionDefinition(
            name="system_objective_fulfilled",
            description="Indicates completion.",
            handler=objective_fulfilled,
        ),
    ]


# =============================================================================
# _extract_builtin_tools tests
# =============================================================================


class TestExtractBuiltinTools:
    """Tests for the _extract_builtin_tools helper."""

    def test_none_filter_returns_empty(self):
        """None filter returns no builtin tools and None remaining."""
        tools, remaining = _extract_builtin_tools(None)
        assert tools == []
        assert remaining is None

    def test_empty_filter_returns_empty(self):
        """Empty list returns no builtin tools and empty remaining."""
        tools, remaining = _extract_builtin_tools([])
        assert tools == []
        assert remaining == []

    def test_no_builtin_entries(self):
        """Filter with only function patterns passes through unchanged."""
        tools, remaining = _extract_builtin_tools(["system.*", "chat.*"])
        assert tools == []
        assert remaining == ["system.*", "chat.*"]

    def test_single_builtin_extracted(self):
        """A single builtin.search_grounding is extracted correctly."""
        tools, remaining = _extract_builtin_tools(
            ["system.*", "builtin.search_grounding"],
        )
        assert tools == [{"googleSearch": {}}]
        assert remaining == ["system.*"]

    def test_multiple_builtins_extracted(self):
        """Multiple builtin entries are all extracted."""
        tools, remaining = _extract_builtin_tools([
            "builtin.search_grounding",
            "system.*",
            "builtin.url_context",
            "chat.*",
        ])
        assert {"googleSearch": {}} in tools
        assert {"urlContext": {}} in tools
        assert len(tools) == 2
        assert remaining == ["system.*", "chat.*"]

    def test_all_known_builtins(self):
        """All entries in BUILTIN_TOOL_MAP are extractable."""
        all_patterns = list(BUILTIN_TOOL_MAP.keys())
        tools, remaining = _extract_builtin_tools(all_patterns)
        assert len(tools) == len(BUILTIN_TOOL_MAP)
        assert remaining is None  # Nothing left

    def test_unknown_builtin_skipped(self):
        """Unknown builtin.* entries are silently skipped."""
        tools, remaining = _extract_builtin_tools(
            ["builtin.future_tool", "system.*"],
        )
        assert tools == []
        assert remaining == ["system.*"]

    def test_only_builtins_returns_none_remaining(self):
        """When only builtins are in the filter, remaining is None."""
        tools, remaining = _extract_builtin_tools(
            ["builtin.search_grounding", "builtin.maps_grounding"],
        )
        assert len(tools) == 2
        assert remaining is None

    def test_maps_grounding(self):
        """builtin.maps_grounding maps to googleMaps."""
        tools, _ = _extract_builtin_tools(["builtin.maps_grounding"])
        assert tools == [{"googleMaps": {}}]

    def test_code_execution(self):
        """builtin.code_execution maps to codeExecution."""
        tools, _ = _extract_builtin_tools(["builtin.code_execution"])
        assert tools == [{"codeExecution": {}}]

    def test_wildcard_raises_error(self):
        """builtin.* wildcard raises ValueError with guidance."""
        with pytest.raises(ValueError, match="builtin.* wildcard is not supported"):
            _extract_builtin_tools(["files.*", "builtin.*", "events.*"])


# =============================================================================
# Loop integration tests — builtin tools in the request body
# =============================================================================


class TestLoopBuiltinTools:
    """Tests that the Loop correctly merges builtin tools into the API body."""

    @pytest.mark.asyncio
    async def test_builtin_tools_in_request_body(self):
        """Builtin tools appear as separate entries in the tools array."""
        loop = Loop(backend=MagicMock())

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        captured_bodies: list[dict] = []

        async def capturing_stream(model, body, **kwargs):
            captured_bodies.append(body)
            yield make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done"},
            )

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=capturing_stream,
        ):
            await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Test"}], "role": "user"},
                    function_groups=[group],
                    builtin_tools=[{"googleSearch": {}}],
                )
            )

        assert len(captured_bodies) == 1
        body = captured_bodies[0]

        # tools array should have functionDeclarations + googleSearch
        tools = body["tools"]
        assert len(tools) == 2
        assert "functionDeclarations" in tools[0]
        assert tools[1] == {"googleSearch": {}}

        # toolConfig should have includeServerSideToolInvocations
        tool_config = body["toolConfig"]
        assert tool_config["includeServerSideToolInvocations"] is True
        assert tool_config["functionCallingConfig"]["mode"] == "ANY"

    @pytest.mark.asyncio
    async def test_no_builtin_tools_no_flag(self):
        """Without builtin tools, includeServerSideToolInvocations is absent."""
        loop = Loop(backend=MagicMock())

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        captured_bodies: list[dict] = []

        async def capturing_stream(model, body, **kwargs):
            captured_bodies.append(body)
            yield make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done"},
            )

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=capturing_stream,
        ):
            await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Test"}], "role": "user"},
                    function_groups=[group],
                )
            )

        body = captured_bodies[0]

        # tools array should only have functionDeclarations
        tools = body["tools"]
        assert len(tools) == 1
        assert "functionDeclarations" in tools[0]

        # toolConfig should NOT have includeServerSideToolInvocations
        tool_config = body["toolConfig"]
        assert "includeServerSideToolInvocations" not in tool_config

    @pytest.mark.asyncio
    async def test_multiple_builtin_tools(self):
        """Multiple builtin tools all appear in the tools array."""
        loop = Loop(backend=MagicMock())

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        captured_bodies: list[dict] = []

        async def capturing_stream(model, body, **kwargs):
            captured_bodies.append(body)
            yield make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done"},
            )

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=capturing_stream,
        ):
            await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Test"}], "role": "user"},
                    function_groups=[group],
                    builtin_tools=[
                        {"googleSearch": {}},
                        {"urlContext": {}},
                    ],
                )
            )

        tools = captured_bodies[0]["tools"]
        # functionDeclarations + 2 builtin tools
        assert len(tools) == 3
        assert tools[1] == {"googleSearch": {}}
        assert tools[2] == {"urlContext": {}}

    @pytest.mark.asyncio
    async def test_builtin_only_turn_continues_loop(self):
        """A model turn with no function calls (only text) loops back.

        This simulates what happens when the model uses only a built-in
        tool (which produces text, not functionCall parts) and then calls
        a custom function on the next turn.
        """
        loop = Loop(backend=MagicMock())

        system_fns = make_system_functions(loop.controller)
        mapped = map_definitions(system_fns)
        group = FunctionGroup(
            definitions=mapped.definitions,
            declarations=mapped.declarations,
        )

        turn = 0

        async def multi_turn_stream(model, body, **kwargs):
            nonlocal turn
            turn += 1
            if turn == 1:
                # Turn 1: model responds with text only (simulating
                # built-in tool producing a text response).
                yield {
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": "Search results: ..."}],
                                "role": "model",
                            }
                        }
                    ]
                }
            else:
                # Turn 2: model calls a custom function to finish.
                yield make_function_call_chunk(
                    "system_objective_fulfilled",
                    {"objective_outcome": "Done with search"},
                )

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=multi_turn_stream,
        ):
            result = await loop.run(
                AgentRunArgs(
                    objective={"parts": [{"text": "Search and finish"}], "role": "user"},
                    function_groups=[group],
                    builtin_tools=[{"googleSearch": {}}],
                )
            )

        assert isinstance(result, AgentResult)
        assert result.success is True
        assert turn == 2  # Both turns executed
