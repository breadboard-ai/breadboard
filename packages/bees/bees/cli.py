# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees CLI — start an agent session and stream events to a file.

Usage::

    npm run session:start -w packages/bees -- "Your prompt text here"

Reads GEMINI_KEY from ``packages/bees/.env``.

Output format matches the eval viewer (``EvalFileData``): a JSON array
with ``context`` and ``outcome`` entries, loadable directly by
``packages/visual-editor/eval/viewer``.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import uuid
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

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PACKAGE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = PACKAGE_DIR / "out"


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

    def collect(self, event: dict[str, Any]) -> None:
        """Process a single event dict."""
        self.events.append(event)

        if "sendRequest" in event:
            body = event["sendRequest"].get("body", {})
            self.context = body.get("contents", [])
            # Config is everything except contents.
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

        elif "complete" in event:
            result = event["complete"].get("result", {})
            self.outcome = result

    def to_eval_file_data(self) -> list[dict[str, Any]]:
        """Produce the EvalFileData array (context + outcome entries)."""
        end_time = time.time()
        total_duration_ms = (end_time - self.start_time) * 1000

        # Build the full context: request contents + model response turn.
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


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------


async def run_session(text: str) -> dict[str, Any]:
    """Start an agent session, stream events, write EvalFileData output.

    Returns a summary dict with session ID, status, and output path.
    """
    # Load .env from the package directory.
    load_dotenv(PACKAGE_DIR / ".env")
    gemini_key = os.environ.get("GEMINI_KEY", "")
    if not gemini_key:
        print("Error: GEMINI_KEY not found in .env", file=sys.stderr)
        sys.exit(1)

    # Build deps.
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )
        session_store = InMemorySessionStore()
        interaction_store = InMemoryInteractionStore()
        subscribers = Subscribers()

        session_id = str(uuid.uuid4())
        segments = [{"type": "text", "text": text}]

        # Create session.
        await new_session(
            session_id=session_id,
            segments=segments,
            store=session_store,
            backend=backend,
            interaction_store=interaction_store,
            flags={},
            graph={},
        )

        # Subscribe before starting so we don't miss events.
        queue = subscribers.subscribe(session_id)

        # Start the session as a background task.
        collector = EvalCollector()
        task = asyncio.create_task(
            start_session(
                session_id=session_id,
                store=session_store,
                subscribers=subscribers,
            )
        )
        register_task(session_id, task)

        # Drain events.
        event_count = 0
        while True:
            event = await queue.get()
            if event is None:
                break
            collector.collect(event)
            event_count += 1
            _print_event_summary(event)

        # Wait for the background task to finish cleanly.
        await task

        status = await session_store.get_status(session_id)

    # Write EvalFileData output.
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    out_path = OUT_DIR / f"bees-session-{date_stamp}.log.json"
    eval_data = collector.to_eval_file_data()
    with open(out_path, "w") as f:
        json.dump(eval_data, f, indent=2, ensure_ascii=False)

    return {
        "session_id": session_id,
        "status": str(status),
        "events": event_count,
        "output": str(out_path),
    }


# ---------------------------------------------------------------------------
# Event display
# ---------------------------------------------------------------------------


def _print_event_summary(event: dict[str, Any]) -> None:
    """Print a one-line summary of notable events to stderr."""
    if "thought" in event:
        text = event["thought"].get("text", "")
        preview = text[:80].replace("\n", " ")
        print(f"  💭 {preview}", file=sys.stderr)
    elif "functionCall" in event:
        name = event["functionCall"].get("name", "?")
        print(f"  🔧 {name}", file=sys.stderr)
    elif "error" in event:
        msg = event["error"].get("message", "?")
        print(f"  ❌ {msg}", file=sys.stderr)
    elif "complete" in event:
        success = event["complete"].get("result", {}).get("success", False)
        icon = "✅" if success else "❌"
        print(f"  {icon} complete", file=sys.stderr)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """CLI entry point."""
    args = sys.argv[1:]
    if not args:
        print(
            "Usage: npm run session:start -w packages/bees -- \"prompt text\"",
            file=sys.stderr,
        )
        sys.exit(1)

    text = " ".join(args)
    print(f"Starting session with: {text!r}", file=sys.stderr)

    result = asyncio.run(run_session(text))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
