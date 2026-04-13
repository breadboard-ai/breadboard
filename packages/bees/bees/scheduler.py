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

from bees.playbook import run_event_hooks, run_ticket_done_hooks, load_system_config, run_playbook
from bees.session import (
    SessionResult,
    append_chat_log,
    clear_session_state,
    extract_files,

    load_session_state,
    resume_session,
    run_session,
)
from bees.ticket import (
    Ticket,
    _DEP_PATTERN,
    TaskStore,
)
from bees.subagent_scope import SubagentScope
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

    on_ticket_added: Callable[[Ticket], Awaitable[None]] | None = None
    """Called when a new ticket is created."""

    on_cycle_start: Callable[[int, int, int], Awaitable[None]] | None = None
    """Called at the start of each cycle.

    Arguments passed to the callback:
    - cycle_number: The sequence number of the current cycle (1-based).
    - available_count: The number of new ('available') tickets being processed.
    - resumable_count: The number of suspended tickets being resumed.
    """

    on_ticket_event: Callable[[str, dict], Awaitable[None]] | None = None
    """Called when a running session emits an event (ticket_id, event_dict)."""

    on_ticket_start: Callable[[Ticket], Awaitable[None]] | None = None
    """Called when a ticket transitions to running (for UI updates)."""

    on_ticket_done: Callable[[Ticket], Awaitable[None]] | None = None
    """Called when a ticket reaches a resting state (completed/failed/suspended/paused)."""


    on_events_broadcast: Callable[[Ticket], None] | None = None
    """Called when an agent broadcasts an event mid-session."""



    on_cycle_complete: Callable[[int], Awaitable[None]] | None = None
    """Called when there is no more work (total_cycles)."""


# ---------------------------------------------------------------------------
# Segment resolution (pure data transform)
# ---------------------------------------------------------------------------


def resolve_segments(ticket: Ticket, store: TaskStore) -> list[dict[str, Any]]:
    """Build segments from a ticket's objective, resolving ``{{…}}`` references.

    References are resolved by namespace:

    - ``{{system.context}}`` — replaced with the ticket's context string.
    - ``{{system.ticket_id}}`` — replaced with the ticket's own ID.
    - ``{{ticket-id}}`` — replaced with the dependency's outcome as an
      ``input`` segment carrying LLMContent.

    Plain text around references becomes text segments.
    """
    objective = ticket.objective
    deps = ticket.metadata.depends_on or []
    context = ticket.metadata.context or ""

    # Build a lookup from dep ID to resolved outcome.
    dep_outcomes: dict[str, dict[str, Any]] = {}
    for dep_id in deps:
        dep = store.get(dep_id)
        if dep and dep.metadata.outcome_content:
            dep_outcomes[dep_id] = dep.metadata.outcome_content

    # Split objective on {{...}} boundaries.
    parts = _DEP_PATTERN.split(objective)
    segments: list[dict[str, Any]] = []

    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Text between refs.
            if part:
                segments.append({"type": "text", "text": part})
        else:
            # Resolve by namespace.
            if part == "system.context":
                if context:
                    segments.append({"type": "text", "text": context})
            elif part == "system.ticket_id":
                segments.append({"type": "text", "text": ticket.id})
            else:
                # Dependency ref — resolve to input segment.
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
# Event formatting (structured data → text for agent consumption)
# ---------------------------------------------------------------------------




# ---------------------------------------------------------------------------
# Dependency promotion
# ---------------------------------------------------------------------------


def promote_blocked_tickets(store: TaskStore) -> int:
    """Check blocked tickets and promote those whose deps are met.

    Returns the number of tickets promoted.
    """
    blocked = store.query_all(status="blocked")
    promoted = 0

    for ticket in blocked:
        deps = ticket.metadata.depends_on or []
        all_met = True
        any_failed = False

        for dep_id in deps:
            dep = store.get(dep_id)
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
        store: TaskStore,
        hooks: SchedulerHooks | None = None,
    ) -> None:
        self._http = http
        self._backend = backend
        self._hooks = hooks or SchedulerHooks()
        self.store = store
        self._trigger = asyncio.Event()
        self._running = False
        self._running_tickets: set[str] = set()
        self._completion_events: dict[str, asyncio.Event] = {}
        self._active_tasks: dict[str, asyncio.Task] = {}
        self._context_queues: dict[str, asyncio.Queue] = {}

    # -- public API --------------------------------------------------------

    def trigger(self) -> None:
        """Wake the scheduler loop."""
        self._trigger.set()

    async def startup(self) -> Ticket | None:
        """Recover stuck tickets, boot root template if needed, and fire startup hook."""
        tickets = await self.recover_stuck_tickets()
        
        root_ticket = await self._boot_root_template(tickets)
        if root_ticket:
            tickets.append(root_ticket)
            
        if self._hooks.on_startup:
            await self._hooks.on_startup(tickets)
            
        return root_ticket

    async def create_task(self, objective: str, **kwargs) -> Ticket:
        """Create a new task and notify hooks."""
        ticket = self.store.create(objective, **kwargs)
        
        if self._hooks.on_ticket_added:
            await self._hooks.on_ticket_added(ticket)
            
        self.trigger()
        return ticket

    async def _boot_root_template(self, tickets: list[Ticket]) -> Ticket | None:
        """Boot the root template if it isn't already running."""
        config = load_system_config(self.store.hive_dir / "config")
        root = config.get("root")
        if not root:
            return None

        already_booted = any(
            t.metadata.playbook_id == root for t in tickets
        )
        if already_booted:
            return None

        logger.info("Booting root template '%s'", root)
        ticket = run_playbook(root, store=self.store)
        
        if self._hooks.on_ticket_added:
            await self._hooks.on_ticket_added(ticket)
            
        return ticket

    async def wait_for_ticket(self, ticket_id: str, timeout_ms: float) -> str:
        """Wait for a ticket to complete, fail, or suspend.

        Races an in-memory completion event against a timeout. Returns
        the ticket's status on exit.
        """
        event = self._completion_events.setdefault(ticket_id, asyncio.Event())
        
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout_ms / 1000.0)
        except asyncio.TimeoutError:
            pass
            
        fresh = self.store.get(ticket_id)
        return fresh.metadata.status if fresh else "unknown"

    def _notify_ticket_done(self, ticket_id: str) -> None:
        """Wake up anyone waiting for this ticket."""
        if ticket_id in self._completion_events:
            self._completion_events[ticket_id].set()
            del self._completion_events[ticket_id]

    def cancel_ticket(self, ticket_id: str) -> bool:
        """Cancel a running or pending ticket.
        
        Returns True if the ticket was found and cancelled, False otherwise.
        """
        cancelled = False
        
        if ticket_id in self._active_tasks:
            self._active_tasks[ticket_id].cancel()
            cancelled = True
            
        ticket = self.store.get(ticket_id)
        if ticket:
            ticket.metadata.status = "cancelled"
            ticket.save_metadata()
            cancelled = True
            
        return cancelled

    def deliver_to_ticket(
        self,
        ticket_id: str,
        update: dict[str, Any],
        *,
        expected_creator: str | None = None,
    ) -> str | None:
        """Deliver a context update to a ticket.

        Returns ``None`` on success, or an error string on failure.

        When ``expected_creator`` is provided the target ticket's
        ``creator_ticket_id`` must match — this prevents one agent from
        injecting updates into another agent's tasks.
        """
        ticket = self.store.get(ticket_id)
        if not ticket:
            return f"Task {ticket_id} not found"

        if expected_creator and ticket.metadata.creator_ticket_id != expected_creator:
            return f"Task {ticket_id} is not owned by this agent"

        self._deliver_context_update(ticket_id, update)
        return None

    def _deliver_context_update(self, target_id: str, update: dict[str, Any]) -> None:
        """Deliver, inject, or buffer a context update for a ticket.

        Three delivery paths, tried in order:
        1. **Mid-stream** — ticket is running and has a live context
           queue.  Push pre-formatted parts for injection at the next
           turn boundary.
        2. **Immediate resume** — ticket is suspended and idle.  Write
           ``response.json`` and flip assignee to trigger resume.
        3. **Buffer** — ticket is busy but has no live queue (e.g.
           batch mode).  Append to ``pending_context_updates`` in
           metadata for later drain.
        """
        from bees.context_updates import updates_to_context_parts
        import json

        # Path 1: mid-stream injection via live queue.
        queue = self._context_queues.get(target_id)
        if queue is not None:
            parts = updates_to_context_parts([update])
            queue.put_nowait(parts)
            logger.info("Context update injected mid-stream for %s", target_id)
            return

        target = self.store.get(target_id)
        if not target:
            logger.warning("Failed to load ticket %s for context update", target_id)
            return

        # Path 2: immediate resume via response.json.
        if (
            target.metadata.status == "suspended"
            and target.metadata.assignee == "user"
            and target_id not in self._running_tickets
        ):
            self.store.respond(target_id, {"context_updates": [update]})
            logger.info("Context update delivered to %s via response.json", target_id)
        else:
            # Path 3: buffer in metadata.
            if target.metadata.pending_context_updates is None:
                target.metadata.pending_context_updates = []
            target.metadata.pending_context_updates.append(update)
            target.save_metadata()
            logger.info("Context update buffered for %s", target_id)

    def _enrich_creator_tags(self, ticket: Ticket) -> Ticket | None:
        """Merge a completed ticket's tags into its creator's tags.

        Called when a subagent finishes (any terminal status).  Performs
        a deduplicated union — one level up only.

        Returns the enriched creator ticket so the caller can broadcast
        a ``ticket_update`` via SSE, or ``None`` if nothing changed.
        """
        creator_id = ticket.metadata.creator_ticket_id
        child_tags = ticket.metadata.tags
        if not creator_id or not child_tags:
            return None

        creator = self.store.get(creator_id)
        if not creator:
            logger.warning(
                "Tag enrichment: creator %s not found for %s",
                creator_id, ticket.id[:8],
            )
            return None

        existing = set(creator.metadata.tags or [])
        merged = existing | set(child_tags)
        if merged == existing:
            return None  # Nothing new.

        creator.metadata.tags = sorted(merged)
        creator.save_metadata()
        logger.info(
            "Tag enrichment: %s -> %s (added %s)",
            ticket.id[:8],
            creator_id[:8],
            sorted(merged - existing),
        )
        return creator

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
        """Flip any ``running`` or ``paused`` tickets back to ``available``.

        Returns the full ticket list (for ``on_startup``).
        """
        tickets = self.store.query_all()
        for t in tickets:
            if t.metadata.status in ("running", "paused"):
                logger.info("Recovered stuck %s ticket: %s", t.metadata.status, t.id)
                t.metadata.status = "available"
                t.save_metadata()
        return tickets

    async def run_all_waves(self) -> list[dict]:
        """Batch mode: run cycles until no work remains.

        Used by the CLI drain.  Runs tickets via ``asyncio.gather``
        (all-at-once per cycle) and collects summaries.
        """
        all_summaries: list[dict] = []
        cycle = 0

        while True:
            promote_blocked_tickets(self.store)

            all_available = self.store.query_all(status="available")

            # Route coordination tickets before processing work tickets.
            coordination = [
                t for t in all_available
                if t.metadata.kind == "coordination"
            ]
            for t in coordination:
                await self._route_coordination_ticket(t)

            tickets = [
                t for t in all_available
                if t.metadata.kind != "coordination"
            ]
            resumable = [
                t for t in self.store.query_all(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not tickets and not resumable:
                if cycle == 0:
                    blocked = self.store.query_all(status="blocked")
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
        # Reload title from disk — it may have been renamed by an on_event
        # hook during coordination routing earlier in this cycle, while the
        # in-memory ticket object (from list_tickets) still has the old value.
        fresh = self.store.get(ticket.id)
        if fresh and fresh.metadata.title != ticket.metadata.title:
            ticket.metadata.title = fresh.metadata.title

        ticket.metadata.status = "running"
        ticket.save_metadata()
        if self._hooks.on_ticket_start:
            await self._hooks.on_ticket_start(ticket)

        label = ticket.id[:8]
        print(f"▶ [{label}] {ticket.objective!r}", file=sys.stderr)

        try:
            ctx_queue: asyncio.Queue = asyncio.Queue()
            self._context_queues[ticket.id] = ctx_queue
            segments = resolve_segments(ticket, self.store)
            scope = SubagentScope.for_ticket(ticket)
            result = await run_session(
                segments=segments,
                http=self._http,
                backend=self._backend,
                label=label,
                ticket_id=ticket.id,
                ticket_dir=ticket.dir,
                fs_dir=ticket.fs_dir,
                on_event=self._make_on_event(ticket.id),
                function_filter=ticket.metadata.functions,
                allowed_skills=ticket.metadata.skills,
                model=ticket.metadata.model,
                on_events_broadcast=self._on_events_broadcast_internal,
                deliver_to_parent=self._make_deliver_to_parent(ticket),
                scope=scope,
                scheduler=self,
                context_queue=ctx_queue,
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
        finally:
            self._context_queues.pop(ticket.id, None)

        self._update_metadata(ticket, result)
        self._handle_suspend(ticket, result)
        self._handle_pause(ticket, result)
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

        # Log user's reply to the chat log (only actual user text,
        # not context-update-only responses).
        user_text = response.get("text", "")
        if user_text:
            append_chat_log(ticket.dir, "user", user_text)

        ticket.metadata.status = "running"
        ticket.metadata.assignee = "agent"
        ticket.save_metadata()
        if self._hooks.on_ticket_start:
            await self._hooks.on_ticket_start(ticket)

        try:
            scope = SubagentScope.for_ticket(ticket)
            ctx_queue: asyncio.Queue = asyncio.Queue()
            self._context_queues[ticket.id] = ctx_queue
            result = await resume_session(
                ticket_id=ticket.id,
                ticket_dir=ticket.dir,
                fs_dir=ticket.fs_dir,
                response=response,
                http=self._http,
                backend=self._backend,
                label=label,
                on_event=self._make_on_event(ticket.id),
                on_events_broadcast=self._on_events_broadcast_internal,
                deliver_to_parent=self._make_deliver_to_parent(ticket),
                scope=scope,
                scheduler=self,
                context_queue=ctx_queue,
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
        finally:
            self._context_queues.pop(ticket.id, None)

        self._update_metadata(ticket, result, accumulate=True)
        self._handle_suspend(ticket, result)
        self._handle_pause(ticket, result)

        if not result.suspended and not result.paused:
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
        ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()

        if result.status == "completed":
            ticket.metadata.status = "completed"
        elif result.paused:
            # Transient Gemini error — don't set completed_at, the ticket
            # is not done.  Status is set by _handle_pause below.
            ticket.metadata.completed_at = None
        else:
            ticket.metadata.status = "failed"

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
            result.intermediate, ticket.fs_dir,
        )
        if file_manifest:
            ticket.metadata.files = file_manifest

    def _handle_suspend(self, ticket: Ticket, result: SessionResult) -> None:
        """Handle suspend state, including queued-update auto-resume."""
        if result.suspended:
            # Reload fields that may have been modified externally while
            # the session was running (e.g., by on_event hooks or
            # coordination delivery).  The in-memory ticket object is
            # stale for these fields.
            fresh = self.store.get(ticket.id)
            if fresh:
                if fresh.metadata.queued_updates:
                    ticket.metadata.queued_updates = fresh.metadata.queued_updates
                if fresh.metadata.title != ticket.metadata.title:
                    ticket.metadata.title = fresh.metadata.title

            # Annotate suspend_event with the triggering function name
            # so the UI can differentiate (e.g., await_context_update
            # vs. request_user_input). Read from saved session state.
            suspend_event = dict(result.suspend_event) if result.suspend_event else {}
            state = load_session_state(ticket.dir)
            if state:
                fcp = state.get("interaction_state", {}).get("function_call_part", {})
                fn_name = fcp.get("functionCall", {}).get("name")
                if fn_name:
                    suspend_event["function_name"] = fn_name

            if getattr(ticket.metadata, "queued_updates", None):
                update = ticket.metadata.queued_updates.pop(0)
                response_path = ticket.dir / "response.json"
                response_path.write_text(
                    json.dumps({"context_updates": [update]}, indent=2, ensure_ascii=False) + "\n"
                )
                ticket.metadata.status = "suspended"
                ticket.metadata.assignee = "agent"
                ticket.metadata.suspend_event = suspend_event
                print(f"  [{ticket.id[:8]}] 📩 auto-resume with queued update", file=sys.stderr)
            else:
                ticket.metadata.status = "suspended"
                ticket.metadata.assignee = "user"
                ticket.metadata.suspend_event = suspend_event
        else:
            ticket.metadata.assignee = None
            ticket.metadata.suspend_event = None

    def _handle_pause(self, ticket: Ticket, result: SessionResult) -> None:
        """Handle pause state from transient Gemini API errors."""
        if result.paused:
            ticket.metadata.status = "paused"
            ticket.metadata.assignee = None
            print(
                f"  [{ticket.id[:8]}] ⏸ paused: {result.error}",
                file=sys.stderr,
            )


    def _on_events_broadcast_internal(self, ticket: Ticket) -> None:
        if self._hooks.on_events_broadcast:
            self._hooks.on_events_broadcast(ticket)
        if self._hooks.on_ticket_added:
            asyncio.create_task(self._hooks.on_ticket_added(ticket))
        self.trigger()

    def _make_deliver_to_parent(self, ticket: Ticket) -> Callable[[dict[str, Any]], None] | None:
        """Create a callback that delivers an update to this ticket's creator."""
        creator_id = ticket.metadata.creator_ticket_id
        if not creator_id:
            return None

        def deliver(update: dict[str, Any]) -> None:
            self._deliver_context_update(creator_id, update)

        return deliver

    def _make_on_event(self, ticket_id: str):
        """Create an event callback wired to the ticket-event hook."""
        hook = self._hooks.on_ticket_event

        async def on_event(event: dict[str, Any]):
            if hook:
                await hook(ticket_id, event)

        return on_event


    async def _route_coordination_ticket(self, ticket: Ticket) -> None:
        """Route a coordination ticket's signal to matching subscribers.

        Delivery is durable: the coordination ticket stays ``available``
        until every matching subscriber has been delivered to. Subscribers
        that are busy (running or not idle) are skipped and retried in the
        next scheduler cycle.

        This design survives server restarts — undelivered coordination
        tickets remain ``available`` on disk and are re-routed on startup.
        """
        signal_type = ticket.metadata.signal_type or ""
        payload = ticket.metadata.context or ""
        source_tags = set(ticket.metadata.tags or [])
        delivered = set(ticket.metadata.delivered_to or [])

        # Find all matching subscribers.
        source_run_id = ticket.metadata.playbook_run_id
        subscribers: list[Ticket] = []
        for candidate in self.store.query_all():
            if candidate.id == ticket.id:
                continue
            if not candidate.metadata.watch_events:
                continue
            # Run-ID scoping: if the signal is scoped to a run,
            # only deliver to subscribers in that same run.
            if source_run_id and candidate.metadata.playbook_run_id != source_run_id:
                continue
            for watch in candidate.metadata.watch_events:
                if watch.get("type") != signal_type:
                    continue
                # Tag filtering.
                tag_filters = watch.get("tags", [])
                exclude = {f[1:] for f in tag_filters if f.startswith("!")}
                require = {f for f in tag_filters if not f.startswith("!")}
                if source_tags & exclude:
                    continue
                if require and not (source_tags & require):
                    continue
                subscribers.append(candidate)
                break

        # Try to deliver to each subscriber not yet delivered.
        all_delivered = True
        for sub in subscribers:
            if sub.id in delivered:
                continue

            # Let the playbook hook intercept before delivery.
            result = run_event_hooks(signal_type, payload, sub)
            if result is None:
                # Hook ate the event — mark delivered, skip agent.
                delivered.add(sub.id)
                sub.save_metadata()
                logger.info(
                    "Coordination %s eaten by hook for %s",
                    ticket.id[:8],
                    sub.id[:8],
                )
                continue

            if (
                sub.metadata.status == "suspended"
                and sub.metadata.assignee == "user"
                and sub.id not in self._running_tickets
            ):
                # Idle — deliver immediately.
                response_path = sub.dir / "response.json"
                response_path.write_text(
                    json.dumps(
                        {"context_updates": [result]},
                        indent=2,
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                sub.metadata.assignee = "agent"
                sub.save_metadata()
                delivered.add(sub.id)
                logger.info(
                    "Coordination %s delivered to %s",
                    ticket.id[:8],
                    sub.id[:8],
                )
            else:
                # Busy — skip, will retry next cycle.
                all_delivered = False

        # Update delivery tracking.
        ticket.metadata.delivered_to = list(delivered)

        if all_delivered:
            ticket.metadata.status = "completed"
            ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
            logger.info(
                "Coordination ticket %s fully delivered (signal_type=%s)",
                ticket.id[:8],
                signal_type,
            )

        ticket.save_metadata()

        # Broadcast the updated coordination ticket to the UI.
        if self._hooks.on_ticket_done:
            await self._hooks.on_ticket_done(ticket)


    async def _run_cycles(self) -> None:
        """Run cycles until no more work is available (server mode).

        Unlike ``run_all_waves`` (batch gather), this fires each ticket
        as an independent ``asyncio.Task`` for concurrent execution.
        """
        cycle = 0

        while True:
            promote_blocked_tickets(self.store)

            all_available = self.store.query_all(status="available")

            # Route coordination tickets before processing work tickets.
            coordination = [
                t for t in all_available
                if t.metadata.kind == "coordination"
            ]
            for t in coordination:
                await self._route_coordination_ticket(t)

            tickets = [
                t for t in all_available
                if t.metadata.kind != "coordination"
            ]
            resumable = [
                t for t in self.store.query_all(status="suspended")
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
                        self._active_tasks.pop(t.id, None)
                        updated = self.store.get(t.id) or t
                        run_ticket_done_hooks(updated)
                        self._notify_ticket_done(t.id)

                        creator_id = updated.metadata.creator_ticket_id
                        if creator_id and updated.metadata.status in ("completed", "failed"):
                            update = {"task_id": updated.id, "status": updated.metadata.status, "outcome": updated.metadata.outcome or updated.metadata.error or "(no outcome)"}
                            self._deliver_context_update(creator_id, update)
                        enriched = self._enrich_creator_tags(updated)
                        if enriched and self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(enriched)
                        if self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(updated)

                        self.trigger()

                task = asyncio.create_task(wrap_run())
                self._active_tasks[ticket.id] = task

            for ticket in resumable:
                if ticket.id in self._running_tickets:
                    continue
                self._running_tickets.add(ticket.id)

                async def wrap_resume(t=ticket):
                    try:
                        await self.resume_ticket(t)
                    finally:
                        self._running_tickets.discard(t.id)
                        self._active_tasks.pop(t.id, None)
                        updated = self.store.get(t.id) or t
                        run_ticket_done_hooks(updated)
                        self._notify_ticket_done(t.id)

                        creator_id = updated.metadata.creator_ticket_id
                        if creator_id and updated.metadata.status in ("completed", "failed"):
                            update = {"task_id": updated.id, "status": updated.metadata.status, "outcome": updated.metadata.outcome or updated.metadata.error or "(no outcome)"}
                            self._deliver_context_update(creator_id, update)
                        enriched = self._enrich_creator_tags(updated)
                        if enriched and self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(enriched)
                        if self._hooks.on_ticket_done:
                            await self._hooks.on_ticket_done(updated)

                        self.trigger()

                task = asyncio.create_task(wrap_resume())
                self._active_tasks[ticket.id] = task

            await asyncio.sleep(1)

        if self._hooks.on_cycle_complete:
            await self._hooks.on_cycle_complete(cycle)
