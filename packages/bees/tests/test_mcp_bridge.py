# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the MCP bridge module."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bees.functions.mcp_bridge import (
    HiveTokenStorage,
    MCPConnection,
    MCPRegistry,
    OAuthConfig,
    _build_function_group,
    _expand_env_values,
    _make_proxy_handler,
    _mcp_tool_to_declaration,
    _parse_oauth_config,
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
# Helpers
# ---------------------------------------------------------------------------


def _make_conn(
    name: str = "weather",
    description: str = "",
    tools: list[dict] | None = None,
) -> MCPConnection:
    """Create an MCPConnection with tools pre-populated (skipping discovery)."""
    conn = MCPConnection(
        name=name,
        description=description,
        config={"name": name, "url": "https://example.com/mcp"},
    )
    conn.tools = tools or []
    return conn


@dataclass
class FakeContent:
    type: str = "text"
    text: str = ""


@dataclass
class FakeToolResult:
    content: list[FakeContent] = field(default_factory=list)
    isError: bool = False


# ---------------------------------------------------------------------------
# Proxy handler
# ---------------------------------------------------------------------------


class TestProxyHandler:
    """Test the proxy handler that calls MCP tools."""

    @pytest.mark.asyncio
    async def test_successful_call(self):
        conn = _make_conn()
        conn._session = AsyncMock()
        conn._session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="72°F, partly cloudy")],
        )
        conn._ready.set()

        handler = _make_proxy_handler(conn, "get_forecast")
        result = await handler({"location": "NYC"}, None)

        conn._session.call_tool.assert_called_once_with(
            "get_forecast", arguments={"location": "NYC"},
        )
        assert result == {"result": "72°F, partly cloudy"}

    @pytest.mark.asyncio
    async def test_multiple_content_items(self):
        conn = _make_conn(name="srv")
        conn._session = AsyncMock()
        conn._session.call_tool.return_value = FakeToolResult(
            content=[
                FakeContent(text="Line 1"),
                FakeContent(text="Line 2"),
            ],
        )
        conn._ready.set()

        handler = _make_proxy_handler(conn, "multi")
        result = await handler({}, None)

        assert result == {"result": "Line 1\nLine 2"}

    @pytest.mark.asyncio
    async def test_error_result(self):
        conn = _make_conn(name="api")
        conn._session = AsyncMock()
        conn._session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="Rate limit exceeded")],
            isError=True,
        )
        conn._ready.set()

        handler = _make_proxy_handler(conn, "fetch")
        result = await handler({}, None)

        assert "error" in result
        assert "Rate limit" in result["error"]

    @pytest.mark.asyncio
    async def test_exception_returns_error(self):
        """When all retries fail, the handler returns an error dict."""
        conn = _make_conn(name="broken")
        conn._session = AsyncMock()
        conn._session.call_tool.side_effect = ConnectionError("Server down")
        conn._ready.set()

        handler = _make_proxy_handler(conn, "call")
        # Use 0 retries via the conn's call_tool default, but the handler
        # catches the final exception and returns an error dict.
        result = await handler({}, None)

        assert "error" in result
        assert "unavailable" in result["error"]

    @pytest.mark.asyncio
    async def test_status_callback(self):
        conn = _make_conn(name="srv")
        conn._session = AsyncMock()
        conn._session.call_tool.return_value = FakeToolResult(
            content=[FakeContent(text="ok")],
        )
        conn._ready.set()
        status_cb = MagicMock()

        handler = _make_proxy_handler(conn, "tool")
        await handler({}, status_cb)

        # Called with status message, then cleared.
        assert status_cb.call_count == 2
        status_cb.assert_any_call("Calling srv_tool")
        status_cb.assert_any_call(None, None)

    @pytest.mark.asyncio
    async def test_empty_content(self):
        conn = _make_conn(name="srv")
        conn._session = AsyncMock()
        conn._session.call_tool.return_value = FakeToolResult(content=[])
        conn._ready.set()

        handler = _make_proxy_handler(conn, "quiet")
        result = await handler({}, None)

        assert result == {"result": "(no output)"}


# ---------------------------------------------------------------------------
# MCPConnection call_tool retry logic
# ---------------------------------------------------------------------------


class TestCallToolRetry:
    """Test MCPConnection's retry and reconnect behavior."""

    @pytest.mark.asyncio
    async def test_retry_on_failure(self):
        """call_tool retries after a failure."""
        conn = _make_conn()
        conn._session = AsyncMock()
        # Fail first, succeed second.
        conn._session.call_tool.side_effect = [
            ConnectionError("dropped"),
            FakeToolResult(content=[FakeContent(text="ok")]),
        ]
        conn._ready.set()

        # Patch disconnect/connect to be no-ops that keep session alive.
        async def fake_disconnect():
            pass
        async def fake_connect():
            conn._ready.set()
        conn.disconnect = fake_disconnect
        conn.connect = fake_connect

        result = await conn.call_tool("test", {}, retries=1, backoff=0.01)
        assert result.content[0].text == "ok"

    @pytest.mark.asyncio
    async def test_raises_after_retries_exhausted(self):
        """call_tool raises after all retries fail."""
        conn = _make_conn()
        conn._session = AsyncMock()
        conn._session.call_tool.side_effect = ConnectionError("always fails")
        conn._ready.set()

        async def fake_disconnect():
            pass
        async def fake_connect():
            conn._ready.set()
        conn.disconnect = fake_disconnect
        conn.connect = fake_connect

        with pytest.raises(ConnectionError, match="always fails"):
            await conn.call_tool("test", {}, retries=1, backoff=0.01)

    @pytest.mark.asyncio
    async def test_raises_when_not_connected(self):
        """call_tool raises ConnectionError when connect fails."""
        conn = _make_conn()
        # Never set _ready — connection always fails.
        async def fake_connect():
            pass  # Don't set _ready
        conn.connect = fake_connect

        with pytest.raises(ConnectionError, match="could not connect"):
            await conn.call_tool("test", {}, retries=0)


# ---------------------------------------------------------------------------
# Function group construction
# ---------------------------------------------------------------------------


class TestFunctionGroup:
    """Test building a FunctionGroup from an MCPConnection."""

    def test_group_name(self):
        conn = _make_conn(
            name="weather",
            tools=[{
                "name": "get_forecast",
                "description": "Forecast",
                "inputSchema": {"type": "object"},
            }],
        )
        group = _build_function_group(conn)
        assert group.name == "weather"

    def test_instruction_from_description(self):
        conn = _make_conn(
            name="weather",
            description="Weather data and forecasts",
        )
        group = _build_function_group(conn)
        assert group.instruction == "## weather\n\nWeather data and forecasts"

    def test_no_instruction_when_no_description(self):
        conn = _make_conn(name="weather", description="")
        group = _build_function_group(conn)
        assert group.instruction is None

    def test_declarations_match_tools(self):
        conn = _make_conn(
            name="srv",
            tools=[
                {"name": "a", "description": "Tool A", "inputSchema": {}},
                {"name": "b", "description": "Tool B"},
            ],
        )
        group = _build_function_group(conn)
        names = [d["name"] for d in group.declarations]
        assert names == ["srv_a", "srv_b"]

    def test_definitions_have_handlers(self):
        conn = _make_conn(
            name="srv",
            tools=[{"name": "a", "description": "Tool A"}],
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
# OAuth config parsing
# ---------------------------------------------------------------------------


class TestOAuthConfigParsing:
    """Test parsing the oauth block from MCP server config."""

    def test_parse_full_config(self):
        raw = {
            "client_id": "${GOOGLE_CLIENT_ID}",
            "client_secret": "${GOOGLE_CLIENT_SECRET}",
            "scopes": [
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.compose",
            ],
        }
        config = _parse_oauth_config(raw)

        assert config is not None
        assert config.client_id == "${GOOGLE_CLIENT_ID}"
        assert config.client_secret == "${GOOGLE_CLIENT_SECRET}"
        assert len(config.scopes) == 2

    def test_parse_none(self):
        assert _parse_oauth_config(None) is None

    def test_parse_empty_dict(self):
        assert _parse_oauth_config({}) is None

    def test_parse_missing_fields(self):
        config = _parse_oauth_config({"client_id": "abc"})
        assert config is not None
        assert config.client_id == "abc"
        assert config.client_secret == ""
        assert config.scopes == []


# ---------------------------------------------------------------------------
# HiveTokenStorage
# ---------------------------------------------------------------------------


class TestHiveTokenStorage:
    """Test filesystem-backed OAuth token storage."""

    @pytest.mark.asyncio
    async def test_read_missing_tokens(self, tmp_path):
        storage = HiveTokenStorage(tmp_path, "gmail")
        tokens = await storage.get_tokens()
        assert tokens is None

    @pytest.mark.asyncio
    async def test_read_missing_client_info(self, tmp_path):
        storage = HiveTokenStorage(tmp_path, "gmail")
        info = await storage.get_client_info()
        assert info is None

    @pytest.mark.asyncio
    async def test_token_round_trip(self, tmp_path):
        from mcp.shared.auth import OAuthToken

        storage = HiveTokenStorage(tmp_path, "gmail")

        token = OAuthToken(
            access_token="access123",
            refresh_token="refresh456",
            expires_in=3600,
        )
        await storage.set_tokens(token)

        loaded = await storage.get_tokens()
        assert loaded is not None
        assert loaded.access_token == "access123"
        assert loaded.refresh_token == "refresh456"

    @pytest.mark.asyncio
    async def test_client_info_round_trip(self, tmp_path):
        from mcp.shared.auth import OAuthClientInformationFull

        storage = HiveTokenStorage(tmp_path, "gmail")

        client_info = OAuthClientInformationFull(
            client_id="my-client-id",
            client_secret="my-secret",
            redirect_uris=None,
        )
        await storage.set_client_info(client_info)

        loaded = await storage.get_client_info()
        assert loaded is not None
        assert loaded.client_id == "my-client-id"
        assert loaded.client_secret == "my-secret"

    @pytest.mark.asyncio
    async def test_combined_storage(self, tmp_path):
        """Tokens and client_info coexist in the same file."""
        from mcp.shared.auth import OAuthClientInformationFull, OAuthToken

        storage = HiveTokenStorage(tmp_path, "drive")

        await storage.set_client_info(OAuthClientInformationFull(
            client_id="cid", client_secret="cs", redirect_uris=None,
        ))
        await storage.set_tokens(OAuthToken(
            access_token="at", refresh_token="rt",
        ))

        # Both should be readable.
        info = await storage.get_client_info()
        tokens = await storage.get_tokens()
        assert info is not None and info.client_id == "cid"
        assert tokens is not None and tokens.access_token == "at"

        # Verify on-disk structure.
        raw = json.loads(storage._path.read_text())
        assert "tokens" in raw
        assert "client_info" in raw

    @pytest.mark.asyncio
    async def test_directory_created_on_write(self, tmp_path):
        storage = HiveTokenStorage(tmp_path, "calendar")
        from mcp.shared.auth import OAuthToken

        await storage.set_tokens(OAuthToken(access_token="x"))
        assert storage._path.exists()
        assert storage._dir.is_dir()

    @pytest.mark.asyncio
    async def test_corrupt_json_returns_none(self, tmp_path):
        storage = HiveTokenStorage(tmp_path, "gmail")
        storage._dir.mkdir(parents=True, exist_ok=True)
        storage._path.write_text("not valid json{{{")

        tokens = await storage.get_tokens()
        assert tokens is None

    @pytest.mark.asyncio
    async def test_invalid_token_data_returns_none(self, tmp_path):
        storage = HiveTokenStorage(tmp_path, "gmail")
        storage._dir.mkdir(parents=True, exist_ok=True)
        # Valid JSON but invalid token structure.
        storage._path.write_text(json.dumps({
            "tokens": {"unexpected_field": True},
        }))

        tokens = await storage.get_tokens()
        assert tokens is None


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


# ---------------------------------------------------------------------------
# Registry OAuth validation
# ---------------------------------------------------------------------------


class TestRegistryOAuthValidation:
    """Test connect_all validation for OAuth configs."""

    @pytest.mark.asyncio
    async def test_oauth_without_url_raises(self):
        registry = MCPRegistry()
        configs = [{
            "name": "gmail",
            "command": "echo",
            "oauth": {"client_id": "x", "client_secret": "y", "scopes": []},
        }]

        with pytest.raises(ValueError, match="OAuth requires HTTP"):
            await registry.connect_all(configs, hive_dir=Path("/tmp"))

    @pytest.mark.asyncio
    async def test_oauth_with_headers_raises(self):
        registry = MCPRegistry()
        configs = [{
            "name": "gmail",
            "url": "https://example.com/mcp",
            "oauth": {"client_id": "x", "client_secret": "y", "scopes": []},
            "headers": {"x-api-key": "should-not-be-here"},
        }]

        with pytest.raises(ValueError, match="mutually exclusive"):
            await registry.connect_all(configs, hive_dir=Path("/tmp"))

    @pytest.mark.asyncio
    async def test_oauth_without_hive_dir_raises(self):
        registry = MCPRegistry()
        configs = [{
            "name": "gmail",
            "url": "https://example.com/mcp",
            "oauth": {"client_id": "x", "client_secret": "y", "scopes": []},
        }]

        with pytest.raises(ValueError, match="hive_dir"):
            await registry.connect_all(configs)

    @pytest.mark.asyncio
    async def test_oauth_skips_when_no_tokens(self, tmp_path, monkeypatch):
        """OAuth server with no tokens should skip gracefully."""
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")

        registry = MCPRegistry()
        configs = [{
            "name": "gmail",
            "url": "https://gmailmcp.googleapis.com/mcp/v1",
            "oauth": {
                "client_id": "${GOOGLE_CLIENT_ID}",
                "client_secret": "${GOOGLE_CLIENT_SECRET}",
                "scopes": ["https://www.googleapis.com/auth/gmail.readonly"],
            },
        }]

        # Should not raise — graceful skip.
        await registry.connect_all(configs, hive_dir=tmp_path)

        # No connections established.
        assert registry.get_factories() == []

    @pytest.mark.asyncio
    async def test_oauth_skips_when_client_id_empty(self, tmp_path, monkeypatch):
        """OAuth server with empty client_id after expansion should skip."""
        monkeypatch.delenv("MISSING_VAR", raising=False)

        registry = MCPRegistry()
        configs = [{
            "name": "gmail",
            "url": "https://gmailmcp.googleapis.com/mcp/v1",
            "oauth": {
                "client_id": "${MISSING_VAR}",
                "client_secret": "${MISSING_VAR}",
                "scopes": [],
            },
        }]

        await registry.connect_all(configs, hive_dir=tmp_path)
        assert registry.get_factories() == []

    @pytest.mark.asyncio
    async def test_refreshable_auth_loads_tokens(self, tmp_path, monkeypatch):
        """_RefreshableOAuthAuth should load tokens from storage."""
        from bees.functions.mcp_bridge import _RefreshableOAuthAuth

        storage = HiveTokenStorage(tmp_path, "gmail")
        from mcp.shared.auth import OAuthToken
        await storage.set_tokens(OAuthToken(
            access_token="test-access",
            token_type="Bearer",
            refresh_token="test-refresh",
        ))

        auth = _RefreshableOAuthAuth(
            storage=storage,
            client_id="cid",
            client_secret="cs",
        )

        # Simulate loading.
        await auth._load_tokens()
        assert auth._access_token == "test-access"
        assert auth._refresh_token == "test-refresh"
