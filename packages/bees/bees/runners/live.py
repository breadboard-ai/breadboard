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

LIVE_API_ENDPOINT = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1alpha."
    "GenerativeService.BidiGenerateContent"
)

DEFAULT_MODEL = "models/gemini-2.5-flash-preview-native-audio-dialog"


# ---------------------------------------------------------------------------
# Dummy SessionHooks — bees factories don't use hooks (closure-captured deps)
# ---------------------------------------------------------------------------


class _NullHooks:
    """Minimal SessionHooks stub for extracting declarations from factories.

    Bees' function group factories receive ``SessionHooks`` by signature
    but capture their real dependencies through closures.  This stub
    satisfies the structural contract without providing real services.
    """

    @property
    def controller(self) -> Any:
        return None

    @property
    def file_system(self) -> Any:
        return None

    @property
    def task_tree_manager(self) -> Any:
        return None


_NULL_HOOKS = _NullHooks()


# ---------------------------------------------------------------------------
# Declaration extraction
# ---------------------------------------------------------------------------


def _extract_declarations(
    factories: list[FunctionGroupFactory],
    function_filter: list[str] | None,
) -> tuple[list[dict[str, Any]], str]:
    """Call factories and collect tool declarations and instructions.

    Returns a ``(declarations, combined_instruction)`` tuple.  When
    *function_filter* is non-empty, only declarations whose name
    matches a filter entry are included.
    """
    all_declarations: list[dict[str, Any]] = []
    instructions: list[str] = []

    for factory in factories:
        group: FunctionGroup = factory(_NULL_HOOKS)

        if group.instruction:
            instructions.append(group.instruction)

        for decl in group.declarations:
            name = decl.get("name", "")
            if function_filter and not _matches_filter(name, function_filter):
                continue
            all_declarations.append(decl)

    return all_declarations, "\n\n".join(instructions)


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
# LiveStream — the sparse SessionStream
# ---------------------------------------------------------------------------


class LiveStream:
    """A session stream that blocks until the browser reports completion.

    Implements ``SessionStream`` by polling for ``live_result.json``
    in the task directory.  Yields at most a completion event.
    """

    def __init__(self, ticket_dir: Path, poll_interval: float = 0.5) -> None:
        self._ticket_dir = ticket_dir
        self._poll_interval = poll_interval
        self._done = False
        self._result: dict[str, Any] | None = None

    def __aiter__(self) -> "LiveStream":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._done:
            raise StopAsyncIteration

        # Poll for the result file.
        result_path = self._ticket_dir / RESULT_FILENAME
        while not result_path.exists():
            await asyncio.sleep(self._poll_interval)

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
        that expires after 30 minutes.
        """
        from google import genai

        client = genai.Client(api_key=self._api_key)
        expire_time = (
            datetime.now(timezone.utc) + timedelta(minutes=30)
        ).isoformat()

        token_response = await asyncio.to_thread(
            client.auth_tokens.create,
            config={
                "uses": 1,
                "expire_time": expire_time,
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

        # 1. Extract declarations and instructions from function groups.
        declarations, tool_instruction = _extract_declarations(
            config.function_groups,
            config.function_filter,
        )
        logger.info(
            "[%s] Extracted %d tool declarations for live session",
            label, len(declarations),
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

        # 5. Return a stream that waits for the browser to finish.
        return LiveStream(ticket_dir)

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
