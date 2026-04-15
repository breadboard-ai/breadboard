# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the MCP bridge module."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bees.functions.mcp_bridge import (
    MCPConnection,
    MCPRegistry,
    _build_function_group,
    _expand_env_values,
    _make_proxy_handler,
    _mcp_tool_to_declaration,
)


# ---------------------------------------------------------------------------
# Schema translation
# ---------------------------------------------------------------------------


class TestSchemaTranslation:
    """Test MCP tool → Gemini declaration translation."""

    def test_basic_tool(self):
        tool = {
            "name": "get_forecast",
            "description": "Get weather forecast",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                },
                "required": ["location"],
            },
        }
        decl = _mcp_tool_to_declaration("weather", tool)

        assert decl["name"] == "weather_get_forecast"
        assert decl["description"] == "Get weather forecast"
        assert decl["parametersJsonSchema"] == tool["inputSchema"]

    def test_tool_without_schema(self):
        tool = {
            "name": "ping",
            "description": "Health check",
        }
        decl = _mcp_tool_to_declaration("myserver", tool)

        assert decl["name"] == "myserver_ping"
        assert "parametersJsonSchema" not in decl

    def test_tool_without_description(self):
        tool = {
            "name": "do_thing",
            "inputSchema": {"type": "object"},
        }
        decl = _mcp_tool_to_declaration("srv", tool)

        assert decl["name"] == "srv_do_thing"
        assert decl["description"] == ""


# ---------------------------------------------------------------------------
# Proxy handler
# ---------------------------------------------------------------------------


@dataclass
class FakeContent:
    type: str = "text"
    text: str = ""


@dataclass
class FakeToolResult:
    content: list[FakeContent] = field(default_factory=list)
    isError: bool = False


class TestProxyHandler:
    """Test the proxy handler that calls MCP tools."""

    @pytest.mark.asyncio
    async def test_successful_call(self):
        session = AsyncMock()
        session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="72°F, partly cloudy")],
        )

        handler = _make_proxy_handler(session, "get_forecast", "weather")
        result = await handler({"location": "NYC"}, None)

        session.call_tool.assert_called_once_with(
            "get_forecast", arguments={"location": "NYC"},
        )
        assert result == {"result": "72°F, partly cloudy"}

    @pytest.mark.asyncio
    async def test_multiple_content_items(self):
        session = AsyncMock()
        session.call_tool.return_value = FakeToolResult(
            content=[
                FakeContent(text="Line 1"),
                FakeContent(text="Line 2"),
            ],
        )

        handler = _make_proxy_handler(session, "multi", "srv")
        result = await handler({}, None)

        assert result == {"result": "Line 1\nLine 2"}

    @pytest.mark.asyncio
    async def test_error_result(self):
        session = AsyncMock()
        session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="Rate limit exceeded")],
            isError=True,
        )

        handler = _make_proxy_handler(session, "fetch", "api")
        result = await handler({}, None)

        assert "error" in result
        assert "Rate limit" in result["error"]

    @pytest.mark.asyncio
    async def test_exception_during_call(self):
        session = AsyncMock()
        session.call_tool.side_effect = ConnectionError("Server down")

        handler = _make_proxy_handler(session, "call", "broken")
        result = await handler({}, None)

        assert "error" in result
        assert "Server down" in result["error"]

    @pytest.mark.asyncio
    async def test_status_callback(self):
        session = AsyncMock()
        session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="ok")],
        )
        status_cb = MagicMock()

        handler = _make_proxy_handler(session, "tool", "srv")
        await handler({}, status_cb)

        # Called with status message, then cleared.
        assert status_cb.call_count == 2
        status_cb.assert_any_call("Calling srv_tool")
        status_cb.assert_any_call(None, None)

    @pytest.mark.asyncio
    async def test_empty_content(self):
        session = AsyncMock()
        session.call_tool.return_value = FakeToolResult(content=[])

        handler = _make_proxy_handler(session, "quiet", "srv")
        result = await handler({}, None)

        assert result == {"result": "(no output)"}


# ---------------------------------------------------------------------------
# Function group construction
# ---------------------------------------------------------------------------


class TestFunctionGroup:
    """Test building a FunctionGroup from an MCPConnection."""

    def test_group_name(self):
        conn = MCPConnection(
            name="weather",
            description="Weather tools",
            tools=[
                {
                    "name": "get_forecast",
                    "description": "Forecast",
                    "inputSchema": {"type": "object"},
                },
            ],
            session=MagicMock(),
        )
        group = _build_function_group(conn)

        assert group.name == "weather"

    def test_instruction_from_description(self):
        conn = MCPConnection(
            name="weather",
            description="Weather data and forecasts",
            tools=[],
            session=MagicMock(),
        )
        group = _build_function_group(conn)

        assert group.instruction == "## weather\n\nWeather data and forecasts"

    def test_no_instruction_when_no_description(self):
        conn = MCPConnection(
            name="weather",
            description="",
            tools=[],
            session=MagicMock(),
        )
        group = _build_function_group(conn)

        assert group.instruction is None

    def test_declarations_match_tools(self):
        conn = MCPConnection(
            name="srv",
            description="",
            tools=[
                {"name": "a", "description": "Tool A", "inputSchema": {}},
                {"name": "b", "description": "Tool B"},
            ],
            session=MagicMock(),
        )
        group = _build_function_group(conn)

        names = [d["name"] for d in group.declarations]
        assert names == ["srv_a", "srv_b"]

    def test_definitions_have_handlers(self):
        conn = MCPConnection(
            name="srv",
            description="",
            tools=[
                {"name": "a", "description": "Tool A"},
            ],
            session=MagicMock(),
        )
        group = _build_function_group(conn)

        assert len(group.definitions) == 1
        name, func_def = group.definitions[0]
        assert name == "srv_a"
        assert callable(func_def.handler)


# ---------------------------------------------------------------------------
# Environment variable expansion
# ---------------------------------------------------------------------------


class TestEnvExpansion:
    """Test ${VAR} expansion in config values."""

    def test_expand_env_var(self, monkeypatch):
        monkeypatch.setenv("MY_KEY", "secret123")
        result = _expand_env_values({"Authorization": "Bearer ${MY_KEY}"})
        assert result == {"Authorization": "Bearer secret123"}

    def test_missing_env_var_becomes_empty(self, monkeypatch):
        monkeypatch.delenv("MISSING_VAR", raising=False)
        result = _expand_env_values({"key": "${MISSING_VAR}"})
        assert result == {"key": ""}

    def test_none_passthrough(self):
        assert _expand_env_values(None) is None

    def test_no_vars_passthrough(self):
        result = _expand_env_values({"key": "plain-value"})
        assert result == {"key": "plain-value"}

    def test_multiple_vars_in_one_value(self, monkeypatch):
        monkeypatch.setenv("A", "hello")
        monkeypatch.setenv("B", "world")
        result = _expand_env_values({"msg": "${A} ${B}"})
        assert result == {"msg": "hello world"}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class TestRegistry:
    """Test MCPRegistry validation."""

    @pytest.mark.asyncio
    async def test_builtin_collision_raises(self):
        """Registering a server with a built-in group name must fail."""
        registry = MCPRegistry()
        configs = [{"name": "system", "command": "echo"}]

        with pytest.raises(ValueError, match="collides with built-in"):
            await registry.connect_all(configs)

    @pytest.mark.asyncio
    async def test_missing_transport_raises(self):
        """Registering a server without command or url must fail."""
        registry = MCPRegistry()
        configs = [{"name": "myserver"}]

        with pytest.raises(ValueError, match="requires either"):
            await registry.connect_all(configs)


