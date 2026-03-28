# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Scheduler — unified ticket lifecycle and orchestration.

Owns the decisions of *what runs when* and the metadata bookkeeping
around each ticket's execution.  Consumers (server, CLI) plug in
behaviour via ``SchedulerHooks``.

The Concept of a Cycle
----------------------

A **Cycle** is a single wave of dependency-aware ticket execution. The
system operates by repeatedly evaluating ticket dependencies and firing all
unblocked work simultaneously:

1. **Promote**: The scheduler checks all ``blocked`` tickets. If their
   dependencies are resolved (``completed``), it promotes them to ``available``.
2. **Collect**: It gathers all runnable work:
   - New ``available`` tickets.
   - ``suspended`` tickets that have been responded to by a user and are
     ready for the agent to resume.
3. **Execute (Wave)**: All collected tickets are fired concurrently (either
   gathered in batch mode, or spawned as tasks in server mode).
4. **Settle**: Active tickets run until they reach a resting state:
   - ``completed`` or ``failed`` (resolved).
   - ``suspended`` (waiting for user input).
5. **Trigger**: When work settles, the scheduler wakes up to evaluate the
   next cycle. If previous tickets unblocked new ones, the loop continues.
   If no work remains, it goes idle (server) or finishes (CLI).

This "wave orchestration" ensures that independent tickets (e.g., three
separate search queries for children of a root task) can execute in parallel,
while sequential dependencies are strictly preserved without blocking the system.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import httpx

from bees.session import (
    SessionResult,
    clear_session_state,
    extract_files,
    load_gemini_key,
    resume_session,
    run_session,
)
from bees.ticket import (
    Ticket,
    _DEP_PATTERN,
    list_tickets,
    load_ticket,
)
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifecycle hooks
# ---------------------------------------------------------------------------


@dataclass
class SchedulerHooks:
    """Optional callbacks that consumers register to react to scheduler events.
    """

    on_startup: Callable[[list[Ticket]], Awaitable[None]] | None = None
    """Called once after recovery, with the full ticket list."""

    on_cycle_start: Callable[[int, int, int], Awaitable[None]] | None = None
    """Called at the start of each cycle.

    Arguments passed to the callback:
    - cycle_number: The sequence number of the current cycle (1-based).
    - available_count: The number of new ('available') tickets being processed.
    - resumable_count: The number of suspended tickets being resumed.
    """

    on_ticket_event: Callable[[str, dict], Awaitable[None]] | None = None
    """Called when a running session emits an event (ticket_id, event_dict)."""

    on_ticket_done: Callable[[Ticket], Awaitable[None]] | None = None
    """Called when a ticket reaches a resting state (completed/failed/suspended)."""

    on_playbook_run: Callable[[list[Ticket]], None] | None = None
    """Called when an agent invokes the playbook function mid-session."""

    on_playbook_complete: Callable[[str, list[Ticket], Ticket], Awaitable[None]] | None = None
    """Called when all tickets in a playbook run are complete. (run_id, siblings, triggering_ticket)"""

    on_cycle_complete: Callable[[int], Awaitable[None]] | None = None
    """Called when there is no more work (total_cycles)."""


# ---------------------------------------------------------------------------
# Segment resolution (pure data transform)
# ---------------------------------------------------------------------------


def resolve_segments(ticket: Ticket) -> list[dict[str, Any]]:
    """Build segments from a ticket's objective, resolving {{id}} references.

    Text around ``{{id}}`` becomes text segments.  Each ``{{id}}``
    becomes an ``input`` segment carrying the dependency's outcome as
    LLMContent.

    If the ticket has ``context`` (a playbook briefing), it is prepended
    as a text segment so the agent sees the context before the objective.
    """
    objective = ticket.objective
    deps = ticket.metadata.depends_on or []

    # Build a lookup from dep ID to resolved outcome.
    dep_outcomes: dict[str, dict[str, Any]] = {}
    for dep_id in deps:
        dep = load_ticket(dep_id)
        if dep and dep.metadata.outcome_content:
            dep_outcomes[dep_id] = dep.metadata.outcome_content

    # Split objective on {{...}} boundaries.
    parts = _DEP_PATTERN.split(objective)
    segments: list[dict[str, Any]] = []

    # Prepend playbook context as a briefing segment.
    if ticket.metadata.context:
        segments.append({
            "type": "text",
            "text": (
                "--- Playbook Context ---\n"
                f"{ticket.metadata.context}\n"
                "--- End Context ---\n\n"
            ),
        })

    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Text between refs.
            if part:
                segments.append({"type": "text", "text": part})
        else:
            # This is a captured ref — resolve to input segment.
            resolved_id = _find_dep_id(part, deps)
            if resolved_id and resolved_id in dep_outcomes:
                segments.append({
                    "type": "input",
                    "title": f"ticket-{resolved_id[:8]}",
                    "content": dep_outcomes[resolved_id],
                })
            else:
                # Fallback: just include as text.
                segments.append({
                    "type": "text",
                    "text": f"(output of ticket {part})",
                })

    return segments


def _find_dep_id(ref: str, dep_ids: list[str]) -> str | None:
    """Match a ref (prefix or full UUID) against resolved dep IDs."""
    for dep_id in dep_ids:
        if dep_id == ref or dep_id.startswith(ref):
            return dep_id
    return None


# ---------------------------------------------------------------------------
# Dependency promotion
# ---------------------------------------------------------------------------


def promote_blocked_tickets() -> int:
    """Check blocked tickets and promote those whose deps are met.

    Returns the number of tickets promoted.
    """
    blocked = list_tickets(status="blocked")
    promoted = 0

    for ticket in blocked:
        deps = ticket.metadata.depends_on or []
        all_met = True
        any_failed = False

        for dep_id in deps:
            dep = load_ticket(dep_id)
            if dep is None:
                all_met = False
                continue
            if dep.metadata.status == "completed":
                continue
            if dep.metadata.status == "failed":
                any_failed = True
                break
            all_met = False

        if any_failed:
            ticket.metadata.status = "failed"
            ticket.metadata.error = "Dependency failed"
            ticket.save_metadata()
            continue

        if all_met:
            ticket.metadata.status = "available"
            ticket.save_metadata()
            promoted += 1

    return promoted


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------


class Scheduler:
    """Ticket lifecycle manager and orchestrator.

    Owns:
    - Running and resuming individual tickets (metadata bookkeeping).
    - Cycle orchestration (promote → collect → fire → repeat).
    - A trigger-based background loop for the server.
    - Recovery of stuck tickets on startup.

    Does *not* own any application-specific behaviour — that plugs in
    via ``SchedulerHooks``.
    """

    def __init__(
        self,
        *,
        http: httpx.AsyncClient,
        backend: HttpBackendClient,
        hooks: SchedulerHooks | None = None,
    ) -> None:
        self._http = http
        self._backend = backend
        self._hooks = hooks or SchedulerHooks()
        self._trigger = asyncio.Event()
        self._running = False
        self._running_tickets: set[str] = set()

    # -- public API --------------------------------------------------------

    def trigger(self) -> None:
        """Wake the scheduler loop."""
        self._trigger.set()

    async def start_loop(self) -> None:
        """Background loop that runs cycles whenever triggered."""
        while True:
            await self._trigger.wait()
            self._trigger.clear()

            if self._running:
                continue

            self._running = True
            try:
                await self._run_cycles()
            except Exception as exc:
                logger.exception("Scheduler error: %s", exc)
            finally:
                self._running = False

    async def recover_stuck_tickets(self) -> list[Ticket]:
        """Flip any ``running`` tickets back to ``available``.

        Returns the full ticket list (for ``on_startup``).
        """
        tickets = list_tickets()
        for t in tickets:
            if t.metadata.status == "running":
                t.metadata.status = "available"
                t.save_metadata()
                logger.info("Recovered stuck running ticket: %s", t.id)
        return tickets

    async def run_all_waves(self) -> list[dict]:
        """Batch mode: run cycles until no work remains.

        Used by the CLI drain.  Runs tickets via ``asyncio.gather``
        (all-at-once per cycle) and collects summaries.
        """
        all_summaries: list[dict] = []
        cycle = 0

        while True:
            promote_blocked_tickets()

            tickets = list_tickets(status="available")
            resumable = [
                t for t in list_tickets(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not tickets and not resumable:
                if cycle == 0:
                    blocked = list_tickets(status="blocked")
                    if blocked:
                        print(
                            f"No runnable tickets. "
                            f"{len(blocked)} blocked ticket(s) remain.",
                            file=sys.stderr,
                        )
                    else:
                        print(
                            "No available or resumable tickets.",
                            file=sys.stderr,
                        )
                break

            cycle += 1
            total = len(tickets) + len(resumable)

            if self._hooks.on_cycle_start:
                await self._hooks.on_cycle_start(cycle, len(tickets), len(resumable))

            print(
                f"Cycle {cycle}: {len(tickets)} new + {len(resumable)} "
                f"resumable = {total} ticket(s)...",
                file=sys.stderr,
            )

            tasks = [
                self.run_ticket(ticket)
                for ticket in tickets
            ] + [
                self.resume_ticket(ticket)
                for ticket in resumable
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_tickets_in_cycle = tickets + resumable
            for ticket, result in zip(all_tickets_in_cycle, results):
                if isinstance(result, Exception):
                    all_summaries.append({
                        "ticket": ticket.id,
                        "status": "failed",
                        "error": str(result),
                    })
                else:
                    all_summaries.append({
                        "ticket": ticket.id,
                        "status": result.status,
                        "events": result.events,
                        "output": result.output,
                    })

        if self._hooks.on_cycle_complete:
            await self._hooks.on_cycle_complete(cycle)

        return all_summaries

    # -- ticket lifecycle --------------------------------------------------

    async def run_ticket(
        self,
        ticket: Ticket,
    ) -> SessionResult:
        """Run a single ticket's session and update its metadata."""
        ticket.metadata.status = "running"
        ticket.save_metadata()

        label = ticket.id[:8]
        print(f"▶ [{label}] {ticket.objective!r}", file=sys.stderr)

        try:
            segments = resolve_segments(ticket)
            result = await run_session(
                segments=segments,
                http=self._http,
                backend=self._backend,
                label=label,
                ticket_id=ticket.id,
                ticket_dir=ticket.dir,
                on_event=self._make_on_event(ticket.id),
                function_filter=ticket.metadata.functions,
                allowed_skills=ticket.metadata.skills,
                model=ticket.metadata.model,
                on_playbook_run=self._hooks.on_playbook_run,
            )
        except Exception as exc:
            ticket.metadata.status = "failed"
            ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            ticket.metadata.error = str(exc)
            ticket.save_metadata()
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )

        self._update_metadata(ticket, result)
        self._handle_suspend(ticket, result)
        ticket.save_metadata()
        return result

    async def resume_ticket(
        self,
        ticket: Ticket,
    ) -> SessionResult:
        """Resume a suspended ticket with the user's response."""
        label = ticket.id[:8]
        print(f"▶ [{label}] resuming {ticket.objective!r}", file=sys.stderr)

        # Load the user's response.
        response_path = ticket.dir / "response.json"
        if not response_path.exists():
            ticket.metadata.status = "failed"
            ticket.metadata.error = "No response.json found for resume"
            ticket.save_metadata()
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error="No response found",
            )

        response = json.loads(response_path.read_text())

        ticket.metadata.status = "running"
        ticket.metadata.assignee = "agent"
        ticket.save_metadata()

        try:
            result = await resume_session(
                ticket_id=ticket.id,
                ticket_dir=ticket.dir,
                response=response,
                http=self._http,
                backend=self._backend,
                label=label,
                on_event=self._make_on_event(ticket.id),
                on_playbook_run=self._hooks.on_playbook_run,
            )
        except Exception as exc:
            ticket.metadata.status = "failed"
            ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            ticket.metadata.error = str(exc)
            ticket.save_metadata()
            print(f"  [{label}] ❌ {exc}", file=sys.stderr)
            return SessionResult(
                session_id="",
                status="failed",
                events=0,
                output="",
                error=str(exc),
            )

        self._update_metadata(ticket, result, accumulate=True)
        self._handle_suspend(ticket, result)

        if not result.suspended:
            clear_session_state(ticket.dir)
            # Clean up response file.
            response_path.unlink(missing_ok=True)

        ticket.save_metadata()
        return result

    # -- internal ----------------------------------------------------------

    def _update_metadata(
        self,
        ticket: Ticket,
        result: SessionResult,
        *,
        accumulate: bool = False,
    ) -> None:
        """Update ticket metadata from a session result.

        When ``accumulate`` is True (used on resume), turns and thoughts
        are added to the existing values rather than replaced.
        """
        ticket.metadata.status = (
            "completed" if result.status == "completed" else "failed"
        )
        ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()

        if accumulate:
            ticket.metadata.turns += result.turns
            ticket.metadata.thoughts += result.thoughts
        else:
            ticket.metadata.turns = result.turns
            ticket.metadata.thoughts = result.thoughts

        if result.error:
            ticket.metadata.error = result.error
        if result.outcome:
            ticket.metadata.outcome = result.outcome
        if result.outcome_content:
            ticket.metadata.outcome_content = result.outcome_content

        # Extract agent file system to ticket directory.
        file_manifest = extract_files(
            result.intermediate, ticket.dir / "filesystem",
        )
        if file_manifest:
            ticket.metadata.files = file_manifest

    def _handle_suspend(self, ticket: Ticket, result: SessionResult) -> None:
        """Handle suspend state, including pending-notification auto-resume."""
        if result.suspended:
            if getattr(ticket.metadata, "pending_notifications", None):
                notification = ticket.metadata.pending_notifications.pop(0)
                response_path = ticket.dir / "response.json"
                response_path.write_text(
                    json.dumps({"context_updates": [notification]}, indent=2, ensure_ascii=False) + "\n"
                )
                ticket.metadata.status = "suspended"
                ticket.metadata.assignee = "agent"
                ticket.metadata.suspend_event = result.suspend_event
                print(f"  [{ticket.id[:8]}] 📩 auto-resume with queued notification", file=sys.stderr)
            else:
                ticket.metadata.status = "suspended"
                ticket.metadata.assignee = "user"
                ticket.metadata.suspend_event = result.suspend_event
        else:
            ticket.metadata.assignee = None
            ticket.metadata.suspend_event = None

    def _make_on_event(self, ticket_id: str):
        """Create an event callback wired to the ticket-event hook."""
        hook = self._hooks.on_ticket_event

        async def on_event(event: dict[str, Any]):
            if hook:
                await hook(ticket_id, event)

        return on_event

    async def _check_playbook_completion_internal(self, ticket: Ticket) -> None:
        """Check if all tickets in a playbook run are done, and fire hook if so."""
        run_id = ticket.metadata.playbook_run_id
        if not run_id:
            return

        siblings = [
            t for t in list_tickets()
            if t.metadata.playbook_run_id == run_id
        ]
        if not siblings:
            return

        terminal = {"completed", "failed"}
        all_done = all(t.metadata.status in terminal for t in siblings)
        if not all_done:
            return

        if self._hooks.on_playbook_complete:
            await self._hooks.on_playbook_complete(run_id, siblings, ticket)

    async def _run_cycles(self) -> None:
        """Run cycles until no more work is available (server mode).

        Unlike ``run_all_waves`` (batch gather), this fires each ticket
        as an independent ``asyncio.Task`` for concurrent execution.
        """
        cycle = 0

        while True:
            promote_blocked_tickets()

            tickets = list_tickets(status="available")
            resumable = [
                t for t in list_tickets(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not tickets and not resumable:
                break

            cycle += 1

            if self._hooks.on_cycle_start:
                await self._hooks.on_cycle_start(
                    cycle, len(tickets), len(resumable),
                )

            for ticket in tickets:
                if ticket.id in self._running_tickets:
                    continue
                self._running_tickets.add(ticket.id)

                async def wrap_run(t=ticket):
                    try:
                        await self.run_ticket(t)
                    finally:
                        self._running_tickets.discard(t.id)
                        updated = load_ticket(t.id) or t
                        if self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(updated)
                        await self._check_playbook_completion_internal(updated)
                        self.trigger()

                asyncio.create_task(wrap_run())

            for ticket in resumable:
                if ticket.id in self._running_tickets:
                    continue
                self._running_tickets.add(ticket.id)

                async def wrap_resume(t=ticket):
                    try:
                        await self.resume_ticket(t)
                    finally:
                        self._running_tickets.discard(t.id)
                        updated = load_ticket(t.id) or t
                        if self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(updated)
                        await self._check_playbook_completion_internal(updated)
                        self.trigger()

                asyncio.create_task(wrap_resume())

            await asyncio.sleep(1)

        if self._hooks.on_cycle_complete:
            await self._hooks.on_cycle_complete(cycle)
