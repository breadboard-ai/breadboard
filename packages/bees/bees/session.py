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
from opal_backend.events import SUSPEND_TYPES
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
from bees.functions.skills import get_skills_function_group, scan_skills
from bees.functions.simple_files import get_simple_files_function_group_factory
from bees.functions.system import get_system_function_group_factory
from bees.functions.sandbox import get_sandbox_function_group_factory
from bees.functions.playbooks import get_playbooks_function_group
from bees.functions.chat import get_chat_function_group_factory
from bees.functions.coordination import get_coordination_function_group

# Scan skills once at import time.
_BEES_DIR = Path(__file__).resolve().parent
_SKILLS_LISTING, _SKILLS_FILES, _SKILLS_LIST = scan_skills(_BEES_DIR)

PACKAGE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = PACKAGE_DIR / "out"


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

        # Suspend state
        self.suspended: bool = False
        self.suspend_event: dict[str, Any] | None = None

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

        else:
            # Check for suspend events.
            for suspend_type in SUSPEND_TYPES:
                if suspend_type in event:
                    self.suspended = True
                    self.suspend_event = event
                    break

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
    ``output_dir`` as bare filenames (``/mnt/`` prefix stripped). Skips
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

        # Strip /mnt/ prefix so files land at output_dir/foo.md, not
        # output_dir/mnt/foo.md — consistent with what the sandbox sees.
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


def load_gemini_key() -> str:
    """Load GEMINI_KEY from .env, exit on failure."""
    load_dotenv(PACKAGE_DIR / ".env")
    gemini_key = os.environ.get("GEMINI_KEY", "")
    if not gemini_key:
        print("Error: GEMINI_KEY not found in .env", file=sys.stderr)
        sys.exit(1)
    return gemini_key



def _filter_skills(allowed_skills: list[str] | None) -> tuple[str, dict[str, str]]:
    """Filter skills based on allowed_skills and return listing + files."""
    skills_to_use = allowed_skills if allowed_skills is not None else []

    if "*" in skills_to_use:
        filtered_skills = _SKILLS_LIST
    else:
        filtered_skills = [s for s in _SKILLS_LIST if s.name in skills_to_use]

    lines = []
    for s in filtered_skills:
        lines.append(f"- [{s.title}]({s.vfs_path})")
        if s.description:
            lines.append(f"  {s.description}")
    session_listing = "\n".join(lines)

    session_files = {}
    for k, v in _SKILLS_FILES.items():
        if any(f"skills/{s.dir_name}/" in k for s in filtered_skills):
            session_files[k] = v

    return session_listing, session_files


# ---------------------------------------------------------------------------
# Core session runner
# ---------------------------------------------------------------------------


async def run_session(
    text: str = "",
    *,
    segments: list[dict[str, Any]] | None = None,
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
    label: str = "",
    ticket_id: str | None = None,
    ticket_dir: Path | None = None,
    on_event: Any | None = None,
    function_filter: list[str] | None = None,
    allowed_skills: list[str] | None = None,
    model: str | None = None,
    on_playbook_run: Any | None = None,
    on_coordination_emit: Any | None = None,
) -> SessionResult:
    """Run a single agent session and return the result.

    Accepts either ``text`` (simple text prompt) or ``segments``
    (structured segments for the sessions API wire protocol).

    If ``ticket_dir`` is provided, session state is persisted on
    suspend so it can be resumed later.
    """
    session_store = InMemorySessionStore()
    interaction_store = InMemoryInteractionStore()
    subscribers = Subscribers()

    session_id = str(uuid.uuid4())
    if segments is None:
        segments = [{"type": "text", "text": text}]

    session_listing, session_files = _filter_skills(allowed_skills)

    # Mirror skill tools to the real filesystem so execute_bash can use them.
    if ticket_dir:
        for k, v in session_files.items():
            if "/tools/" in k:
                _MNT = "/mnt/"
                rel_path = k[len(_MNT):] if k.startswith(_MNT) else k.lstrip("/")
                local_path = ticket_dir / "filesystem" / rel_path
                local_path.parent.mkdir(parents=True, exist_ok=True)
                local_path.write_text(v, encoding="utf-8")

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
            get_simple_files_function_group_factory(),
            get_skills_function_group(available_skills=session_listing),
            get_sandbox_function_group_factory(
                work_dir=ticket_dir / "filesystem" if ticket_dir else None,
            ),
            get_playbooks_function_group(on_playbook_run=on_playbook_run),
            get_coordination_function_group(on_coordination_emit=on_coordination_emit),
            get_chat_function_group_factory(),
        ],
        initial_files=session_files,
        function_filter=function_filter,
        model=model,
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
        if on_event:
            await on_event(event)

    await task

    status = await session_store.get_status(session_id)

    # Write EvalFileData output.
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    prefix = f"bees-{ticket_id[:8]}" if ticket_id else "bees-session"
    out_path = OUT_DIR / f"{prefix}-{date_stamp}.log.json"
    eval_data = collector.to_eval_file_data()
    with open(out_path, "w") as f:
        json.dump(eval_data, f, indent=2, ensure_ascii=False)

    # If suspended and we have a ticket dir, persist state for resume.
    if collector.suspended and ticket_dir:
        await _save_suspended_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
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
    )




async def resume_session(
    *,
    ticket_id: str | None = None,
    ticket_dir: Path,
    response: dict[str, Any],
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
    label: str = "",
    on_event: Any | None = None,
    on_playbook_run: Any | None = None,
    on_coordination_emit: Any | None = None,
) -> SessionResult:
    """Resume a suspended session from saved state on disk.

    Loads session state from ``ticket_dir``, reconstructs the session
    infrastructure, and calls the sessions API ``resume_session()``.
    """
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
    interaction_state = InteractionState.from_dict(context["interaction_state"])

    session_store = InMemorySessionStore()
    interaction_store = InMemoryInteractionStore()
    subscribers = Subscribers()

    # Load allowed skills from ticket metadata
    metadata_path = ticket_dir / "metadata.json"
    allowed_skills = None
    if metadata_path.exists():
        try:
            meta = json.loads(metadata_path.read_text())
            allowed_skills = meta.get("skills")
        except Exception:
            pass

    session_listing, _ = _filter_skills(allowed_skills)

    # new_session creates the _SessionContext entry and a fresh session.
    # We must set resume_id/status AFTER this call because create()
    # replaces any existing session state.
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
            get_simple_files_function_group_factory(),
            get_skills_function_group(available_skills=session_listing),
            get_sandbox_function_group_factory(
                work_dir=ticket_dir / "filesystem",
            ),
            get_playbooks_function_group(on_playbook_run=on_playbook_run),
            get_coordination_function_group(on_coordination_emit=on_coordination_emit),
            get_chat_function_group_factory(),
        ],
        # initial_files not needed on resume — already in FS snapshot.
    )

    # Now set up the session as if it had been suspended.
    await session_store.set_status(session_id, "suspended")
    await session_store.set_resume_id(session_id, interaction_id)
    await interaction_store.save(interaction_id, interaction_state)

    queue = subscribers.subscribe(session_id)

    collector = EvalCollector()
    task = asyncio.create_task(
        api_resume_session(
            session_id=session_id,
            response=response,
            store=session_store,
            subscribers=subscribers,
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
            if on_event:
                await on_event(event)

        await task
    finally:
        # Write EvalFileData output.
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
        prefix = f"bees-{ticket_id[:8]}" if ticket_id else "bees-session"
        out_path = OUT_DIR / f"{prefix}-{date_stamp}.log.json"
        eval_data = collector.to_eval_file_data()
        with open(out_path, "w") as f:
            json.dump(eval_data, f, indent=2, ensure_ascii=False)

        # Create bees-session-latest.log.json symlink for easy reference
        latest_path = OUT_DIR / "bees-session-latest.log.json"
        try:
            if latest_path.exists() or latest_path.is_symlink():
                 latest_path.unlink()
            latest_path.symlink_to(out_path.name)
        except OSError:
            pass

    status = await session_store.get_status(session_id)

    # If suspended again, persist new state.
    if collector.suspended:
        await _save_suspended_state(
            session_id=session_id,
            collector=collector,
            session_store=session_store,
            interaction_store=interaction_store,
            ticket_dir=ticket_dir,
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


async def _save_suspended_state(
    *,
    session_id: str,
    collector: EvalCollector,
    session_store: InMemorySessionStore,
    interaction_store: InMemoryInteractionStore,
    ticket_dir: Path,
) -> None:
    """Extract and persist session state when a suspend is detected."""
    # The interaction_id is embedded in the suspend event.
    interaction_id = None
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
    elif "complete" in event:
        success = event["complete"].get("result", {}).get("success", False)
        icon = "✅" if success else "❌"
        print(f"  {prefix}{icon} complete", file=sys.stderr)
    else:
        for suspend_type in SUSPEND_TYPES:
            if suspend_type in event:
                print(f"  {prefix}⏸️  {suspend_type}", file=sys.stderr)
                break
