# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""MCP bridge — turns external MCP servers into bees function groups.

Each MCP server registered in ``SYSTEM.yaml`` becomes a function group
that agents can use via the existing ``functions`` filter.  For example,
a server named ``weather`` with tool ``get_forecast`` becomes the
function group ``weather`` containing ``weather_get_forecast``.

Lifecycle:
- ``MCPRegistry.discover_all()`` at scheduler startup (brief connect
  for tool discovery, then disconnect — no long-lived transports)
- ``MCPRegistry.get_factories()`` for each session
- ``MCPConnection.call_tool()`` lazily connects on first use
- ``MCPRegistry.disconnect_all()`` at scheduler shutdown

Each connection owns its transport lifecycle in an isolated
``asyncio.Task``, so transport crashes are contained and cannot
reach the box's main loop.  Failed calls are retried with
exponential backoff before reporting errors to the agent.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from contextlib import AsyncExitStack
from dataclasses import dataclass
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
# Refreshable OAuth auth for httpx
# ---------------------------------------------------------------------------

GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


import httpx


class _RefreshableOAuthAuth(httpx.Auth):
    """``httpx.Auth`` handler with transparent refresh-token support.

    On each request:

    1. Attach the stored ``access_token`` as a Bearer header.
    2. If the server responds with 401, exchange the ``refresh_token``
       for a new ``access_token`` via Google's token endpoint and retry.
    3. Persist the updated tokens so the next startup has a fresh token.

    This replaces the MCP SDK's ``OAuthClientProvider`` which requires
    an interactive browser flow for re-auth — unsuitable for the
    headless box.
    """

    def __init__(
        self,
        storage: HiveTokenStorage,
        client_id: str,
        client_secret: str,
    ) -> None:
        self._storage = storage
        self._client_id = client_id
        self._client_secret = client_secret
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._loaded = False

    async def _load_tokens(self) -> None:
        """Load tokens from storage on first use."""
        if self._loaded:
            return
        tokens = await self._storage.get_tokens()
        if tokens:
            self._access_token = getattr(tokens, "access_token", None)
            self._refresh_token = getattr(tokens, "refresh_token", None)
        self._loaded = True

    async def _refresh(self) -> bool:
        """Exchange the refresh token for a new access token.

        Returns True if the refresh succeeded.
        """
        import httpx

        if not self._refresh_token:
            logger.warning("No refresh token available — cannot refresh")
            return False

        logger.info("Refreshing OAuth access token")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    GOOGLE_TOKEN_ENDPOINT,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": self._refresh_token,
                        "client_id": self._client_id,
                        "client_secret": self._client_secret,
                    },
                )
            if response.status_code != 200:
                logger.warning(
                    "Token refresh failed (%d): %s",
                    response.status_code, response.text,
                )
                return False

            token_data = response.json()
            self._access_token = token_data.get("access_token")

            # Persist updated tokens (preserve refresh_token if not
            # returned — Google only sends it on initial consent).
            from mcp.shared.auth import OAuthToken

            updated = OAuthToken(
                access_token=self._access_token or "",
                token_type=token_data.get("token_type", "Bearer"),
                expires_in=token_data.get("expires_in"),
                refresh_token=(
                    token_data.get("refresh_token") or self._refresh_token
                ),
                scope=token_data.get("scope"),
            )
            await self._storage.set_tokens(updated)
            logger.info("OAuth access token refreshed successfully")
            return True

        except Exception as exc:
            logger.warning("Token refresh error: %s", exc)
            return False

    # -- httpx.Auth protocol -------------------------------------------

    requires_response_body = False

    async def async_auth_flow(
        self, request: Any,
    ) -> Any:  # AsyncGenerator[Request, Response]
        """httpx auth flow: attach token, refresh on 401."""
        import httpx

        await self._load_tokens()

        if self._access_token:
            request.headers["Authorization"] = (
                f"Bearer {self._access_token}"
            )
        response = yield request

        if response.status_code == 401 and await self._refresh():
            request.headers["Authorization"] = (
                f"Bearer {self._access_token}"
            )
            yield request


# ---------------------------------------------------------------------------
# MCP connection — lifecycle owner with lazy connect and auto-reconnect
# ---------------------------------------------------------------------------


class MCPConnection:
    """A resilient connection to a single MCP server.

    Owns its transport lifecycle independently.  Connects lazily on
    first tool call, retries with exponential backoff on failure, and
    auto-reconnects when the transport dies.

    The transport context runs in an isolated ``asyncio.Task`` so its
    anyio cancel scope can never reach the box's main loop or other
    connections.
    """

    def __init__(
        self,
        name: str,
        description: str,
        config: dict[str, Any],
        hive_dir: Path | None = None,
    ) -> None:
        self.name = name
        self.description = description
        self.config = config
        self.hive_dir = hive_dir
        self.tools: list[dict[str, Any]] = []

        self._session: Any = None
        self._lifecycle_task: asyncio.Task | None = None
        self._ready = asyncio.Event()
        self._dead = asyncio.Event()
        self._shutdown = asyncio.Event()
        self._lock = asyncio.Lock()

    @property
    def connected(self) -> bool:
        return self._session is not None and self._ready.is_set()

    # -- tool discovery (brief connect at startup) -------------------------

    async def discover_tools(self) -> None:
        """Connect briefly to discover tools, then disconnect.

        Called once at startup.  Failures are logged and the server
        is skipped (no tools registered).
        """
        stack = AsyncExitStack()
        try:
            session = await self._enter_transport(stack)
            if session is None:
                return
            tools_result = await session.list_tools()
            seen: set[str] = set()
            for t in tools_result.tools:
                if t.name in seen:
                    continue
                seen.add(t.name)
                self.tools.append({
                    "name": t.name,
                    "description": getattr(t, "description", ""),
                    "inputSchema": (
                        t.inputSchema if hasattr(t, "inputSchema")
                        else {}
                    ),
                })
            if len(seen) < len(tools_result.tools):
                logger.warning(
                    "MCP server '%s' returned duplicate tools — "
                    "deduplicated %d → %d",
                    self.name, len(tools_result.tools), len(seen),
                )
            tool_names = [t["name"] for t in self.tools]
            logger.info(
                "MCP server '%s' discovered: %d tools (%s)",
                self.name, len(self.tools),
                ", ".join(tool_names[:10]),
            )
        except Exception as exc:
            logger.warning(
                "MCP server '%s' tool discovery failed: %s — skipping",
                self.name, exc,
            )
        finally:
            try:
                await asyncio.wait_for(stack.aclose(), timeout=5.0)
            except (TimeoutError, asyncio.TimeoutError, BaseException):
                pass

    # -- lazy connection ---------------------------------------------------

    async def connect(self) -> None:
        """Establish a long-lived connection in an isolated task."""
        async with self._lock:
            if self.connected:
                return
            self._shutdown.clear()
            self._ready.clear()
            self._dead.clear()
            self._lifecycle_task = asyncio.create_task(
                self._lifecycle(), name=f"mcp-{self.name}",
            )
            try:
                await asyncio.wait_for(self._ready.wait(), timeout=30.0)
            except (TimeoutError, asyncio.TimeoutError):
                logger.warning(
                    "MCP server '%s' connection timed out", self.name,
                )
                await self.disconnect()

    async def disconnect(self) -> None:
        """Shut down the connection."""
        self._shutdown.set()
        if self._lifecycle_task and not self._lifecycle_task.done():
            self._lifecycle_task.cancel()
            try:
                await self._lifecycle_task
            except (asyncio.CancelledError, BaseException):
                pass
        self._lifecycle_task = None
        self._session = None
        self._ready.clear()

    async def _lifecycle(self) -> None:
        """Run the transport context in an isolated task.

        The anyio cancel scope from ``streamable_http_client`` is
        contained to this task.  If the transport crashes, only this
        task is affected.
        """
        stack = AsyncExitStack()
        try:
            session = await self._enter_transport(stack)
            if session is None:
                return
            self._session = session
            self._ready.set()
            logger.info("MCP server '%s' connected", self.name)
            # Block until shutdown is requested.
            await self._shutdown.wait()
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning(
                "MCP server '%s' transport crashed: %s", self.name, exc,
            )
        finally:
            self._session = None
            self._ready.clear()
            self._dead.set()
            try:
                await asyncio.wait_for(stack.aclose(), timeout=5.0)
            except (TimeoutError, asyncio.TimeoutError, BaseException):
                pass

    async def _enter_transport(self, stack: AsyncExitStack) -> Any:
        """Enter the appropriate transport context and return a session.

        Handles stdio, HTTP, and OAuth HTTP based on config.
        """
        from mcp import ClientSession

        has_oauth = bool(self.config.get("oauth"))
        has_url = bool(self.config.get("url"))

        if has_oauth:
            return await self._enter_oauth_transport(stack)
        elif has_url:
            return await self._enter_http_transport(stack)
        else:
            return await self._enter_stdio_transport(stack)

    async def _enter_stdio_transport(self, stack: AsyncExitStack) -> Any:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        command = self.config["command"]
        parts = command.split()
        env = _expand_env_values(self.config.get("env"))
        server_params = StdioServerParameters(
            command=parts[0],
            args=parts[1:] if len(parts) > 1 else [],
            env=env,
        )
        transport = await stack.enter_async_context(
            stdio_client(server_params),
        )
        read_stream, write_stream = transport
        session = await stack.enter_async_context(
            ClientSession(read_stream, write_stream),
        )
        await session.initialize()
        return session

    async def _enter_http_transport(self, stack: AsyncExitStack) -> Any:
        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        url = self.config["url"]
        headers = _expand_env_values(self.config.get("headers"))
        http_client = (
            httpx.AsyncClient(headers=headers) if headers else None
        )
        transport = await stack.enter_async_context(
            streamable_http_client(url=url, http_client=http_client),
        )
        read_stream, write_stream, _ = transport
        session = await stack.enter_async_context(
            ClientSession(read_stream, write_stream),
        )
        await session.initialize()
        return session

    async def _enter_oauth_transport(self, stack: AsyncExitStack) -> Any:
        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        url = self.config["url"]
        oauth_config = _parse_oauth_config(self.config.get("oauth"))
        if not oauth_config:
            logger.warning(
                "MCP server '%s' has empty oauth config", self.name,
            )
            return None

        expanded = _expand_env_values({
            "client_id": oauth_config.client_id,
            "client_secret": oauth_config.client_secret,
        })
        assert expanded is not None
        client_id = expanded["client_id"]
        client_secret = expanded["client_secret"]

        if not client_id:
            logger.warning(
                "MCP server '%s': OAuth client_id is empty", self.name,
            )
            return None

        assert self.hive_dir is not None
        storage = HiveTokenStorage(self.hive_dir, self.name)
        existing_tokens = await storage.get_tokens()
        if not existing_tokens:
            logger.warning(
                "MCP server '%s' requires OAuth but no tokens found. "
                "Authenticate via hivetool.",
                self.name,
            )
            return None

        auth = _RefreshableOAuthAuth(
            storage=storage,
            client_id=client_id,
            client_secret=client_secret,
        )
        http_client = httpx.AsyncClient(auth=auth)
        transport = await stack.enter_async_context(
            streamable_http_client(url=url, http_client=http_client),
        )
        read_stream, write_stream, _ = transport
        session = await stack.enter_async_context(
            ClientSession(read_stream, write_stream),
        )
        await session.initialize()
        return session

    # -- resilient tool calls ----------------------------------------------

    async def call_tool(
        self,
        tool_name: str,
        args: dict[str, Any],
        *,
        retries: int = 2,
        backoff: float = 1.0,
    ) -> Any:
        """Call a tool with automatic retry and reconnect.

        On transient failure: disconnect, wait with exponential backoff,
        reconnect, retry.  On permanent failure (HTTP 4xx): fail
        immediately.  After exhausting retries, raise.

        The call is raced against a "transport died" event so that
        transport crashes (e.g. HTTP 403 killing the anyio TaskGroup)
        are detected instantly instead of hanging forever.
        """
        for attempt in range(retries + 1):
            if not self.connected:
                await self.connect()
            if not self.connected:
                raise ConnectionError(
                    f"MCP server '{self.name}' could not connect"
                )
            try:
                return await self._race_call_vs_death(
                    self._session.call_tool(tool_name, arguments=args),
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(
                    "MCP call %s on '%s' failed (attempt %d/%d): %s",
                    tool_name, self.name, attempt + 1, retries + 1, exc,
                )
                # Don't retry permanent failures (4xx HTTP errors).
                if _is_permanent_failure(exc):
                    raise
                try:
                    await self.disconnect()
                except BaseException:
                    pass
                if attempt < retries:
                    wait = backoff * (2 ** attempt)
                    logger.info(
                        "Retrying %s on '%s' in %.1fs",
                        tool_name, self.name, wait,
                    )
                    await asyncio.sleep(wait)
                else:
                    raise

    async def _race_call_vs_death(self, coro: Any) -> Any:
        """Race a coroutine against transport death.

        If the transport dies (lifecycle task exits), the ``_dead``
        event fires and we raise ``ConnectionError`` immediately
        instead of hanging on a response that will never arrive.
        """
        call_task = asyncio.ensure_future(coro)
        death_task = asyncio.ensure_future(self._dead.wait())

        done, pending = await asyncio.wait(
            [call_task, death_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass

        if call_task in done:
            return call_task.result()

        raise ConnectionError(
            f"MCP transport for '{self.name}' crashed during call"
        )


def _is_permanent_failure(exc: BaseException) -> bool:
    """Check if an exception indicates a permanent, non-retryable failure.

    HTTP 4xx errors (except 401, 408, 429) are permanent — the request
    is wrong and retrying won't help.
    """
    # httpx.HTTPStatusError carries the status code.
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status is not None and 400 <= status < 500:
        # 401 (auth), 408 (timeout), 429 (rate limit) are retryable.
        return status not in (401, 408, 429)
    # ExceptionGroup may wrap the real error.
    if isinstance(exc, BaseExceptionGroup):
        return any(_is_permanent_failure(e) for e in exc.exceptions)
    return False



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


def _make_proxy_handler(conn: MCPConnection, tool_name: str):
    """Create an async handler that proxies a tool call via the connection.

    Uses ``conn.call_tool()`` which handles retry, reconnect, and
    backoff transparently.
    """
    server_name = conn.name

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        prefixed = f"{server_name}_{tool_name}"
        if status_cb:
            status_cb(f"Calling {prefixed}")

        try:
            result = await conn.call_tool(tool_name, args)
        except Exception as exc:
            logger.error(
                "MCP tool call failed: %s on %s: %s",
                tool_name, server_name, exc,
            )
            if status_cb:
                status_cb(None, None)
            return {
                "error": (
                    f"MCP server '{server_name}' unavailable "
                    f"after retries: {exc}"
                ),
            }

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
    """Build a FunctionGroup from an MCP connection's cached tools."""
    definitions: list[FunctionDefinition] = []
    declarations: list[dict[str, Any]] = []

    for tool in conn.tools:
        decl = _mcp_tool_to_declaration(conn.name, tool)
        declarations.append(decl)

        func_def = FunctionDefinition(
            name=decl["name"],
            description=decl.get("description", ""),
            handler=_make_proxy_handler(conn, tool["name"]),
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
# Registry — thin coordinator
# ---------------------------------------------------------------------------


class MCPRegistry:
    """Manages the lifecycle of all registered MCP server connections.

    Each connection owns its own transport lifecycle independently.
    The registry validates configs, creates connections, and coordinates
    discovery and shutdown.

    Usage::

        registry = MCPRegistry()
        await registry.discover_all(configs)   # at startup (brief connect)
        factories = registry.get_factories()   # per session
        await registry.disconnect_all()        # at shutdown
    """

    def __init__(self) -> None:
        self._connections: list[MCPConnection] = []
        self._factories: list[FunctionGroupFactory] = []

    async def discover_all(
        self,
        configs: list[dict[str, Any]],
        *,
        hive_dir: Path | None = None,
    ) -> None:
        """Discover tools from all MCP servers.

        Connects briefly to each server, calls ``list_tools()``,
        caches the declarations, then disconnects.  No long-lived
        transports are left open.

        Args:
            configs: List of MCP server configurations.
            hive_dir: Path to the hive directory. Required when any
                server uses OAuth (for token storage).
        """
        self._validate_configs(configs, hive_dir=hive_dir)

        for config in configs:
            name = config["name"]
            conn = MCPConnection(
                name=name,
                description=config.get("description", ""),
                config=config,
                hive_dir=hive_dir,
            )
            await conn.discover_tools()
            if conn.tools:
                self._connections.append(conn)
                self._factories.append(_mcp_function_group_factory(conn))

    # Keep connect_all as alias for backward compatibility.
    async def connect_all(
        self,
        configs: list[dict[str, Any]],
        *,
        hive_dir: Path | None = None,
    ) -> None:
        """Alias for ``discover_all()`` (backward compatibility)."""
        await self.discover_all(configs, hive_dir=hive_dir)

    def _validate_configs(
        self,
        configs: list[dict[str, Any]],
        *,
        hive_dir: Path | None = None,
    ) -> None:
        """Validate all configs before creating connections."""
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

    def get_factories(self) -> list[FunctionGroupFactory]:
        """Return function group factories for all discovered MCP servers."""
        return list(self._factories)

    async def disconnect_all(self) -> None:
        """Disconnect all MCP server connections.

        Delegates to each connection's ``disconnect()`` method.
        Each connection manages its own transport cleanup.
        """
        logger.info(
            "Disconnecting from %d MCP server(s)", len(self._connections),
        )
        for conn in self._connections:
            try:
                await conn.disconnect()
            except BaseException as exc:
                logger.warning(
                    "MCP server '%s' disconnect error: %s", conn.name, exc,
                )
        self._connections.clear()
        self._factories.clear()

