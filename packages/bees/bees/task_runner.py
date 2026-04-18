# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Task runner — session wiring and metadata bookkeeping for individual tasks.

Owns everything needed to execute a single task: building session input,
calling the session layer, and updating metadata with the result.  Has no
awareness of cycles, scheduling, or orchestration — that belongs to the
``Scheduler``.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from bees.protocols.session import SessionResult
from bees.segments import resolve_segments
from bees.session import (
    append_chat_log,
    clear_session_state,
    extract_files,
    load_session_state,
    resume_session,
    run_session,
)
from bees.subagent_scope import SubagentScope
from bees.task_store import TaskStore
from bees.ticket import Ticket

logger = logging.getLogger(__name__)

__all__ = ["TaskRunner"]


class TaskRunner:
    """Runs and resumes individual tasks.

    Handles session wiring, metadata bookkeeping, suspend/pause state
    transitions, and file extraction.  Receives its dependencies via
    constructor injection — no back-reference to ``Scheduler``.
    """

    def __init__(
        self,
        *,
        backend: Any,
        store: TaskStore,
        scheduler_ref: Any,
        context_queues: dict[str, asyncio.Queue],
        get_mcp_factories: Callable[[], list | None],
        deliver_context_update: Callable[[str, dict[str, Any]], None],
        on_events_broadcast: Callable[[Ticket], None],
        on_task_start: Callable[[Ticket], Awaitable[None]] | None = None,
        on_task_event: Callable[[str, dict], Awaitable[None]] | None = None,
    ) -> None:
        self._backend = backend
        self._store = store
        self._scheduler_ref = scheduler_ref
        self._context_queues = context_queues
        self._get_mcp_factories = get_mcp_factories
        self._deliver_context_update = deliver_context_update
        self._on_events_broadcast = on_events_broadcast
        self._on_task_start = on_task_start
        self._on_task_event = on_task_event

    # -- public API --------------------------------------------------------

    async def run_task(
        self,
        task: Ticket,
    ) -> SessionResult:
        """Run a single task's session and update its metadata."""
        # Reload title from disk — it may have been renamed by an on_event
        # hook during coordination routing earlier in this cycle, while the
        # in-memory task object (from list_tickets) still has the old value.
        fresh = self._store.get(task.id)
        if fresh and fresh.metadata.title != task.metadata.title:
            task.metadata.title = fresh.metadata.title

        task.metadata.status = "running"
        self._store.save_metadata(task)
        if self._on_task_start:
            await self._on_task_start(task)

        label = task.id[:8]
        print(f"▶ [{label}] {task.objective!r}", file=sys.stderr)

        try:
            ctx_queue: asyncio.Queue = asyncio.Queue()
            self._context_queues[task.id] = ctx_queue
            segments = resolve_segments(task, self._store)
            scope = SubagentScope.for_ticket(task)
            result = await run_session(
                segments=segments,
                backend=self._backend,
                label=label,
                ticket_id=task.id,
                ticket_dir=task.dir,
                fs_dir=task.fs_dir,
                on_event=self._make_on_event(task.id),
                function_filter=task.metadata.functions,
                allowed_skills=task.metadata.skills,
                model=task.metadata.model,
                on_events_broadcast=self._on_events_broadcast,
                deliver_to_parent=self._make_deliver_to_parent(task),
                scope=scope,
                scheduler=self._scheduler_ref,
                context_queue=ctx_queue,
                mcp_factories=self._get_mcp_factories(),
            )
        except Exception as exc:
            task.metadata.status = "failed"
            task.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            task.metadata.error = str(exc)
            self._store.save_metadata(task)
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )
        finally:
            self._context_queues.pop(task.id, None)

        self._update_metadata(task, result)
        self._handle_suspend(task, result)
        self._handle_pause(task, result)
        self._store.save_metadata(task)
        return result

    async def resume_task(
        self,
        task: Ticket,
    ) -> SessionResult:
        """Resume a suspended task with the user's response."""
        label = task.id[:8]
        print(f"▶ [{label}] resuming {task.objective!r}", file=sys.stderr)

        # Load the user's response.
        response_path = task.dir / "response.json"
        if not response_path.exists():
            task.metadata.status = "failed"
            task.metadata.error = "No response.json found for resume"
            self._store.save_metadata(task)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error="No response found",
            )

        response = json.loads(response_path.read_text())

        # Log user's reply to the chat log (only actual user text,
        # not context-update-only responses).
        user_text = response.get("text", "")
        if user_text:
            append_chat_log(task.dir, "user", user_text)

        task.metadata.status = "running"
        task.metadata.assignee = "agent"
        self._store.save_metadata(task)
        if self._on_task_start:
            await self._on_task_start(task)

        try:
            scope = SubagentScope.for_ticket(task)
            ctx_queue: asyncio.Queue = asyncio.Queue()
            self._context_queues[task.id] = ctx_queue
            result = await resume_session(
                ticket_id=task.id,
                ticket_dir=task.dir,
                fs_dir=task.fs_dir,
                response=response,
                backend=self._backend,
                label=label,
                on_event=self._make_on_event(task.id),
                on_events_broadcast=self._on_events_broadcast,
                deliver_to_parent=self._make_deliver_to_parent(task),
                scope=scope,
                scheduler=self._scheduler_ref,
                context_queue=ctx_queue,
                mcp_factories=self._get_mcp_factories(),
            )
        except Exception as exc:
            task.metadata.status = "failed"
            task.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            task.metadata.error = str(exc)
            self._store.save_metadata(task)
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )
        finally:
            self._context_queues.pop(task.id, None)

        self._update_metadata(task, result, accumulate=True)
        self._handle_suspend(task, result)
        self._handle_pause(task, result)

        if not result.suspended and not result.paused:
            clear_session_state(task.dir)
            # Clean up response file.
            response_path.unlink(missing_ok=True)

        self._store.save_metadata(task)
        return result

    # -- internal ----------------------------------------------------------

    def _update_metadata(
        self,
        task: Ticket,
        result: SessionResult,
        *,
        accumulate: bool = False,
    ) -> None:
        """Update task metadata from a session result.

        When ``accumulate`` is True (used on resume), turns and thoughts
        are added to the existing values rather than replaced.
        """
        task.metadata.completed_at = datetime.now(timezone.utc).isoformat()

        if result.status == "completed":
            task.metadata.status = "completed"
        elif result.paused:
            # Transient Gemini error — don't set completed_at, the task
            # is not done.  Status is set by _handle_pause below.
            task.metadata.completed_at = None
        else:
            task.metadata.status = "failed"

        if accumulate:
            task.metadata.turns += result.turns
            task.metadata.thoughts += result.thoughts
        else:
            task.metadata.turns = result.turns
            task.metadata.thoughts = result.thoughts

        if result.error:
            task.metadata.error = result.error
        if result.outcome:
            task.metadata.outcome = result.outcome
        if result.outcome_content:
            task.metadata.outcome_content = result.outcome_content

        # Extract agent file system to task directory.
        file_manifest = extract_files(
            result.intermediate, task.fs_dir,
        )
        if file_manifest:
            task.metadata.files = file_manifest

    def _handle_suspend(self, task: Ticket, result: SessionResult) -> None:
        """Handle suspend state, including queued-update auto-resume."""
        if result.suspended:
            # Reload fields that may have been modified externally while
            # the session was running (e.g., by on_event hooks or
            # coordination delivery).  The in-memory task object is
            # stale for these fields.
            fresh = self._store.get(task.id)
            if fresh:
                if fresh.metadata.queued_updates:
                    task.metadata.queued_updates = fresh.metadata.queued_updates
                if fresh.metadata.title != task.metadata.title:
                    task.metadata.title = fresh.metadata.title

            # Annotate suspend_event with the triggering function name
            # so the UI can differentiate (e.g., await_context_update
            # vs. request_user_input). Read from saved session state.
            suspend_event = dict(result.suspend_event) if result.suspend_event else {}
            state = load_session_state(task.dir)
            if state:
                fcp = state.get("interaction_state", {}).get("function_call_part", {})
                fn_name = fcp.get("functionCall", {}).get("name")
                if fn_name:
                    suspend_event["function_name"] = fn_name

            if getattr(task.metadata, "queued_updates", None):
                update = task.metadata.queued_updates.pop(0)
                response_path = task.dir / "response.json"
                response_path.write_text(
                    json.dumps({"context_updates": [update]}, indent=2, ensure_ascii=False) + "\n"
                )
                task.metadata.status = "suspended"
                task.metadata.assignee = "agent"
                task.metadata.suspend_event = suspend_event
                print(f"  [{task.id[:8]}] 📩 auto-resume with queued update", file=sys.stderr)
            else:
                task.metadata.status = "suspended"
                task.metadata.assignee = "user"
                task.metadata.suspend_event = suspend_event
        else:
            task.metadata.assignee = None
            task.metadata.suspend_event = None

    def _handle_pause(self, task: Ticket, result: SessionResult) -> None:
        """Handle pause state from transient Gemini API errors."""
        if result.paused:
            task.metadata.status = "paused"
            task.metadata.assignee = None
            print(
                f"  [{task.id[:8]}] ⏸ paused: {result.error}",
                file=sys.stderr,
            )

    def _make_deliver_to_parent(self, task: Ticket) -> Callable[[dict[str, Any]], None] | None:
        """Create a callback that delivers an update to this task's parent."""
        parent_id = task.metadata.parent_task_id
        if not parent_id:
            return None

        def deliver(update: dict[str, Any]) -> None:
            self._deliver_context_update(parent_id, update)

        return deliver

    def _make_on_event(self, task_id: str):
        """Create an event callback wired to the task-event hook."""
        hook = self._on_task_event

        async def on_event(event: dict[str, Any]):
            if hook:
                await hook(task_id, event)

        return on_event
