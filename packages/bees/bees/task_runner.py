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
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from bees.agent import Agent

from bees.context_updates import updates_to_context_parts
from bees.protocols.events import (
    EventEmitter,
    TaskEvent,
    TaskStarted,
)
from bees.protocols.session import SessionResult, SessionRunner, SessionStream
from bees.provisioner import provision_session
from bees.segments import resolve_segments
from bees.session import (
    append_chat_log,
    drain_session,
    extract_files,
)
from opal_backend.sessions.file_store import FileBasedSessionStore
from bees.subagent_scope import SubagentScope

from bees.unified_agent_store import UnifiedAgentStore

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
        runners: dict[str, SessionRunner],
        store: UnifiedAgentStore,
        scheduler_ref: Any,
        active_streams: dict[str, SessionStream],
        get_mcp_factories: Callable[[], list | None],
        deliver_context_update: Callable[[str, dict[str, Any]], None],
        on_events_broadcast: Callable[[Agent], None],
        emit: EventEmitter,
    ) -> None:
        self._runners = runners
        self._store = store
        self._scheduler_ref = scheduler_ref
        self._active_streams = active_streams
        self._get_mcp_factories = get_mcp_factories
        self._deliver_context_update = deliver_context_update
        self._on_events_broadcast = on_events_broadcast
        self._emit = emit

    # -- public API --------------------------------------------------------

    async def run_task(
        self,
        agent: Agent,
    ) -> SessionResult:
        """Run a single task's session and update its metadata."""
        # Reload title from disk — it may have been renamed by an on_event
        # hook during coordination routing earlier in this cycle, while the
        # in-memory agent object (from list_tickets) still has the old value.
        fresh = self._store.get(agent.id)
        if fresh and fresh.metadata.title != agent.metadata.title:
            agent.metadata.title = fresh.metadata.title

        # Set active_session on first run
        if agent.metadata.active_session is None:
            agent.metadata.active_session = str(uuid.uuid4())

        agent.metadata.status = "running"
        self._store.save_metadata(agent)
        await self._emit(TaskStarted(task=agent))

        label = agent.id[:8]
        print(f"▶ [{label}] {agent.objective!r}", file=sys.stderr)

        try:
            segments = resolve_segments(agent, self._store)
            scope = SubagentScope.for_agent(agent)
            config = provision_session(
                segments=segments,
                ticket_id=agent.id,
                ticket_dir=agent.dir,
                fs_dir=agent.fs_dir,
                session_id=agent.metadata.active_session,
                function_filter=agent.metadata.functions,
                allowed_skills=agent.metadata.skills,
                model=agent.metadata.model,
                on_events_broadcast=self._on_events_broadcast,
                deliver_to_parent=self._make_deliver_to_parent(agent),
                scope=scope,
                scheduler=self._scheduler_ref,
                mcp_factories=self._get_mcp_factories(),
                on_chat_entry=lambda role, text: append_chat_log(
                    agent.dir, role, text,
                ),
                voice=agent.metadata.voice,
            )

            # Antigravity bypasses opal's _tee_events, so drain_session
            # must persist events to events.jsonl itself.
            if agent.metadata.runner == "antigravity":
                config.persist_events = True

            # Live sessions need context-level chat extraction because
            # they lack function-level chat handlers.
            if agent.metadata.runner == "live":
                config.extract_chat_from_context = True

            stream = await self._runner_for(agent).run(config)
            self._active_streams[agent.id] = stream
            try:
                result = await drain_session(
                    stream,
                    config=config,
                    ticket_id=agent.id,
                    on_event=self._make_on_event(agent.id),
                )
                # Persist runner-agnostic resume state when suspended.
                self._persist_resume_state(agent, stream, result)
            finally:
                self._active_streams.pop(agent.id, None)

        except Exception as exc:
            agent.metadata.status = "failed"
            agent.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            agent.metadata.error = str(exc)
            self._store.save_metadata(agent)
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )

        self._update_metadata(agent, result)
        self._handle_suspend(agent, result)
        self._handle_pause(agent, result)
        self._store.save_metadata(agent)
        return result

    async def resume_task(
        self,
        agent: Agent,
    ) -> SessionResult:
        """Resume a suspended task with the user's response."""
        label = agent.id[:8]
        print(f"▶ [{label}] resuming {agent.objective!r}", file=sys.stderr)

        # Load the user's response.
        response_path = agent.dir / "response.json"
        if not response_path.exists():
            agent.metadata.status = "failed"
            agent.metadata.error = "No response.json found for resume"
            self._store.save_metadata(agent)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error="No response found",
            )

        response = json.loads(response_path.read_text())

        # Log user's reply to the chat log.
        # Read from structured "input" (text) or "selected" (choice) response payload formats.
        user_text = ""
        llm_content = response.get("input")
        if isinstance(llm_content, dict):
            parts = llm_content.get("parts", [])
            user_text = next((p.get("text", "") for p in parts if "text" in p), "")
        
        selected_obj = response.get("selected")
        selected_ids = []
        if isinstance(selected_obj, dict) and "ids" in selected_obj:
            selected_ids = selected_obj["ids"]

        if user_text:
            append_chat_log(agent.dir, "user", user_text)
        elif selected_ids:
            append_chat_log(agent.dir, "user", ", ".join(selected_ids))

        # Dynamic inline migration for legacy tasks
        if agent.metadata.active_session is None:
            state_path = agent.dir / "session_state.json"
            if not state_path.exists():
                agent.metadata.status = "failed"
                agent.metadata.error = "No saved session state or active session found"
                self._store.save_metadata(agent)
                return SessionResult(
                    session_id="",
                    status="failed",
                    events=0,
                    output="",
                    error="No saved session state found",
                )
            try:
                state_bytes = state_path.read_bytes()
                state_data = json.loads(state_bytes.decode("utf-8"))
                session_id = state_data["session_id"]
                interaction_id = state_data["interaction_id"]
                interaction_state = state_data["interaction_state"]

                logger.info("Migrating legacy task %s to session-specific path...", agent.id[:8])

                # Initialize session directory
                sdir = agent.dir / "sessions" / session_id
                sdir.mkdir(parents=True, exist_ok=True)

                # Write status, resume_id, interaction.json
                (sdir / "status").write_text("suspended", encoding="utf-8")
                (sdir / "resume_id").write_text(interaction_id, encoding="utf-8")
                (sdir / "interaction.json").write_text(
                    json.dumps(interaction_state, ensure_ascii=False, indent=2),
                    encoding="utf-8"
                )

                # Migrate filesystem workspace
                legacy_fs = agent.dir / "filesystem"
                if legacy_fs.exists():
                    new_ws = sdir / "workspace"
                    new_ws.parent.mkdir(parents=True, exist_ok=True)
                    legacy_fs.rename(new_ws)

                # Update agent metadata
                agent.metadata.active_session = session_id
                self._store.save_metadata(agent)

                # Clean up legacy file
                state_path.unlink(missing_ok=True)
                state = state_bytes
            except Exception as e:
                agent.metadata.status = "failed"
                agent.metadata.error = f"Migration failed: {e}"
                self._store.save_metadata(agent)
                return SessionResult(
                    session_id="",
                    status="failed",
                    events=0,
                    output="",
                    error=f"Migration failed: {e}",
                )
        else:
            # Load and construct state bytes dynamically from the persistent session store
            session_id = agent.metadata.active_session
            sdir = agent.dir / "sessions" / session_id
            resume_id_file = sdir / "resume_id"
            int_file = sdir / "interaction.json"

            if not resume_id_file.exists() or not int_file.exists():
                # Check for runner-agnostic resume state file.
                resume_state_file = sdir / "resume_state.json"
                if resume_state_file.exists():
                    state = resume_state_file.read_bytes()
                else:
                    agent.metadata.status = "failed"
                    agent.metadata.error = "No active resume session files found"
                    self._store.save_metadata(agent)
                    return SessionResult(
                        session_id="",
                        status="failed",
                        events=0,
                        output="",
                        error="No active resume session files found",
                    )
            else:
                try:
                    interaction_id = resume_id_file.read_text(encoding="utf-8").strip()
                    int_data = json.loads(int_file.read_text(encoding="utf-8"))
                    state_dict = {
                        "session_id": session_id,
                        "interaction_id": interaction_id,
                        "interaction_state": int_data,
                    }
                    state = json.dumps(state_dict, ensure_ascii=False).encode("utf-8")
                except Exception as e:
                    agent.metadata.status = "failed"
                    agent.metadata.error = f"Failed to load session files: {e}"
                    self._store.save_metadata(agent)
                    return SessionResult(
                        session_id="",
                        status="failed",
                        events=0,
                        output="",
                        error=f"Failed to load session files: {e}",
                    )

        agent.metadata.status = "running"
        agent.metadata.assignee = "agent"
        self._store.save_metadata(agent)
        await self._emit(TaskStarted(task=agent))

        try:
            # Assemble context updates from both sources:
            #   1. response.json may contain context_updates (from delivery)
            #   2. agent metadata may have pending_context_updates (buffered)
            all_updates: list = []
            response_updates = response.pop("context_updates", None)
            if response_updates:
                all_updates.extend(response_updates)

            if agent.metadata.pending_context_updates:
                all_updates.extend(agent.metadata.pending_context_updates)
                agent.metadata.pending_context_updates = []
                self._store.save_metadata(agent)

            context_parts = (
                updates_to_context_parts(all_updates)
                if all_updates
                else None
            )

            scope = SubagentScope.for_agent(agent)
            config = provision_session(
                segments=[],  # Not used for resume.
                ticket_id=agent.id,
                ticket_dir=agent.dir,
                fs_dir=agent.fs_dir,
                session_id=agent.metadata.active_session,
                function_filter=agent.metadata.functions,
                allowed_skills=agent.metadata.skills,
                on_events_broadcast=self._on_events_broadcast,
                deliver_to_parent=self._make_deliver_to_parent(agent),
                scope=scope,
                scheduler=self._scheduler_ref,
                mcp_factories=self._get_mcp_factories(),
                on_chat_entry=lambda role, text: append_chat_log(
                    agent.dir, role, text,
                ),
                seed_files=False,  # Files already on disk from previous run.
                voice=agent.metadata.voice,
            )

            # Antigravity bypasses opal's _tee_events, so drain_session
            # must persist events to events.jsonl itself.
            if agent.metadata.runner == "antigravity":
                config.persist_events = True

            # Live sessions need context-level chat extraction because
            # they lack function-level chat handlers.
            if agent.metadata.runner == "live":
                config.extract_chat_from_context = True

            stream = await self._runner_for(agent).resume(
                config,
                state=state,
                response=response,
                context_parts=context_parts,
            )
            self._active_streams[agent.id] = stream
            try:
                result = await drain_session(
                    stream,
                    config=config,
                    ticket_id=agent.id,
                    on_event=self._make_on_event(agent.id),
                )
                # Persist runner-agnostic resume state when re-suspended.
                self._persist_resume_state(agent, stream, result)
            finally:
                self._active_streams.pop(agent.id, None)

            # Clean up response file.
            response_path.unlink(missing_ok=True)
        except Exception as exc:
            agent.metadata.status = "failed"
            agent.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            agent.metadata.error = str(exc)
            self._store.save_metadata(agent)
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )

        self._update_metadata(agent, result, accumulate=True)
        self._handle_suspend(agent, result)
        self._handle_pause(agent, result)

        # Clean up stale suspend artifacts after a successful resume.
        # When a session suspends, the runner writes interaction.json and
        # resume_id to the session directory. If the resumed session
        # completes normally (not re-suspended), these files are stale —
        # but they were never cleaned up, causing hivetool to show a
        # phantom "Suspended On" indicator.
        if not result.suspended and agent.metadata.active_session:
            sdir = agent.dir / "sessions" / agent.metadata.active_session
            for stale_file in ("interaction.json", "resume_id", "resume_state.json"):
                (sdir / stale_file).unlink(missing_ok=True)

        self._store.save_metadata(agent)
        return result

    # -- internal ----------------------------------------------------------

    def _persist_resume_state(
        self,
        agent: Agent,
        stream: Any,
        result: SessionResult,
    ) -> None:
        """Persist runner-agnostic resume state when a session suspends.

        Writes ``stream.resume_state()`` bytes to a ``resume_state.json``
        file in the session directory.  This is the runner-agnostic path
        that ``resume_task()`` prefers over the legacy opal-specific
        ``resume_id`` + ``interaction.json`` files.
        """
        if not result.suspended:
            return
        resume_blob = stream.resume_state()
        if resume_blob is None:
            return
        session_id = agent.metadata.active_session
        if not session_id or not agent.dir:
            return
        sdir = agent.dir / "sessions" / session_id
        sdir.mkdir(parents=True, exist_ok=True)
        (sdir / "resume_state.json").write_bytes(resume_blob)


    def _update_metadata(
        self,
        agent: Agent,
        result: SessionResult,
        *,
        accumulate: bool = False,
    ) -> None:
        """Update agent metadata from a session result.

        When ``accumulate`` is True (used on resume), turns and thoughts
        are added to the existing values rather than replaced.
        """
        agent.metadata.completed_at = datetime.now(timezone.utc).isoformat()

        if result.status == "completed":
            agent.metadata.status = "completed"
        elif result.paused:
            # Transient Gemini error — don't set completed_at, the task
            # is not done.  Status is set by _handle_pause below.
            agent.metadata.completed_at = None
        else:
            agent.metadata.status = "failed"

        if accumulate:
            agent.metadata.turns += result.turns
            agent.metadata.thoughts += result.thoughts
        else:
            agent.metadata.turns = result.turns
            agent.metadata.thoughts = result.thoughts

        if result.error:
            agent.metadata.error = result.error
        if result.outcome:
            agent.metadata.outcome = result.outcome
        if result.outcome_content:
            agent.metadata.outcome_content = result.outcome_content

        # Extract agent file system to task directory.
        file_manifest = extract_files(
            result.intermediate, agent.fs_dir,
        )
        if file_manifest:
            agent.metadata.files = file_manifest

    def _handle_suspend(self, agent: Agent, result: SessionResult) -> None:
        """Handle suspend state, including queued-update auto-resume."""
        if result.suspended:
            # Reload fields that may have been modified externally while
            # the session was running (e.g., by on_event hooks or
            # coordination delivery).  The in-memory agent object is
            # stale for these fields.
            fresh = self._store.get(agent.id)
            if fresh:
                if fresh.metadata.queued_updates:
                    agent.metadata.queued_updates = fresh.metadata.queued_updates
                if fresh.metadata.pending_context_updates:
                    agent.metadata.pending_context_updates = fresh.metadata.pending_context_updates
                if fresh.metadata.title != agent.metadata.title:
                    agent.metadata.title = fresh.metadata.title

            # function_name is already in suspend_event — enriched by
            # the runner before yielding.
            suspend_event = dict(result.suspend_event) if result.suspend_event else {}

            if getattr(agent.metadata, "pending_context_updates", None):
                updates = list(agent.metadata.pending_context_updates)
                agent.metadata.pending_context_updates = []
                response_path = agent.dir / "response.json"
                response_path.write_text(
                    json.dumps({"context_updates": updates}, indent=2, ensure_ascii=False) + "\n"
                )
                agent.metadata.status = "suspended"
                agent.metadata.assignee = "agent"
                agent.metadata.suspend_event = suspend_event
                print(f"  [{agent.id[:8]}] 📩 auto-resume with buffered context updates", file=sys.stderr)
            elif getattr(agent.metadata, "queued_updates", None):
                update = agent.metadata.queued_updates.pop(0)
                response_path = agent.dir / "response.json"
                response_path.write_text(
                    json.dumps({"context_updates": [update]}, indent=2, ensure_ascii=False) + "\n"
                )
                agent.metadata.status = "suspended"
                agent.metadata.assignee = "agent"
                agent.metadata.suspend_event = suspend_event
                print(f"  [{agent.id[:8]}] 📩 auto-resume with queued update", file=sys.stderr)
            elif self._drain_queued_task(agent, suspend_event):
                # Persistent task queue had a waiting task — auto-resume.
                pass
            else:
                agent.metadata.status = "suspended"
                agent.metadata.assignee = "user"
                agent.metadata.suspend_event = suspend_event
        else:
            agent.metadata.assignee = None
            agent.metadata.suspend_event = None

    def _drain_queued_task(
        self, agent: Agent, suspend_event: dict[str, Any],
    ) -> bool:
        """Check the persistent task queue for the next queued task.

        If a queued task exists, dequeues it, writes a context update
        to ``response.json``, and sets the agent to auto-resume.

        Returns True if a task was dequeued (agent will auto-resume),
        False otherwise.
        """
        task_file_store = getattr(self._store, '_task_file_store', None)
        if not task_file_store:
            return False

        next_task = task_file_store.dequeue_next(agent.id)
        if not next_task:
            return False

        task_update = {
            "type": "task_assigned",
            "objective": next_task.objective,
        }
        response_path = agent.dir / "response.json"
        response_path.write_text(
            json.dumps(
                {"context_updates": [task_update]},
                indent=2, ensure_ascii=False,
            ) + "\n"
        )
        agent.metadata.status = "suspended"
        agent.metadata.assignee = "agent"
        agent.metadata.suspend_event = suspend_event
        print(
            f"  [{agent.id[:8]}] 📩 auto-resume with queued task {next_task.id[:8]}",
            file=sys.stderr,
        )
        return True

    def _handle_pause(self, agent: Agent, result: SessionResult) -> None:
        """Handle pause state from transient Gemini API errors."""
        if result.paused:
            agent.metadata.status = "paused"
            agent.metadata.assignee = None
            print(
                f"  [{agent.id[:8]}] ⏸ paused: {result.error}",
                file=sys.stderr,
            )

    def _make_deliver_to_parent(self, agent: Agent) -> Callable[[dict[str, Any]], None] | None:
        """Create a callback that delivers an update to this agent's parent."""
        parent_id = agent.metadata.parent_id
        if not parent_id:
            return None

        def deliver(update: dict[str, Any]) -> None:
            self._deliver_context_update(parent_id, update)

        return deliver

    def _make_on_event(self, task_id: str):
        """Create an event callback wired to the emit system."""
        emit = self._emit

        async def on_event(event: dict[str, Any]):
            await emit(TaskEvent(task_id=task_id, event=event))

        return on_event

    def _runner_for(self, agent: Agent) -> SessionRunner:
        """Select the session runner for an agent based on its metadata."""
        runner_type = agent.metadata.runner
        runner = self._runners.get(runner_type)
        if runner is None:
            available = ", ".join(sorted(self._runners.keys()))
            raise ValueError(
                f"No runner registered for type {runner_type!r} "
                f"(available: {available})"
            )
        return runner
