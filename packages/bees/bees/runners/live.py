# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Live runner — delegated session via the Gemini Live API.

Implements :class:`SessionRunner` by provisioning a session bundle
(system instruction, tool declarations, ephemeral auth token) and
writing it to the task directory.  The actual WebSocket connection to
the Gemini Live API is established and owned by the browser (hivetool).

The :class:`LiveStream` blocks until the browser signals completion
by writing ``live_result.json`` to the task directory.
"""

from __future__ import annotations

__all__ = ["LiveRunner"]

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    FunctionHandler,
    SessionHooks,
)
from bees.protocols.session import (
    SessionConfiguration,
    SessionStream,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BUNDLE_FILENAME = "live_session.json"
RESULT_FILENAME = "live_result.json"
TOOL_DISPATCH_DIR = "tool_dispatch"

LIVE_API_ENDPOINT = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1alpha."
    "GenerativeService.BidiGenerateContentConstrained"
)

DEFAULT_MODEL = "models/gemini-3.1-flash-live-preview"


# ---------------------------------------------------------------------------
# Live SessionHooks — provides a working controller for live sessions
# ---------------------------------------------------------------------------


class _LiveTerminator:
    """Translates ``controller.terminate()`` into writing ``live_result.json``.

    In the batch runner, ``terminate()`` signals the opal loop.  In the
    live runner, it means "the agent is done" — so we write the result
    file that ``LiveStream`` is polling for.  This lets system handlers
    (``system_objective_fulfilled``, ``system_failed_to_fulfill_objective``)
    work unchanged across both runner types.
    """

    def __init__(self, ticket_dir: Path) -> None:
        self._ticket_dir = ticket_dir

    def terminate(self, result: Any) -> None:
        """Write the result as ``live_result.json``."""
        result_path = self._ticket_dir / RESULT_FILENAME

        # Convert AgentResult to dict if needed.
        if hasattr(result, "to_dict"):
            result_data = result.to_dict()
        elif isinstance(result, dict):
            result_data = result
        else:
            result_data = {"success": False, "error": str(result)}

        # Map to the live_result.json shape that LiveStream expects.
        live_result: dict[str, Any] = {
            "status": "completed" if result_data.get("success") else "failed",
        }
        if "outcomes" in result_data:
            live_result["outcomes"] = result_data["outcomes"]

        result_path.write_text(
            json.dumps(live_result, indent=2, ensure_ascii=False) + "\n",
        )
        logger.info("Live session terminated via handler: %s", live_result.get("status"))


class _LiveHooks:
    """SessionHooks for live sessions — provides a functioning controller.

    Unlike batch sessions where the opal loop provides the controller,
    live sessions need a controller that writes ``live_result.json``.
    The file system is forwarded from the provisioned config.
    """

    def __init__(
        self, ticket_dir: Path, file_system: Any = None,
    ) -> None:
        self._controller = _LiveTerminator(ticket_dir)
        self._file_system = file_system

    @property
    def controller(self) -> Any:
        return self._controller

    @property
    def file_system(self) -> Any:
        return self._file_system

    @property
    def task_tree_manager(self) -> Any:
        return None


# ---------------------------------------------------------------------------
# Declaration extraction
# ---------------------------------------------------------------------------


def _extract_declarations(
    factories: list[FunctionGroupFactory],
    function_filter: list[str] | None,
    file_system: Any = None,
    ticket_dir: Path | None = None,
) -> tuple[list[dict[str, Any]], str, dict[str, FunctionHandler]]:
    """Call factories and collect tool declarations, instructions, and handlers.

    Returns a ``(declarations, combined_instruction, handler_map)`` tuple.
    When *function_filter* is non-empty, only declarations whose name
    matches a filter entry are included.  The handler map contains
    the same filtered set keyed by function name.

    When *ticket_dir* is provided, factories receive ``_LiveHooks`` with
    a functioning controller that writes ``live_result.json`` on terminate.
    """
    if ticket_dir:
        hooks = _LiveHooks(ticket_dir, file_system)
    else:
        # Fallback for tests that don't provide ticket_dir.
        hooks = _LiveHooks(Path("/dev/null"), file_system)
    all_declarations: list[dict[str, Any]] = []
    instructions: list[str] = []
    handler_map: dict[str, FunctionHandler] = {}

    for item in factories:
        # The provisioner list is a mix of factories (callables that
        # return FunctionGroup) and already-constructed FunctionGroup
        # instances (e.g. skills).  Distinguish by checking callable.
        if callable(item) and not isinstance(item, FunctionGroup):
            group: FunctionGroup = item(hooks)
        else:
            group = item

        if group.instruction:
            instructions.append(group.instruction)

        # Build a name → handler lookup from definitions.
        definitions_by_name: dict[str, FunctionHandler] = {
            name: defn.handler for name, defn in group.definitions
        }

        for decl in group.declarations:
            name = decl.get("name", "")
            if function_filter and not _matches_filter(name, function_filter):
                continue
            all_declarations.append(decl)
            handler = definitions_by_name.get(name)
            if handler:
                handler_map[name] = handler

    return all_declarations, "\n\n".join(instructions), handler_map


def _matches_filter(name: str, patterns: list[str]) -> bool:
    """Check whether a function name matches one of the filter patterns.

    Patterns can be exact names (``tasks_create_task``) or glob-style
    group prefixes (``tasks.*``).
    """
    for pattern in patterns:
        if pattern.endswith(".*"):
            prefix = pattern[:-2]
            # Convention: function names are ``group_functionname``.
            if name.startswith(prefix + "_") or name == prefix:
                return True
        elif name == pattern:
            return True
    return False


# ---------------------------------------------------------------------------
# System instruction assembly
# ---------------------------------------------------------------------------


def _assemble_system_instruction(
    segments: list[dict[str, Any]],
    tool_instruction: str,
) -> str:
    """Combine provisioned segments and tool instructions into one string."""
    parts: list[str] = []

    for segment in segments:
        segment_parts = segment.get("parts", [])
        for part in segment_parts:
            text = part.get("text")
            if text:
                parts.append(text)

    if tool_instruction:
        parts.append(tool_instruction)

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Stale artifact cleanup
# ---------------------------------------------------------------------------


def _clean_stale_artifacts(ticket_dir: Path) -> None:
    """Remove leftover live session files from a previous run.

    When the box restarts, old ``live_result.json`` and ``tool_dispatch/``
    files would be picked up as pre-answered results.  This cleans the
    slate so the new session starts fresh.
    """
    import shutil

    result_path = ticket_dir / RESULT_FILENAME
    if result_path.exists():
        result_path.unlink()
        logger.debug("Cleaned stale %s", RESULT_FILENAME)

    dispatch_dir = ticket_dir / TOOL_DISPATCH_DIR
    if dispatch_dir.exists():
        shutil.rmtree(dispatch_dir)
        logger.debug("Cleaned stale %s/", TOOL_DISPATCH_DIR)


# ---------------------------------------------------------------------------
# Session bundle
# ---------------------------------------------------------------------------


@dataclass
class SessionBundle:
    """Everything the browser needs to establish a Live API session."""

    token: str
    endpoint: str
    setup: dict[str, Any]
    task_id: str


def _build_bundle(
    *,
    config: SessionConfiguration,
    token: str,
    declarations: list[dict[str, Any]],
    system_instruction: str,
) -> SessionBundle:
    """Assemble the session bundle from provisioned configuration."""
    model = config.model or DEFAULT_MODEL

    setup: dict[str, Any] = {
        "model": model,
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": "Kore",
                    },
                },
            },
        },
        "systemInstruction": {
            "parts": [{"text": system_instruction}],
        },
    }

    if declarations:
        setup["tools"] = [{"functionDeclarations": declarations}]

    return SessionBundle(
        token=token,
        endpoint=LIVE_API_ENDPOINT,
        setup=setup,
        task_id=config.ticket_id or "",
    )


def _write_bundle(bundle: SessionBundle, ticket_dir: Path) -> Path:
    """Write the session bundle to the task directory."""
    bundle_path = ticket_dir / BUNDLE_FILENAME
    bundle_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "token": bundle.token,
        "endpoint": bundle.endpoint,
        "setup": bundle.setup,
        "task_id": bundle.task_id,
    }

    bundle_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
    )
    return bundle_path


# ---------------------------------------------------------------------------
# ToolDispatchWatcher — filesystem-mediated tool execution
# ---------------------------------------------------------------------------


class ToolDispatchWatcher:
    """Watch ``tool_dispatch/`` and execute Python handlers.

    The browser writes ``tool_dispatch/{call_id}.json`` for each tool call
    from the Live API.  This watcher detects new call files, looks up the
    handler, executes it, and writes ``{call_id}.result.json`` for the
    browser to relay back over the WebSocket.

    Uses sleep-based polling (consistent with ``LiveStream``).  Runs as
    a background ``asyncio.Task`` cancelled when the session ends.
    """

    def __init__(
        self,
        dispatch_dir: Path,
        handler_map: dict[str, FunctionHandler],
        poll_interval: float = 0.3,
    ) -> None:
        self._dispatch_dir = dispatch_dir
        self._handler_map = handler_map
        self._poll_interval = poll_interval
        self._processed: set[str] = set()

    async def run(self) -> None:
        """Poll for call files and dispatch handlers until cancelled."""
        self._dispatch_dir.mkdir(parents=True, exist_ok=True)
        logger.info(
            "ToolDispatchWatcher started — watching %s", self._dispatch_dir,
        )

        try:
            while True:
                await self._scan_once()
                await asyncio.sleep(self._poll_interval)
        except asyncio.CancelledError:
            logger.info("ToolDispatchWatcher stopped")
            raise

    async def _scan_once(self) -> None:
        """Scan for unprocessed call files and dispatch them."""
        if not self._dispatch_dir.exists():
            return

        for path in sorted(self._dispatch_dir.iterdir()):
            # Skip result files and already-processed calls.
            if path.name.endswith(".result.json"):
                continue
            if not path.name.endswith(".json"):
                continue

            call_id = path.stem
            if call_id in self._processed:
                continue

            # Skip if result already exists.
            result_path = self._dispatch_dir / f"{call_id}.result.json"
            if result_path.exists():
                self._processed.add(call_id)
                continue

            await self._dispatch(call_id, path, result_path)

    async def _dispatch(
        self, call_id: str, call_path: Path, result_path: Path,
    ) -> None:
        """Read a call file, execute the handler, write the result."""
        self._processed.add(call_id)

        try:
            call_data = json.loads(call_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to read call file %s: %s", call_path, exc)
            self._write_error_result(result_path, call_id, str(exc))
            return

        # Wire format: {"functionCall": {"id": ..., "name": ..., "args": ...}}
        fc = call_data.get("functionCall", {})
        name = fc.get("name", "")
        args = fc.get("args", {})

        handler = self._handler_map.get(name)
        if not handler:
            logger.warning("No handler for tool call %r (call %s)", name, call_id)
            self._write_error_result(
                result_path, call_id,
                f"Unknown function: {name}", name=name,
            )
            return

        logger.info("Dispatching tool call %s: %s", call_id, name)

        try:
            # Status callback — no-op for live dispatch.
            def _noop_status(_msg: str | None, _opts: Any = None) -> None:
                pass

            response = await handler(args, _noop_status)
        except Exception as exc:
            logger.error("Handler %s raised: %s", name, exc, exc_info=True)
            self._write_error_result(
                result_path, call_id, str(exc), name=name,
            )
            return

        # Write result in wire format.
        result_data = {
            "functionResponse": {
                "id": call_id,
                "name": name,
                "response": response,
            },
        }
        result_path.write_text(
            json.dumps(result_data, indent=2, ensure_ascii=False) + "\n",
        )
        logger.info("Tool call %s (%s) completed", call_id, name)

    def _write_error_result(
        self,
        result_path: Path,
        call_id: str,
        error: str,
        *,
        name: str = "",
    ) -> None:
        """Write an error result so the browser doesn't hang."""
        result_data = {
            "functionResponse": {
                "id": call_id,
                "name": name,
                "response": {"error": error},
            },
        }
        result_path.write_text(
            json.dumps(result_data, indent=2, ensure_ascii=False) + "\n",
        )


# ---------------------------------------------------------------------------
# LiveStream — the sparse SessionStream
# ---------------------------------------------------------------------------


class LiveStream:
    """A session stream that blocks until the browser reports completion.

    Implements ``SessionStream`` by polling for ``live_result.json``
    in the task directory.  Yields at most a completion event.

    Optionally manages a ``ToolDispatchWatcher`` background task,
    cancelling it when the stream exhausts.
    """

    def __init__(
        self,
        ticket_dir: Path,
        poll_interval: float = 0.5,
        watcher_task: asyncio.Task[None] | None = None,
    ) -> None:
        self._ticket_dir = ticket_dir
        self._poll_interval = poll_interval
        self._done = False
        self._result: dict[str, Any] | None = None
        self._watcher_task = watcher_task

    def __aiter__(self) -> "LiveStream":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._done:
            raise StopAsyncIteration

        # Poll for the result file.
        result_path = self._ticket_dir / RESULT_FILENAME
        while not result_path.exists():
            await asyncio.sleep(self._poll_interval)

        # Session ended — cancel the watcher.
        self._cancel_watcher()

        # Read and parse the result.
        try:
            self._result = json.loads(result_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            self._done = True
            return {"error": {"message": f"Failed to read live result: {exc}"}}

        self._done = True

        # Translate the browser's result into a completion event.
        status = self._result.get("status", "completed")
        if status == "failed":
            return {"error": {
                "message": self._result.get("error", "Live session failed"),
            }}

        return {"complete": {
            "result": {
                "success": status == "completed",
                "outcomes": self._result.get("outcomes", {}),
            },
        }}

    async def send_context(self, parts: list[dict[str, Any]]) -> None:
        """Write context update for the browser to pick up.

        The browser watches for these files and calls
        ``session.send_client_content()`` on the Live API WebSocket.
        """
        updates_dir = self._ticket_dir / "context_updates"
        updates_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        update_path = updates_dir / f"{timestamp}.json"
        update_path.write_text(
            json.dumps({"parts": parts}, indent=2, ensure_ascii=False) + "\n",
        )

    def resume_state(self) -> bytes | None:
        """Live sessions don't support batch-style resume."""
        return None

    def _cancel_watcher(self) -> None:
        """Cancel the tool dispatch watcher if running."""
        if self._watcher_task and not self._watcher_task.done():
            self._watcher_task.cancel()


# ---------------------------------------------------------------------------
# LiveRunner — the SessionRunner implementation
# ---------------------------------------------------------------------------


class LiveRunner:
    """Session runner for the Gemini Live API.

    Provisions all the session configuration (system instruction, tool
    declarations, ephemeral auth token) and writes a session bundle
    to the task directory.  The browser establishes the actual WebSocket
    connection and reports completion by writing a result file.

    Implements the ``SessionRunner`` protocol.
    """

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def _get_ephemeral_token(self) -> str:
        """Request a short-lived ephemeral token from the Gemini API.

        Uses ``google-genai`` SDK to create a single-use token
        that expires after 30 minutes.  The auth_tokens API is only
        available on the ``v1alpha`` endpoint.
        """
        from google import genai

        client = genai.Client(
            api_key=self._api_key,
            http_options={"api_version": "v1alpha"},
        )
        expire_time = (
            datetime.now(timezone.utc) + timedelta(minutes=30)
        ).isoformat()

        token_response = await asyncio.to_thread(
            client.auth_tokens.create,
            config={
                "uses": 1,
                "expire_time": expire_time,
                "http_options": {"api_version": "v1alpha"},
            },
        )

        return token_response.name

    async def run(
        self, config: SessionConfiguration,
    ) -> LiveStream:
        """Provision the session and write the bundle for the browser.

        1. Extract tool declarations from function group factories.
        2. Assemble the system instruction from segments.
        3. Request an ephemeral auth token.
        4. Write the session bundle to the task directory.
        5. Return a ``LiveStream`` that blocks until the browser reports
           completion.
        """
        ticket_dir = config.ticket_dir
        if not ticket_dir:
            raise ValueError(
                "LiveRunner requires ticket_dir in SessionConfiguration"
            )

        label = config.label or "live"

        # Clean up stale artifacts from a previous live session.
        # On box restart, old live_result.json / tool_dispatch/ files
        # would be picked up as pre-answered results.
        _clean_stale_artifacts(ticket_dir)

        # 1. Extract declarations, instructions, and handler map.
        declarations, tool_instruction, handler_map = _extract_declarations(
            config.function_groups,
            config.function_filter,
            file_system=config.file_system,
            ticket_dir=ticket_dir,
        )
        logger.info(
            "[%s] Extracted %d tool declarations (%d handlers) for live session",
            label, len(declarations), len(handler_map),
        )

        # 2. Assemble system instruction.
        system_instruction = _assemble_system_instruction(
            config.segments, tool_instruction,
        )

        # 3. Get ephemeral token.
        logger.info("[%s] Requesting ephemeral token...", label)
        token = await self._get_ephemeral_token()
        logger.info("[%s] Ephemeral token acquired", label)

        # 4. Build and write the session bundle.
        bundle = _build_bundle(
            config=config,
            token=token,
            declarations=declarations,
            system_instruction=system_instruction,
        )
        bundle_path = _write_bundle(bundle, ticket_dir)
        logger.info("[%s] Session bundle written to %s", label, bundle_path)

        # 5. Start tool dispatch watcher.
        dispatch_dir = ticket_dir / TOOL_DISPATCH_DIR
        watcher = ToolDispatchWatcher(dispatch_dir, handler_map)
        watcher_task = asyncio.create_task(watcher.run())

        # 6. Return a stream that waits for the browser to finish.
        return LiveStream(ticket_dir, watcher_task=watcher_task)

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any] | None = None,
    ) -> LiveStream:
        """Live sessions don't support batch-style resume.

        Raises ``NotImplementedError`` — a live session that ends
        must be re-provisioned from scratch.
        """
        raise NotImplementedError(
            "Live sessions cannot be resumed. "
            "Start a new session instead."
        )
