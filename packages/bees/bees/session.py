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
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import httpx

from opal_backend.local.backend_client_impl import HttpBackendClient
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.events import PAUSE_TYPES, SUSPEND_TYPES
from opal_backend.interaction_store import InteractionState
from opal_backend.sessions.api import (
    Subscribers,
    new_session,
    register_task,
    resume_session as api_resume_session,
    start_session,
    update_context,
)
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from bees.functions.skills import get_skills_function_group
from bees.functions.simple_files import get_simple_files_function_group_factory
from bees.functions.system import get_system_function_group_factory
from bees.functions.sandbox import get_sandbox_function_group_factory
from bees.functions.chat import get_chat_function_group_factory
from bees.functions.events import get_events_function_group_factory
from bees.functions.tasks import get_tasks_function_group_factory
from bees.context_updates import updates_to_context_parts
from bees.config import HIVE_DIR, PACKAGE_DIR
from bees.disk_file_system import DiskFileSystem
from bees.subagent_scope import SubagentScope
from bees.skill_filter import filter_skills, merge_function_filter

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


# ---------------------------------------------------------------------------
# Session result
# ---------------------------------------------------------------------------


@dataclass
class SessionResult:
    """Result of a completed or suspended session."""

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
    suspended: bool = False
    suspend_event: dict[str, Any] | None = None
    outcome_content: dict[str, Any] | None = None
    paused: bool = False
    paused_event: dict[str, Any] | None = None


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


# ---------------------------------------------------------------------------
# Shared auth setup
# ---------------------------------------------------------------------------






# ---------------------------------------------------------------------------
# Core session runner
# ---------------------------------------------------------------------------


async def run_session(
    text: str = "",
    *,
    segments: list[dict[str, Any]] | None = None,
    backend: HttpBackendClient,
    label: str = "",
    ticket_id: str | None = None,
    ticket_dir: Path | None = None,
    fs_dir: Path | None = None,
    on_event: Any | None = None,
    function_filter: list[str] | None = None,
    allowed_skills: list[str] | None = None,
    model: str | None = None,
    on_events_broadcast: Any | None = None,
    deliver_to_parent: Any | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
    context_queue: Any | None = None,
    hive_dir: Path | None = None,
    mcp_factories: list | None = None,
) -> SessionResult:
    """Run a single agent session and return the result.

    Accepts either ``text`` (simple text prompt) or ``segments``
    (structured segments for the sessions API wire protocol).

    If ``ticket_dir`` is provided, session state is persisted on
    suspend so it can be resumed later.
    """
    if hive_dir is None:
        if ticket_dir:
            hive_dir = ticket_dir.parent.parent
        else:
            from bees.config import HIVE_DIR

            hive_dir = HIVE_DIR

    session_store = InMemorySessionStore()
    interaction_store = InMemoryInteractionStore()
    subscribers = Subscribers()

    session_id = str(uuid.uuid4())
    if segments is None:
        segments = [{"type": "text", "text": text}]

    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    log_prefix = f"bees-{ticket_id[:8]}" if ticket_id else "bees-session"
    out_dir = hive_dir / "logs"
    out_path = out_dir / f"{log_prefix}-{date_stamp}.log.json"

    session_listing, session_files, skill_tools = filter_skills(
        allowed_skills, hive_dir
    )

    function_filter = merge_function_filter(
        function_filter, skill_tools, allowed_skills,
    )

    # Create disk-backed file system.
    work_dir = fs_dir or (ticket_dir / "filesystem" if ticket_dir else Path(tempfile.mkdtemp(prefix="bees-fs-")))
    disk_fs = DiskFileSystem(work_dir)

    # Seed initial files (skills) directly to disk.
    for name, content in session_files.items():
        disk_fs.write(name, content)

    workspace_root_id = scope.workspace_root_id if scope else None

    await new_session(
        session_id=session_id,
        segments=segments,
        store=session_store,
        backend=backend,
        interaction_store=interaction_store,
        flags={},
        graph={},
        extra_groups=[
            get_system_function_group_factory(),
            get_simple_files_function_group_factory(scope=scope),
            get_skills_function_group(available_skills=session_listing),
            get_sandbox_function_group_factory(
                work_dir=work_dir,
                scope=scope,
            ),
            get_events_function_group_factory(
                on_events_broadcast=on_events_broadcast,
                deliver_to_parent=deliver_to_parent,
                ticket_id=ticket_id,
                scope=scope,
                scheduler=scheduler,
            ),
            get_tasks_function_group_factory(
                scope=scope,
                caller_ticket_id=ticket_id,
                scheduler=scheduler,
                ticket_id=ticket_id,
            ),
            get_chat_function_group_factory(
                on_chat_entry=_make_chat_log_writer(ticket_dir) if ticket_dir else None,
                workspace_root_id=workspace_root_id,
                scheduler=scheduler,
            ),
        ] + (mcp_factories or []),
        function_filter=function_filter,
        model=model,
        file_system=disk_fs,
        context_queue=context_queue,
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

        # Write log at turn boundaries
        if "sendRequest" in event or "usageMetadata" in event or "complete" in event or "error" in event or "paused" in event or any(k in event for k in SUSPEND_TYPES):
            _write_eval_log(out_path, collector.to_eval_file_data(ticket_id=ticket_id))

        if on_event:
            await on_event(event)

    await task

    status = await session_store.get_status(session_id)


    # If suspended or paused, persist state for later resume.
    if collector.suspended and ticket_dir:
        await _save_session_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
        )
    elif collector.paused and ticket_dir:
        paused_iid = (
            collector.paused_event.get("paused", {}).get("interactionId")
            if collector.paused_event else None
        )
        await _save_session_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
            interaction_id=paused_iid,
        )

    return SessionResult(
        session_id=session_id,
        status=str(status),
        events=event_count,
        output=str(out_path),
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




async def resume_session(
    *,
    ticket_id: str | None = None,
    ticket_dir: Path,
    fs_dir: Path | None = None,
    response: dict[str, Any],
    backend: HttpBackendClient,
    label: str = "",
    on_event: Any | None = None,
    on_events_broadcast: Any | None = None,
    deliver_to_parent: Any | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
    context_queue: Any | None = None,
    hive_dir: Path | None = None,
    mcp_factories: list | None = None,
) -> SessionResult:
    """Resume a suspended session from saved state on disk.

    Loads session state from ``ticket_dir``, reconstructs the session
    infrastructure, and calls the sessions API ``resume_session()``.
    """
    if hive_dir is None:
        hive_dir = ticket_dir.parent.parent

    context = load_session_state(ticket_dir)
    if context is None:
        return SessionResult(
            session_id="",
            status="failed",
            events=0,
            output="",
            error="No saved session state found",
        )

    session_id = context["session_id"]
    interaction_id = context["interaction_id"]

    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    log_prefix = f"bees-{ticket_id[:8]}" if ticket_id else "bees-session"
    out_dir = hive_dir / "logs"
    out_path = out_dir / f"{log_prefix}-{date_stamp}.log.json"

    interaction_state = InteractionState.from_dict(context["interaction_state"])

    session_store = InMemorySessionStore()
    interaction_store = InMemoryInteractionStore()
    subscribers = Subscribers()

    # Load allowed skills from ticket metadata
    metadata_path = ticket_dir / "metadata.json"
    allowed_skills = None
    function_filter: list[str] | None = None
    if metadata_path.exists():
        try:
            meta = json.loads(metadata_path.read_text())
            allowed_skills = meta.get("skills")
            function_filter = meta.get("functions")
        except Exception:
            pass

    session_listing, _, skill_tools = filter_skills(allowed_skills, hive_dir)

    function_filter = merge_function_filter(
        function_filter, skill_tools, allowed_skills,
    )

    # Create disk-backed file system — files are already on disk from
    # the previous run, so no seeding needed.
    work_dir = fs_dir or ticket_dir / "filesystem"
    disk_fs = DiskFileSystem(work_dir)

    # new_session creates the _SessionContext entry and a fresh session.
    # We must set resume_id/status AFTER this call because create()
    # replaces any existing session state.
    workspace_root_id = scope.workspace_root_id if scope else None

    await new_session(
        session_id=session_id,
        segments=[],  # Not used for resume.
        store=session_store,
        backend=backend,
        interaction_store=interaction_store,
        flags={},
        graph={},
        extra_groups=[
            get_system_function_group_factory(),
            get_simple_files_function_group_factory(scope=scope),
            get_skills_function_group(available_skills=session_listing),
            get_sandbox_function_group_factory(
                work_dir=work_dir,
                scope=scope,
            ),
            get_events_function_group_factory(
                on_events_broadcast=on_events_broadcast,
                deliver_to_parent=deliver_to_parent,
                ticket_id=ticket_id,
                scope=scope,
                scheduler=scheduler,
            ),
            get_tasks_function_group_factory(
                scope=scope,
                caller_ticket_id=ticket_id,
                scheduler=scheduler,
                ticket_id=ticket_id,
            ),
            get_chat_function_group_factory(
                on_chat_entry=_make_chat_log_writer(ticket_dir),
                workspace_root_id=workspace_root_id,
                scheduler=scheduler,
            ),
        ] + (mcp_factories or []),
        function_filter=function_filter,
        file_system=disk_fs,
        context_queue=context_queue,
    )

    # Now set up the session as if it had been suspended.
    await session_store.set_status(session_id, "suspended")
    await session_store.set_resume_id(session_id, interaction_id)
    await interaction_store.save(interaction_id, interaction_state)

    # Collect context updates from both sources:
    #   1. response.json may contain context_updates (from scheduler delivery)
    #   2. ticket metadata may have pending_context_updates (buffered while running)
    all_updates: list = []
    response_updates = response.pop("context_updates", None)
    if response_updates:
        all_updates.extend(response_updates)

    if ticket_id:
        if scheduler:
            own_ticket = scheduler.store.get(ticket_id)
        else:
            from bees.ticket import get_default_store
            own_ticket = get_default_store().get(ticket_id)
            
        if own_ticket and own_ticket.metadata.pending_context_updates:
            all_updates.extend(own_ticket.metadata.pending_context_updates)
            own_ticket.metadata.pending_context_updates = []
            own_ticket.save_metadata()

    context_parts = updates_to_context_parts(all_updates) if all_updates else None

    queue = subscribers.subscribe(session_id)

    collector = EvalCollector()
    task = asyncio.create_task(
        api_resume_session(
            session_id=session_id,
            response=response,
            store=session_store,
            subscribers=subscribers,
            context_parts=context_parts,
        )
    )
    register_task(session_id, task)

    prefix = f"[{label}] " if label else ""
    event_count = 0

    try:
        while True:
            event = await queue.get()
            if event is None:
                break
            collector.collect(event)
            event_count += 1
            _print_event_summary(event, prefix=prefix)

            # Write log at turn boundaries
            if "sendRequest" in event or "usageMetadata" in event or "complete" in event or "error" in event or "paused" in event or any(k in event for k in SUSPEND_TYPES):
                _write_eval_log(out_path, collector.to_eval_file_data(ticket_id=ticket_id))

            if on_event:
                await on_event(event)

        await task
    finally:
        # Write final EvalFileData output.
        _write_eval_log(out_path, collector.to_eval_file_data(ticket_id=ticket_id))


    status = await session_store.get_status(session_id)

    # If suspended or paused again, persist new state.
    if collector.suspended:
        await _save_session_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
        )
    elif collector.paused:
        paused_iid = (
            collector.paused_event.get("paused", {}).get("interactionId")
            if collector.paused_event else None
        )
        await _save_session_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
            interaction_id=paused_iid,
        )

    return SessionResult(
        session_id=session_id,
        status=str(status),
        events=event_count,
        output=str(out_path),
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
# Session state persistence
# ---------------------------------------------------------------------------


def save_session_state(
    *,
    session_id: str,
    interaction_id: str,
    interaction_state: InteractionState,
    ticket_dir: Path,
) -> None:
    """Persist session state to the ticket directory for later resume."""
    state_path = ticket_dir / "session_state.json"
    state_path.write_text(json.dumps({
        "session_id": session_id,
        "interaction_id": interaction_id,
        "interaction_state": interaction_state.to_dict(),
    }, indent=2, ensure_ascii=False) + "\n")


def load_session_state(ticket_dir: Path) -> dict[str, Any] | None:
    """Load saved session state from the ticket directory."""
    state_path = ticket_dir / "session_state.json"
    if not state_path.exists():
        return None
    return json.loads(state_path.read_text())


def clear_session_state(ticket_dir: Path) -> None:
    """Remove saved session state (after successful resume)."""
    state_path = ticket_dir / "session_state.json"
    if state_path.exists():
        state_path.unlink()


async def _save_session_state(
    *,
    session_id: str,
    collector: EvalCollector,
    session_store: InMemorySessionStore,
    interaction_store: InMemoryInteractionStore,
    ticket_dir: Path,
    interaction_id: str | None = None,
) -> None:
    """Extract and persist session state for later resume.

    Used for both suspend (agent-requested input) and pause (transient
    Gemini API error).  When ``interaction_id`` is provided it is used
    directly; otherwise the id is extracted from the collector's suspend
    event or the session store.
    """
    if interaction_id is None:
        # Try to extract from suspend event.
        if collector.suspend_event:
            for key in SUSPEND_TYPES:
                if key in collector.suspend_event:
                    interaction_id = collector.suspend_event[key].get(
                        "interactionId"
                    )
                    break

    if not interaction_id:
        # Fallback: read from session store.
        interaction_id = await session_store.get_resume_id(session_id)

    if not interaction_id:
        return

    # Load the interaction state that was saved by the loop.
    state = await interaction_store.load(interaction_id)
    if state is None:
        return

    save_session_state(
        session_id=session_id,
        interaction_id=interaction_id,
        interaction_state=state,
        ticket_dir=ticket_dir,
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
