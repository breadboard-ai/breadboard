# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""MCP bridge — turns external MCP servers into bees function groups.

Each MCP server registered in ``SYSTEM.yaml`` becomes a function group
that agents can use via the existing ``functions`` filter.  For example,
a server named ``weather`` with tool ``get_forecast`` becomes the
function group ``weather`` containing ``weather_get_forecast``.

Lifecycle:
- ``MCPRegistry.connect_all()`` at scheduler startup
- ``MCPRegistry.get_factories()`` for each session
- ``MCPRegistry.disconnect_all()`` at scheduler shutdown

Connections are shared across agent sessions.  MCP uses JSON-RPC with
unique request IDs, so concurrent tool calls from parallel agents are
multiplexed correctly.

.. note::
   Stateful MCP servers that assume sequential usage may behave
   unexpectedly in a parallel swarm.  TODO: add a ``stateful`` flag
   that forces per-agent connections.
"""

from __future__ import annotations

import json
import logging
import os
import re
from contextlib import AsyncExitStack
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from bees.protocols.functions import (
    FunctionDefinition,
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
)

logger = logging.getLogger(__name__)

_BUILTIN_GROUP_NAMES = frozenset({
    "system", "chat", "files", "sandbox",
    "events", "tasks", "skills", "generate",
})
MCP_TOKENS_DIR = ".mcp-tokens"


# ---------------------------------------------------------------------------
# Environment variable expansion
# ---------------------------------------------------------------------------

_ENV_VAR_PATTERN = re.compile(r"\$\{([^}]+)\}")


def _expand_env_values(
    mapping: dict[str, str] | None,
) -> dict[str, str] | None:
    """Expand ``${VAR}`` references in a dict's values.

    Reads from ``os.environ``.  Missing variables expand to the empty
    string and log a warning.
    """
    if not mapping:
        return mapping

    def _replace(match: re.Match) -> str:
        var = match.group(1)
        value = os.environ.get(var)
        if value is None:
            logger.warning(
                "Environment variable '%s' not set (referenced in MCP config)",
                var,
            )
            return ""
        return value

    return {
        key: _ENV_VAR_PATTERN.sub(_replace, val)
        for key, val in mapping.items()
    }


# ---------------------------------------------------------------------------
# OAuth configuration
# ---------------------------------------------------------------------------


@dataclass
class OAuthConfig:
    """OAuth 2.0 configuration parsed from SYSTEM.yaml.

    Client credentials are always ``${ENV_VAR}`` references, expanded
    at connect time via ``_expand_env_values``.
    """

    client_id: str
    client_secret: str
    scopes: list[str]


def _parse_oauth_config(
    raw: dict[str, Any] | None,
) -> OAuthConfig | None:
    """Parse an ``oauth`` block from an MCP server config entry.

    Returns ``None`` if the block is absent or empty.
    """
    if not raw:
        return None
    return OAuthConfig(
        client_id=str(raw.get("client_id", "")),
        client_secret=str(raw.get("client_secret", "")),
        scopes=[str(s) for s in raw.get("scopes", [])],
    )


# ---------------------------------------------------------------------------
# Token storage (filesystem-backed)
# ---------------------------------------------------------------------------


class HiveTokenStorage:
    """Persist OAuth tokens at ``hive/.mcp-tokens/<server>.json``.

    Implements the MCP SDK's ``TokenStorage`` protocol.  The ``.mcp-tokens``
    directory sits at the hive root, outside ``config/``, so writes do
    not trigger cold restarts in the box's file watcher.
    """

    def __init__(self, hive_dir: Path, server_name: str) -> None:
        self._dir = hive_dir / MCP_TOKENS_DIR
        self._path = self._dir / f"{server_name}.json"

    def _read(self) -> dict[str, Any]:
        """Read the token file, returning an empty dict if missing."""
        if not self._path.exists():
            return {}
        try:
            return json.loads(self._path.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning(
                "Failed to read token file %s: %s", self._path, exc,
            )
            return {}

    def _write(self, data: dict[str, Any]) -> None:
        """Write the token file, creating the directory if needed."""
        self._dir.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(data, indent=2, default=str) + "\n",
        )

    # -- TokenStorage protocol -----------------------------------------

    async def get_tokens(self) -> Any:
        """Get stored OAuth tokens."""
        from mcp.shared.auth import OAuthToken

        data = self._read()
        tokens = data.get("tokens")
        if not tokens:
            return None
        try:
            return OAuthToken(**tokens)
        except Exception:
            logger.warning("Invalid token data in %s", self._path)
            return None

    async def set_tokens(self, tokens: Any) -> None:
        """Store OAuth tokens."""
        data = self._read()
        data["tokens"] = tokens.model_dump()
        self._write(data)

    async def get_client_info(self) -> Any:
        """Get stored client information."""
        from mcp.shared.auth import OAuthClientInformationFull

        data = self._read()
        client_info = data.get("client_info")
        if not client_info:
            return None
        try:
            return OAuthClientInformationFull(**client_info)
        except Exception:
            logger.warning("Invalid client info in %s", self._path)
            return None

    async def set_client_info(self, client_info: Any) -> None:
        """Store client information."""
        data = self._read()
        data["client_info"] = client_info.model_dump()
        self._write(data)


# ---------------------------------------------------------------------------
# MCP connection
# ---------------------------------------------------------------------------


@dataclass
class MCPConnection:
    """A live connection to a single MCP server."""

    name: str
    description: str
    tools: list[dict[str, Any]]
    session: Any  # mcp.ClientSession


# ---------------------------------------------------------------------------
# Schema translation
# ---------------------------------------------------------------------------


def _mcp_tool_to_declaration(
    server_name: str, tool: dict[str, Any],
) -> dict[str, Any]:
    """Translate an MCP tool definition to a Gemini function declaration.

    The function name is prefixed with the server name to avoid
    cross-server collisions: MCP tool ``get_forecast`` on server
    ``weather`` becomes ``weather_get_forecast``.
    """
    prefixed_name = f"{server_name}_{tool['name']}"
    decl: dict[str, Any] = {
        "name": prefixed_name,
        "description": tool.get("description", ""),
    }
    input_schema = tool.get("inputSchema")
    if input_schema:
        decl["parametersJsonSchema"] = input_schema
    return decl


def _make_proxy_handler(
    session: Any, tool_name: str, server_name: str,
):
    """Create an async handler that proxies a tool call to the MCP server."""

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        prefixed = f"{server_name}_{tool_name}"
        if status_cb:
            status_cb(f"Calling {prefixed}")

        try:
            result = await session.call_tool(tool_name, arguments=args)
        except Exception as exc:
            logger.error(
                "MCP tool call failed: %s on %s: %s",
                tool_name, server_name, exc,
            )
            if status_cb:
                status_cb(None, None)
            return {"error": f"MCP tool call failed: {exc}"}

        if status_cb:
            status_cb(None, None)

        # Flatten MCP content array into a result dict.
        texts = []
        for item in (result.content or []):
            if hasattr(item, "text"):
                texts.append(item.text)
            elif hasattr(item, "type") and item.type == "text":
                texts.append(getattr(item, "text", ""))

        if result.isError:
            return {"error": "\n".join(texts) if texts else "MCP tool returned error"}

        return {"result": "\n".join(texts) if texts else "(no output)"}

    return handler


# ---------------------------------------------------------------------------
# Factory construction
# ---------------------------------------------------------------------------


def _build_function_group(conn: MCPConnection) -> FunctionGroup:
    """Build a FunctionGroup from a live MCP connection."""
    definitions: list[FunctionDefinition] = []
    declarations: list[dict[str, Any]] = []

    for tool in conn.tools:
        decl = _mcp_tool_to_declaration(conn.name, tool)
        declarations.append(decl)

        func_def = FunctionDefinition(
            name=decl["name"],
            description=decl.get("description", ""),
            handler=_make_proxy_handler(
                conn.session, tool["name"], conn.name,
            ),
            parameters_json_schema=decl.get("parametersJsonSchema"),
        )
        definitions.append(func_def)

    instruction = (
        f"## {conn.name}\n\n{conn.description}"
        if conn.description
        else None
    )

    return FunctionGroup(
        name=conn.name,
        definitions=[(d.name, d) for d in definitions],
        declarations=declarations,
        instruction=instruction,
    )


def _mcp_function_group_factory(conn: MCPConnection) -> FunctionGroupFactory:
    """Return a factory that builds the function group for an MCP server.

    The factory is called once per session with ``SessionHooks``.
    MCP function groups don't use session hooks (they proxy to the
    external server), so the hooks argument is ignored.
    """
    # Build once — the group is stateless (shared connection).
    group = _build_function_group(conn)

    def factory(hooks: SessionHooks) -> FunctionGroup:
        return group

    return factory


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


class MCPRegistry:
    """Manages the lifecycle of all registered MCP server connections.

    Usage::

        registry = MCPRegistry()
        await registry.connect_all(configs)  # at startup
        factories = registry.get_factories()  # per session
        await registry.disconnect_all()       # at shutdown
    """

    def __init__(self) -> None:
        self._connections: list[MCPConnection] = []
        self._factories: list[FunctionGroupFactory] = []
        self._exit_stack = AsyncExitStack()

    async def connect_all(
        self,
        configs: list[dict[str, Any]],
        *,
        hive_dir: Path | None = None,
    ) -> None:
        """Connect to all MCP servers described in the config list.

        Each config dict has:
        - ``name``: server name (becomes the function group name)
        - ``description``: optional system instruction fragment
        - ``command``: shell command for stdio transport
        - ``url``: URL for Streamable HTTP transport
        - ``headers``: optional HTTP headers (values support ``${ENV_VAR}``)
        - ``env``: optional environment variables for stdio (values support
          ``${ENV_VAR}``)
        - ``oauth``: optional OAuth 2.0 configuration (mutually exclusive
          with ``headers``)

        Exactly one of ``command`` or ``url`` must be provided.
        Raises on connection failure (fail-fast at startup), except for
        OAuth servers with missing tokens which are skipped gracefully.

        Args:
            configs: List of MCP server configurations.
            hive_dir: Path to the hive directory. Required when any
                server uses OAuth (for token storage).
        """
        # Validate all configs before connecting.
        for config in configs:
            name = config.get("name", "")
            if not name:
                raise ValueError("MCP server config missing 'name'.")

            if name in _BUILTIN_GROUP_NAMES:
                raise ValueError(
                    f"MCP server name '{name}' collides with built-in "
                    f"function group. Choose a different name."
                )

            has_command = bool(config.get("command"))
            has_url = bool(config.get("url"))
            has_oauth = bool(config.get("oauth"))
            has_headers = bool(config.get("headers"))

            if not has_command and not has_url:
                raise ValueError(
                    f"MCP server '{name}' requires either 'command' "
                    f"(stdio) or 'url' (HTTP)."
                )

            if has_oauth and has_headers:
                raise ValueError(
                    f"MCP server '{name}' has both 'oauth' and 'headers'. "
                    f"These are mutually exclusive."
                )

            if has_oauth and not has_url:
                raise ValueError(
                    f"MCP server '{name}' has 'oauth' but no 'url'. "
                    f"OAuth requires HTTP transport."
                )

            if has_oauth and not hive_dir:
                raise ValueError(
                    f"MCP server '{name}' uses OAuth but no hive_dir "
                    f"was provided for token storage."
                )

        for config in configs:
            name = config["name"]
            has_oauth = bool(config.get("oauth"))
            has_url = bool(config.get("url"))

            if has_oauth:
                assert hive_dir is not None
                await self._connect_http_oauth(config, hive_dir)
            elif has_url:
                await self._connect_http(config)
            else:
                await self._connect_stdio(config)

    async def _connect_stdio(self, config: dict[str, Any]) -> None:
        """Connect to an MCP server via stdio transport."""
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        name = config["name"]
        command = config["command"]

        # Parse command into executable + args.
        parts = command.split()
        env = _expand_env_values(config.get("env"))

        server_params = StdioServerParameters(
            command=parts[0],
            args=parts[1:] if len(parts) > 1 else [],
            env=env,
        )

        logger.info("Connecting to MCP server '%s' (stdio): %s", name, command)

        transport = await self._exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        read_stream, write_stream = transport

        session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        await session.initialize()
        await self._register_connection(config, session)

    async def _connect_http(self, config: dict[str, Any]) -> None:
        """Connect to an MCP server via Streamable HTTP transport."""
        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        name = config["name"]
        url = config["url"]
        headers = _expand_env_values(config.get("headers"))

        logger.info("Connecting to MCP server '%s' (HTTP): %s", name, url)

        # Headers are passed via a custom httpx client.
        http_client = httpx.AsyncClient(headers=headers) if headers else None

        transport = await self._exit_stack.enter_async_context(
            streamable_http_client(url=url, http_client=http_client)
        )
        read_stream, write_stream, _ = transport

        session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        await session.initialize()
        await self._register_connection(config, session)

    async def _connect_http_oauth(
        self, config: dict[str, Any], hive_dir: Path,
    ) -> None:
        """Connect to an MCP server using OAuth 2.0 authentication.

        Uses the MCP SDK's ``OAuthClientProvider`` as an ``httpx.Auth``
        handler.  Tokens are stored at ``hive/.mcp-tokens/<name>.json``.

        If tokens don't exist yet, the connection is skipped gracefully
        with a warning — the user must authenticate via hivetool first.
        """
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client
        from mcp.client.auth.oauth2 import OAuthClientProvider
        from mcp.shared.auth import OAuthClientMetadata

        import httpx

        name = config["name"]
        url = config["url"]
        oauth_config = _parse_oauth_config(config.get("oauth"))

        if not oauth_config:
            logger.warning(
                "MCP server '%s' has empty oauth config — skipping", name,
            )
            return

        # Expand env var references in credentials.
        expanded = _expand_env_values({
            "client_id": oauth_config.client_id,
            "client_secret": oauth_config.client_secret,
        })
        assert expanded is not None
        client_id = expanded["client_id"]
        client_secret = expanded["client_secret"]

        if not client_id:
            logger.warning(
                "MCP server '%s': OAuth client_id is empty after "
                "env expansion — skipping",
                name,
            )
            return

        storage = HiveTokenStorage(hive_dir, name)

        # Pre-seed client_info so the SDK doesn't attempt dynamic
        # client registration (Google Workspace doesn't support it).
        existing_client_info = await storage.get_client_info()
        if not existing_client_info:
            from mcp.shared.auth import OAuthClientInformationFull

            client_info = OAuthClientInformationFull(
                client_id=client_id,
                client_secret=client_secret,
                redirect_uris=None,
            )
            await storage.set_client_info(client_info)

        # Check if tokens exist.  Without tokens AND without a
        # redirect/callback handler, the SDK will raise OAuthFlowError
        # on 401.  Better to skip gracefully now.
        existing_tokens = await storage.get_tokens()
        if not existing_tokens:
            logger.warning(
                "MCP server '%s' requires OAuth but no tokens found at %s. "
                "Authenticate via hivetool to connect.",
                name, storage._path,
            )
            return

        scope_str = " ".join(oauth_config.scopes)

        client_metadata = OAuthClientMetadata(
            client_name=f"bees-{name}",
            redirect_uris=None,
            scope=scope_str if scope_str else None,
        )

        provider = OAuthClientProvider(
            server_url=url,
            client_metadata=client_metadata,
            storage=storage,
        )

        logger.info(
            "Connecting to MCP server '%s' (OAuth HTTP): %s", name, url,
        )

        http_client = httpx.AsyncClient(auth=provider)

        try:
            transport = await self._exit_stack.enter_async_context(
                streamable_http_client(url=url, http_client=http_client)
            )
            read_stream, write_stream, _ = transport

            session = await self._exit_stack.enter_async_context(
                ClientSession(read_stream, write_stream)
            )
            await session.initialize()
            await self._register_connection(config, session)
        except Exception as exc:
            logger.warning(
                "MCP server '%s' OAuth connection failed: %s. "
                "Re-authenticate via hivetool.",
                name, exc,
            )
            # Graceful skip — don't bring down the whole scheduler.
            return

    async def _register_connection(
        self, config: dict[str, Any], session: Any,
    ) -> None:
        """Discover tools and register the connection."""
        name = config["name"]

        tools_result = await session.list_tools()
        tools = [
            {
                "name": t.name,
                "description": getattr(t, "description", ""),
                "inputSchema": (
                    t.inputSchema if hasattr(t, "inputSchema")
                    else {}
                ),
            }
            for t in tools_result.tools
        ]

        conn = MCPConnection(
            name=name,
            description=config.get("description", ""),
            tools=tools,
            session=session,
        )
        self._connections.append(conn)
        self._factories.append(_mcp_function_group_factory(conn))

        tool_names = [t["name"] for t in tools]
        logger.info(
            "MCP server '%s' connected: %d tools (%s)",
            name, len(tools), ", ".join(tool_names[:10]),
        )

    def get_factories(self) -> list[FunctionGroupFactory]:
        """Return function group factories for all connected MCP servers."""
        return list(self._factories)

    async def disconnect_all(self) -> None:
        """Disconnect from all MCP servers and clean up.

        Shielded from cancellation so that a second SIGINT doesn't
        strand the process in a half-closed state.
        """
        import asyncio

        logger.info("Disconnecting from %d MCP server(s)", len(self._connections))
        try:
            await asyncio.wait_for(
                asyncio.shield(self._exit_stack.aclose()),
                timeout=5.0,
            )
        except (TimeoutError, asyncio.TimeoutError):
            logger.warning(
                "MCP disconnect timed out after 5s — forcing shutdown"
            )
        except (asyncio.CancelledError, Exception) as exc:
            logger.warning("MCP disconnect interrupted: %s", exc)
        self._connections.clear()
        self._factories.clear()
