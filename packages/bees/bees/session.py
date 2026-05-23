# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session utilities — shared logic for draining sessions and persisting state.

Provides :func:`drain_session` (the composition point between a
``SessionStream`` and ``SessionResult``), resume state persistence, eval
log collection, and file extraction.
"""

from __future__ import annotations

import base64
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from bees.protocols.session import PAUSE_TYPES, SUSPEND_TYPES, SessionResult

CHAT_LOG_FILENAME = "chat_log.json"


def _write_eval_log(out_path: Path, eval_data: list[dict[str, Any]]) -> None:
    """Write evaluation log to disk and update latest symlink."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(eval_data, f, indent=2, ensure_ascii=False)

    latest_path = out_path.parent / "bees-session-latest.log.json"
    try:
        if latest_path.exists() or latest_path.is_symlink():
            latest_path.unlink()
        latest_path.symlink_to(out_path.name)
    except OSError:
        pass



def _make_chat_log_writer(ticket_dir: Path) -> Callable[[str, str], None]:
    """Create a callback that appends entries to ``chat_log.json``.

    Each entry is ``{"role": "agent"|"user", "text": "..."}``."""

    def writer(role: str, content: str) -> None:
        log_path = ticket_dir / CHAT_LOG_FILENAME
        log_path.parent.mkdir(parents=True, exist_ok=True)
        entries: list[dict[str, str]] = []
        if log_path.exists():
            try:
                entries = json.loads(log_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        entries.append({"role": role, "text": content})
        log_path.write_text(
            json.dumps(entries, indent=2, ensure_ascii=False) + "\n"
        )

    return writer


def append_chat_log(ticket_dir: Path, role: str, text: str) -> None:
    """Append a message to the ticket's chat log (public API for scheduler)."""
    _make_chat_log_writer(ticket_dir)(role, text)


# SessionResult is defined in bees.protocols.session and re-exported here
# for backward compatibility.
__all__ = ["SessionResult"]


# ---------------------------------------------------------------------------
# Event → EvalFileData conversion
# ---------------------------------------------------------------------------


class EvalCollector:
    """Collects agent events and produces structured run output.

    Tracks per-turn context boundaries from ``sendRequest`` events,
    pairs each turn with its token usage from ``usageMetadata``,
    and emits the result as ``type: "run"``.
    """

    def __init__(self) -> None:
        self.start_time: float = time.time()
        self.events: list[dict[str, Any]] = []

        # Extracted from sendRequest
        self.context: list[dict[str, Any]] = []
        self.config: dict[str, Any] | None = None

        # Model response parts (accumulated across events)
        self.model_parts: list[dict[str, Any]] = []

        # Per-turn tracking: each entry records the context length when
        # the sendRequest fired, giving exact turn boundaries.
        self.turns: list[dict[str, Any]] = []

        # Metrics
        self.total_thoughts = 0
        self.total_function_calls = 0
        self.turn_count = 0

        # Outcome
        self.outcome: dict[str, Any] | None = None

        # Aggregate token usage
        self.total_prompt_tokens = 0
        self.total_candidates_tokens = 0
        self.total_thoughts_tokens = 0
        self.total_cached_tokens = 0
        self.total_tokens = 0

        # Intermediate files from the agent file system
        self.intermediate: list[dict[str, Any]] | None = None

        # Suspend state
        self.suspended: bool = False
        self.suspend_event: dict[str, Any] | None = None

        # Pause state (transient Gemini API error)
        self.paused: bool = False
        self.paused_event: dict[str, Any] | None = None

        # Error
        self.error: str | None = None

    def collect(self, event: dict[str, Any]) -> None:
        """Process a single event dict."""
        self.events.append(event)

        if "sendRequest" in event:
            body = event["sendRequest"].get("body", {})
            self.context = body.get("contents", [])
            # Record the turn boundary: the context length at this point
            # tells the viewer exactly where this turn's input ends.
            self.turns.append({
                "contextLengthAtStart": len(self.context),
                "tokenMetadata": None,
            })
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

        elif "systemMessage" in event:
            text = event["systemMessage"].get("text", "")
            self.model_parts.append({"text": text, "systemMessage": True})

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

        elif "usageMetadata" in event:
            metadata = event["usageMetadata"].get("metadata", {})
            # Attach to the current (latest) turn.
            if self.turns:
                self.turns[-1]["tokenMetadata"] = metadata
            self.total_prompt_tokens += metadata.get(
                "promptTokenCount", 0
            )
            self.total_candidates_tokens += metadata.get(
                "candidatesTokenCount", 0
            )
            self.total_thoughts_tokens += metadata.get(
                "thoughtsTokenCount", 0
            )
            self.total_cached_tokens += metadata.get(
                "cachedContentTokenCount", 0
            )
            self.total_tokens += metadata.get("totalTokenCount", 0)

        elif "complete" in event:
            result = event["complete"].get("result", {})
            self.outcome = result
            self.intermediate = result.get("intermediate")

        else:
            # Check for paused events (transient Gemini API errors).
            if "paused" in event:
                self.paused = True
                self.paused_event = event
                self.error = event["paused"].get("message", "Paused")
                return

            # Check for suspend events.
            for suspend_type in SUSPEND_TYPES:
                if suspend_type in event:
                    self.suspended = True
                    self.suspend_event = event
                    break

    def to_eval_file_data(
        self, *, ticket_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Produce the EvalFileData array (run + outcome entries)."""
        end_time = time.time()
        total_duration_ms = (end_time - self.start_time) * 1000

        full_context = list(self.context)

        started = datetime.fromtimestamp(
            self.start_time, tz=timezone.utc,
        ).isoformat()

        result: list[dict[str, Any]] = [
            {
                "type": "run",
                "sessionId": ticket_id,
                "startedDateTime": started,
                "totalDurationMs": total_duration_ms,
                "turnCount": self.turn_count,
                "totalRequestTimeMs": total_duration_ms,
                "totalThoughts": self.total_thoughts,
                "totalFunctionCalls": self.total_function_calls,
                "tokenMetadata": {
                    "totalPromptTokens": self.total_prompt_tokens,
                    "totalCandidatesTokens": self.total_candidates_tokens,
                    "totalThoughtsTokens": self.total_thoughts_tokens,
                    "totalCachedTokens": self.total_cached_tokens,
                    "totalTokens": self.total_tokens,
                },
                "turns": self.turns,
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

    def outcome_llm_content(self) -> dict[str, Any] | None:
        """Return the full LLMContent outcome, if any."""
        if self.outcome is None:
            return None
        return self.outcome.get("outcomes")


# ---------------------------------------------------------------------------
# File extraction
# ---------------------------------------------------------------------------


def extract_files(
    intermediate: list[dict[str, Any]] | None,
    output_dir: Path,
) -> list[dict[str, str]]:
    """Extract agent file system files to disk.

    Writes each file from ``CompleteEvent.result.intermediate`` into
    ``output_dir``. Skips system files (``system/*`` or legacy
    ``/mnt/system/*``).

    Returns a manifest of ``[{path, mimeType, localPath}]``.
    """
    if not intermediate:
        return []

    manifest: list[dict[str, str]] = []

    for file_data in intermediate:
        path = file_data.get("path", "")
        content = file_data.get("content", {})

        # Skip system files — they are virtual getters, not real files.
        if path.startswith("system/") or path.startswith("/mnt/system/"):
            continue

        # Handle both bare paths (DiskFileSystem) and legacy /mnt/ paths.
        _MNT = "/mnt/"
        rel = path[len(_MNT):] if path.startswith(_MNT) else path.lstrip("/")
        local_path = output_dir / rel
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


def _fs_changed(snap1: Any | None, snap2: Any | None) -> bool:
    """Compare two FileSystemSnapshots and return True if they differ."""
    if (snap1 is None) != (snap2 is None):
        return True
    if snap1 is None or snap2 is None:
        return False
    if snap1.file_count != snap2.file_count:
        return True
    if snap1.routes != snap2.routes:
        return True
    if set(snap1.files.keys()) != set(snap2.files.keys()):
        return True
    for path, fd1 in snap1.files.items():
        fd2 = snap2.files[path]
        if fd1.data != fd2.data or fd1.mime_type != fd2.mime_type or fd1.type != fd2.type:
            return True
    return False


# ---------------------------------------------------------------------------
# Session draining — the composition point
# ---------------------------------------------------------------------------


async def drain_session(
    stream: "SessionStream",
    *,
    config: "SessionConfiguration",
    ticket_id: str | None = None,
    on_event: Any | None = None,
) -> SessionResult:
    """Drain a session stream into a ``SessionResult``.

    Iterates the stream, collects events via :class:`EvalCollector`, writes
    eval logs at turn boundaries, prints event summaries, and builds the
    final ``SessionResult``.

    The caller is responsible for:

    - Mid-session context injection via ``stream.send_context()``.
    - Persisting ``stream.resume_state()`` after this returns.

    Args:
        stream: A running session's event stream.
        config: The provisioned session configuration (used for
            label and log_path).
        ticket_id: Task identifier for log tagging.
        on_event: Optional async callback invoked for each event.
    """
    from bees.protocols.session import SessionConfiguration, SessionStream
    from opal_backend.sessions.file_store import FileBasedSessionStore
    from opal_backend.sessions.in_memory_store import InMemorySessionStore

    prefix = f"[{config.label}] " if config.label else ""
    log_path = config.log_path
    collector = EvalCollector()
    event_count = 0

    chat_entry = config.on_chat_entry if config else None
    prev_context_len = 0

    session_id = config.session_id or ticket_id or ""
    if config.ticket_dir:
        session_store = FileBasedSessionStore(config.ticket_dir / "sessions")
    else:
        session_store = InMemorySessionStore()

    # Ensure session is created in the store (relevant for unit tests / standalone runs)
    if await session_store.get_status(session_id) is None:
        await session_store.create(session_id)

    # Retrieve existing checkpoints to know where we are starting from
    existing_checkpoints = await session_store.get_turn_boundaries(session_id)
    start_turn_index = len(existing_checkpoints)
    current_turn_index = start_turn_index - 1

    last_fs_snapshot = None
    if start_turn_index > 0:
        for cp in reversed(existing_checkpoints):
            if cp.get("file_system") is not None:
                last_fs_snapshot = cp["file_system"]
                break
    else:
        if hasattr(config.file_system, "snapshot"):
            last_fs_snapshot = config.file_system.snapshot

    try:
        async for event in stream:
            collector.collect(event)
            event_count += 1
            _print_event_summary(event, prefix=prefix)

            # Persist the raw event to events.jsonl when the runner
            # doesn't use opal's _tee_events (which writes events itself).
            if config.persist_events:
                await session_store.append_event(session_id, event)

            # Record turn boundary and checkpoint on sendRequest
            if "sendRequest" in event:
                contents = event["sendRequest"].get("body", {}).get("contents", [])
                context_len = len(contents)
                current_turn_index += 1

                fs_snap = None
                if hasattr(config.file_system, "snapshot"):
                    current_snap = config.file_system.snapshot
                    if current_turn_index == 0 or _fs_changed(current_snap, last_fs_snapshot):
                        fs_snap = current_snap
                        last_fs_snapshot = current_snap

                await session_store.record_turn_boundary(
                    session_id=session_id,
                    turn_index=current_turn_index,
                    context_length=context_len,
                    file_system=fs_snap,
                )

            # Update token metadata on usageMetadata
            elif "usageMetadata" in event:
                metadata = event["usageMetadata"].get("metadata", {})
                if current_turn_index >= 0:
                    await session_store.record_turn_boundary(
                        session_id=session_id,
                        turn_index=current_turn_index,
                        context_length=0,
                        file_system=None,
                        token_metadata=metadata,
                    )

            # Write log at turn boundaries.
            if log_path and (
                "sendRequest" in event
                or "usageMetadata" in event
                or "complete" in event
                or "error" in event
                or "paused" in event
                or any(k in event for k in SUSPEND_TYPES)
            ):
                _write_eval_log(
                    log_path,
                    collector.to_eval_file_data(ticket_id=ticket_id),
                )

            # Extract conversation text for the chat log.
            # For live sessions, sendRequest events carry the accumulated
            # context (including model and user turns).  We scan for new
            # entries since the last sendRequest and log their text.
            # Batch sessions skip this — their chat function handlers
            # write log entries directly.
            if (
                "sendRequest" in event
                and chat_entry
                and config.extract_chat_from_context
            ):
                contents = (
                    event["sendRequest"]
                    .get("body", {})
                    .get("contents", [])
                )
                for entry in contents[prev_context_len:]:
                    role = entry.get("role")
                    parts = entry.get("parts", [])
                    # Skip entries that are only tool responses.
                    if all("functionResponse" in p for p in parts):
                        continue
                    text_parts = [
                        p.get("text", "")
                        for p in parts
                        if "text" in p
                    ]
                    text = "".join(text_parts).strip()
                    if text and role == "model":
                        chat_entry("agent", text)
                    elif text and role == "user":
                        chat_entry("user", text)
                prev_context_len = len(contents)

            if on_event:
                await on_event(event)
    finally:
        # Final log write — captures any events since the last boundary.
        if log_path:
            _write_eval_log(
                log_path,
                collector.to_eval_file_data(ticket_id=ticket_id),
            )

    # Derive status from collector state.
    if collector.suspended:
        status = "suspended"
    elif collector.paused:
        status = "paused"
    elif collector.error:
        status = "failed"
    else:
        status = "completed"

    return SessionResult(
        session_id=ticket_id or "",
        status=status,
        events=event_count,
        output=str(log_path) if log_path else "",
        turns=collector.turn_count,
        thoughts=collector.total_thoughts,
        outcome=collector.outcome_text(),
        error=collector.error,
        files=[],
        intermediate=collector.intermediate,
        suspended=collector.suspended,
        suspend_event=collector.suspend_event,
        outcome_content=collector.outcome_llm_content(),
        paused=collector.paused,
        paused_event=collector.paused_event,
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
    elif "systemMessage" in event:
        text = event["systemMessage"].get("text", "")
        preview = text[:80].replace("\n", " ")
        print(f"  {prefix}⚡ {preview}", file=sys.stderr)
    elif "functionCall" in event:
        call = event["functionCall"]
        name = call.get("name", "?")
        args = call.get("args", {})

        # Format condensed preview of arguments
        import json
        args_json = json.dumps(args, ensure_ascii=False)
        args_preview = args_json[:60] + ("..." if len(args_json) > 60 else "")

        print(f"  {prefix}🔧 {name} {args_preview}", file=sys.stderr)
    elif "error" in event:
        msg = event["error"].get("message", "?")
        print(f"  {prefix}❌ {msg}", file=sys.stderr)
    elif "usageMetadata" in event:
        m = event["usageMetadata"].get("metadata", {})
        parts = []
        if "promptTokenCount" in m:
            parts.append(f"prompt={m['promptTokenCount']}")
        if "candidatesTokenCount" in m:
            parts.append(f"candidates={m['candidatesTokenCount']}")
        if "cachedContentTokenCount" in m:
            parts.append(f"cached={m['cachedContentTokenCount']}")
        if "thoughtsTokenCount" in m:
            parts.append(f"thoughts={m['thoughtsTokenCount']}")
        print(f"  {prefix}📊 tokens: {', '.join(parts)}", file=sys.stderr)
    elif "complete" in event:
        success = event["complete"].get("result", {}).get("success", False)
        icon = "✅" if success else "❌"
        print(f"  {prefix}{icon} complete", file=sys.stderr)
    else:
        if "paused" in event:
            msg = event["paused"].get("message", "?")
            print(f"  {prefix}⏸ paused: {msg}", file=sys.stderr)
            return
        for suspend_type in SUSPEND_TYPES:
            if suspend_type in event:
                print(f"  {prefix}⏸️  {suspend_type}", file=sys.stderr)
                break
