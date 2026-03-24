# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session runner — shared logic for running agent sessions.

Extracts the core session execution from ``cli.py`` so it can be
reused by both ``session:start`` and ``ticket:drain``.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import httpx

from opal_backend.local.backend_client_impl import HttpBackendClient
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.sessions.api import (
    Subscribers,
    new_session,
    register_task,
    start_session,
)
from opal_backend.sessions.in_memory_store import InMemorySessionStore

PACKAGE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = PACKAGE_DIR / "out"


# ---------------------------------------------------------------------------
# Session result
# ---------------------------------------------------------------------------


@dataclass
class SessionResult:
    """Result of a completed session."""

    session_id: str
    status: str
    events: int
    output: str
    turns: int = 0
    thoughts: int = 0
    outcome: str | None = None
    error: str | None = None
    files: list[dict[str, str]] = field(default_factory=list)
    intermediate: list[dict[str, Any]] | None = None


# ---------------------------------------------------------------------------
# Event → EvalFileData conversion
# ---------------------------------------------------------------------------


class EvalCollector:
    """Collects agent events and produces EvalFileData output.

    Extracts the Gemini request context from ``sendRequest`` events,
    assembles model response parts from thought/functionCall events,
    and uses the ``complete`` event for the outcome.
    """

    def __init__(self) -> None:
        self.start_time: float = time.time()
        self.events: list[dict[str, Any]] = []

        # Extracted from sendRequest
        self.context: list[dict[str, Any]] = []
        self.config: dict[str, Any] | None = None

        # Model response parts (accumulated across events)
        self.model_parts: list[dict[str, Any]] = []

        # Metrics
        self.total_thoughts = 0
        self.total_function_calls = 0
        self.turn_count = 0

        # Outcome
        self.outcome: dict[str, Any] | None = None

        # Intermediate files from the agent file system
        self.intermediate: list[dict[str, Any]] | None = None

        # Error
        self.error: str | None = None

    def collect(self, event: dict[str, Any]) -> None:
        """Process a single event dict."""
        self.events.append(event)

        if "sendRequest" in event:
            body = event["sendRequest"].get("body", {})
            self.context = body.get("contents", [])
            config = {
                k: v for k, v in body.items() if k != "contents"
            }
            # Ensure systemInstruction is always present — the viewer's
            # markdown() directive crashes on undefined.
            config.setdefault("systemInstruction", {
                "parts": [{"text": ""}],
            })
            self.config = config or None
            self.turn_count += 1

        elif "thought" in event:
            text = event["thought"].get("text", "")
            self.model_parts.append({"text": text, "thought": True})
            self.total_thoughts += 1

        elif "functionCall" in event:
            fc = event["functionCall"]
            self.model_parts.append({
                "functionCall": {
                    "name": fc.get("name", ""),
                    "args": fc.get("args", {}),
                },
            })
            self.total_function_calls += 1

        elif "error" in event:
            self.error = event["error"].get("message", "Unknown error")

        elif "complete" in event:
            result = event["complete"].get("result", {})
            self.outcome = result
            self.intermediate = result.get("intermediate")

    def to_eval_file_data(self) -> list[dict[str, Any]]:
        """Produce the EvalFileData array (context + outcome entries)."""
        end_time = time.time()
        total_duration_ms = (end_time - self.start_time) * 1000

        full_context = list(self.context)
        if self.model_parts:
            full_context.append({
                "parts": self.model_parts,
                "role": "model",
            })

        started = datetime.fromtimestamp(
            self.start_time, tz=timezone.utc,
        ).isoformat()

        result: list[dict[str, Any]] = [
            {
                "type": "context",
                "startedDateTime": started,
                "totalDurationMs": total_duration_ms,
                "turnCount": self.turn_count,
                "totalRequestTimeMs": total_duration_ms,
                "totalThoughts": self.total_thoughts,
                "totalFunctionCalls": self.total_function_calls,
                "config": self.config,
                "context": full_context,
            },
        ]

        if self.outcome is not None:
            result.append({
                "type": "outcome",
                "outcome": self.outcome,
            })

        return result

    def outcome_text(self) -> str | None:
        """Extract a text summary of the outcome, if any."""
        if self.outcome is None:
            return None
        outcomes = self.outcome.get("outcomes", {})
        parts = outcomes.get("parts", [])
        texts = [p.get("text", "") for p in parts if "text" in p]
        return "\n".join(texts) if texts else None


# ---------------------------------------------------------------------------
# File extraction
# ---------------------------------------------------------------------------


def extract_files(
    intermediate: list[dict[str, Any]] | None,
    output_dir: Path,
) -> list[dict[str, str]]:
    """Extract agent file system files to disk.

    Writes each file from ``CompleteEvent.result.intermediate`` into
    ``output_dir``, preserving the ``/mnt/`` path structure. Skips
    system files (``/mnt/system/*``).

    Returns a manifest of ``[{path, mimeType, localPath}]``.
    """
    if not intermediate:
        return []

    manifest: list[dict[str, str]] = []

    for file_data in intermediate:
        path = file_data.get("path", "")
        content = file_data.get("content", {})

        # Skip system files — they are virtual getters, not real files.
        if path.startswith("/mnt/system/"):
            continue

        # Build local path preserving /mnt/ structure.
        # e.g. /mnt/poem.md → output_dir/mnt/poem.md
        local_rel = path.lstrip("/")
        local_path = output_dir / local_rel
        local_path.parent.mkdir(parents=True, exist_ok=True)

        if "text" in content:
            local_path.write_text(content["text"], encoding="utf-8")
            manifest.append({
                "path": path,
                "mimeType": "text/plain",
                "localPath": str(local_path),
            })
        elif "inlineData" in content:
            inline = content["inlineData"]
            data = base64.b64decode(inline.get("data", ""))
            local_path.write_bytes(data)
            manifest.append({
                "path": path,
                "mimeType": inline.get("mimeType", "application/octet-stream"),
                "localPath": str(local_path),
            })

    return manifest


# ---------------------------------------------------------------------------
# Shared auth setup
# ---------------------------------------------------------------------------


def load_gemini_key() -> str:
    """Load GEMINI_KEY from .env, exit on failure."""
    load_dotenv(PACKAGE_DIR / ".env")
    gemini_key = os.environ.get("GEMINI_KEY", "")
    if not gemini_key:
        print("Error: GEMINI_KEY not found in .env", file=sys.stderr)
        sys.exit(1)
    return gemini_key


# ---------------------------------------------------------------------------
# Core session runner
# ---------------------------------------------------------------------------


async def run_session(
    text: str,
    *,
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
    label: str = "",
) -> SessionResult:
    """Run a single agent session and return the result.

    Streams events, writes the EvalFileData log file, and returns
    a ``SessionResult`` with metrics.
    """
    session_store = InMemorySessionStore()
    interaction_store = InMemoryInteractionStore()
    subscribers = Subscribers()

    session_id = str(uuid.uuid4())
    segments = [{"type": "text", "text": text}]

    await new_session(
        session_id=session_id,
        segments=segments,
        store=session_store,
        backend=backend,
        interaction_store=interaction_store,
        flags={},
        graph={},
    )

    queue = subscribers.subscribe(session_id)

    collector = EvalCollector()
    task = asyncio.create_task(
        start_session(
            session_id=session_id,
            store=session_store,
            subscribers=subscribers,
        )
    )
    register_task(session_id, task)

    prefix = f"[{label}] " if label else ""

    event_count = 0
    while True:
        event = await queue.get()
        if event is None:
            break
        collector.collect(event)
        event_count += 1
        _print_event_summary(event, prefix=prefix)

    await task

    status = await session_store.get_status(session_id)

    # Write EvalFileData output.
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    out_path = OUT_DIR / f"bees-session-{date_stamp}.log.json"
    eval_data = collector.to_eval_file_data()
    with open(out_path, "w") as f:
        json.dump(eval_data, f, indent=2, ensure_ascii=False)

    return SessionResult(
        session_id=session_id,
        status=str(status),
        events=event_count,
        output=str(out_path),
        turns=collector.turn_count,
        thoughts=collector.total_thoughts,
        outcome=collector.outcome_text(),
        error=collector.error,
        files=[],  # Caller extracts files if needed.
        intermediate=collector.intermediate,
    )


# ---------------------------------------------------------------------------
# Event display
# ---------------------------------------------------------------------------


def _print_event_summary(
    event: dict[str, Any], *, prefix: str = "",
) -> None:
    """Print a one-line summary of notable events to stderr."""
    if "thought" in event:
        text = event["thought"].get("text", "")
        preview = text[:80].replace("\n", " ")
        print(f"  {prefix}💭 {preview}", file=sys.stderr)
    elif "functionCall" in event:
        name = event["functionCall"].get("name", "?")
        print(f"  {prefix}🔧 {name}", file=sys.stderr)
    elif "error" in event:
        msg = event["error"].get("message", "?")
        print(f"  {prefix}❌ {msg}", file=sys.stderr)
    elif "complete" in event:
        success = event["complete"].get("result", {}).get("success", False)
        icon = "✅" if success else "❌"
        print(f"  {prefix}{icon} complete", file=sys.stderr)
