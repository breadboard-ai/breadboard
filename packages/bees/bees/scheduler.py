# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Scheduler — unified task lifecycle and orchestration.

Owns the decisions of *what runs when* and the metadata bookkeeping
around each task's execution.  Consumers (server, CLI) plug in
behaviour via typed ``SchedulerEvent`` callbacks (see ``bees.protocols.events``).

The Concept of a Cycle
----------------------

A **Cycle** is a single wave of dependency-aware task execution. The
system operates by repeatedly evaluating task dependencies and firing all
unblocked work simultaneously:

1. **Promote**: The scheduler checks all ``blocked`` tasks. If their
   dependencies are resolved (``completed``), it promotes them to ``available``.
2. **Collect**: It gathers all runnable work:
   - New ``available`` tasks.
   - ``suspended`` tasks that have been responded to by a user and are
     ready for the agent to resume.
3. **Execute (Wave)**: All collected tasks are fired concurrently (either
   gathered in batch mode, or spawned as tasks in server mode).
4. **Settle**: Active tasks run until they reach a resting state:
   - ``completed`` or ``failed`` (resolved).
   - ``suspended`` (waiting for user input).
5. **Trigger**: When work settles, the scheduler wakes up to evaluate the
   next cycle. If previous tasks unblocked new ones, the loop continues.
   If no work remains, it goes idle (server) or finishes (CLI).

This "wave orchestration" ensures that independent tasks (e.g., three
separate search queries for children of a root task) can execute in parallel,
while sequential dependencies are strictly preserved without blocking the system.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from typing import Any, Awaitable, Callable

from bees.coordination import route_coordination_task
from bees.playbook import run_task_done_hooks, load_system_config, run_playbook
from bees.protocols.events import (
    CycleComplete,
    CycleStarted,
    EventEmitter,
    TaskAdded,
    TaskDone,
    TaskEvent,
    TaskStarted,
)
from bees.protocols.session import SessionResult, SessionRunner, SessionStream
from bees.task_runner import TaskRunner
from bees.ticket import Ticket
from bees.task_store import TaskStore
from bees.functions.mcp_bridge import MCPRegistry
from bees.context_updates import updates_to_context_parts

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# No-op emitter (default when no observer is registered)
# ---------------------------------------------------------------------------


async def _noop_emit(event: Any) -> None:
    """Default emitter that discards events."""


# ---------------------------------------------------------------------------
# Dependency promotion
# ---------------------------------------------------------------------------


def promote_blocked_tasks(store: TaskStore) -> int:
    """Check blocked tasks and promote those whose deps are met.

    Returns the number of tasks promoted.
    """
    blocked = store.query_all(status="blocked")
    promoted = 0

    for task in blocked:
        deps = task.metadata.depends_on or []
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
            task.metadata.status = "failed"
            task.metadata.error = "Dependency failed"
            store.save_metadata(task)
            continue

        if all_met:
            task.metadata.status = "available"
            store.save_metadata(task)
            promoted += 1

    return promoted


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------


class Scheduler:
    """Task lifecycle manager and orchestrator.

    Owns:
    - Cycle orchestration (promote → collect → fire → repeat).
    - Context delivery (three-path model).
    - A trigger-based background loop for the server.
    - Recovery of stuck tasks on startup.

    Delegates individual task execution to ``TaskRunner``.
    """

    def __init__(
        self,
        *,
        runner: SessionRunner,
        store: TaskStore,
        emit: EventEmitter | None = None,
    ) -> None:
        self._emit = emit or _noop_emit
        self.store = store
        self._trigger = asyncio.Event()
        self._running = False
        self._running_tasks: set[str] = set()
        self._completion_events: dict[str, asyncio.Event] = {}
        self._active_tasks: dict[str, asyncio.Task] = {}
        self._active_streams: dict[str, SessionStream] = {}
        self._mcp_registry: MCPRegistry | None = None

        self._task_runner = TaskRunner(
            runner=runner,
            store=self.store,
            scheduler_ref=self,
            active_streams=self._active_streams,
            get_mcp_factories=lambda: (
                self._mcp_registry.get_factories()
                if self._mcp_registry else None
            ),
            deliver_context_update=self._deliver_context_update,
            on_events_broadcast=self._on_events_broadcast_internal,
            emit=self._emit,
        )

    # -- public API --------------------------------------------------------

    def trigger(self) -> None:
        """Wake the scheduler loop."""
        self._trigger.set()

    async def startup(self) -> Ticket | None:
        """Recover stuck tasks, boot root template if needed."""
        tasks = await self.recover_stuck_tasks()

        # Connect to MCP servers declared in SYSTEM.yaml.
        config = load_system_config(self.store.hive_dir / "config")
        mcp_configs = config.get("mcp", [])
        if mcp_configs:
            self._mcp_registry = MCPRegistry()
            await self._mcp_registry.connect_all(mcp_configs)

        root_task = await self._boot_root_template(tasks)
        if root_task:
            tasks.append(root_task)

        return root_task

    async def shutdown(self) -> None:
        """Clean up MCP connections and other resources."""
        if self._mcp_registry:
            await self._mcp_registry.disconnect_all()
            self._mcp_registry = None

    async def create_task(self, objective: str, **kwargs) -> Ticket:
        """Create a new task and emit TaskAdded."""
        task = self.store.create(objective, **kwargs)
        await self._emit(TaskAdded(task=task))
        self.trigger()
        return task

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
        task = run_playbook(root, store=self.store)
        await self._emit(TaskAdded(task=task))
        return task

    async def wait_for_task(self, task_id: str, timeout_ms: float) -> str:
        """Wait for a task to complete, fail, or suspend.

        Races an in-memory completion event against a timeout. Returns
        the task's status on exit.
        """
        event = self._completion_events.setdefault(task_id, asyncio.Event())
        
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout_ms / 1000.0)
        except asyncio.TimeoutError:
            pass
            
        fresh = self.store.get(task_id)
        return fresh.metadata.status if fresh else "unknown"

    def _notify_task_done(self, task_id: str) -> None:
        """Wake up anyone waiting for this task."""
        if task_id in self._completion_events:
            self._completion_events[task_id].set()
            del self._completion_events[task_id]

    def cancel_task(self, task_id: str) -> bool:
        """Cancel a running or pending task.
        
        Returns True if the task was found and cancelled, False otherwise.
        """
        cancelled = False
        
        if task_id in self._active_tasks:
            self._active_tasks[task_id].cancel()
            cancelled = True
            
        task = self.store.get(task_id)
        if task:
            task.metadata.status = "cancelled"
            self.store.save_metadata(task)
            cancelled = True
            
        return cancelled

    def pause_all_tasks(self) -> int:
        """Pause all running, available, suspended, blocked, and paused tasks.

        Cancels in-flight asyncio tasks and flips metadata to ``paused``.
        Stashes the pre-pause status in ``paused_from`` so resume can
        restore it.  Returns the number of tasks paused.
        """
        # Cancel all in-flight asyncio tasks.
        for task_id, async_task in list(self._active_tasks.items()):
            async_task.cancel()

        # Flip all non-terminal tasks to paused.
        NON_TERMINAL = ("available", "blocked", "running", "suspended")
        count = 0
        for status in NON_TERMINAL:
            for task in self.store.query_all(status=status):
                task.metadata.paused_from = task.metadata.status
                task.metadata.status = "paused"
                self.store.save_metadata(task)
                count += 1

        return count

    def pause_task(self, task_id: str) -> bool:
        """Pause a single task.

        Cancels its asyncio task if running, then flips status to
        ``paused`` with ``paused_from`` set for later resume.
        Returns True if the task was found and paused.
        """
        task = self.store.get(task_id)
        if not task:
            return False

        # Already in a terminal or paused state — nothing to do.
        if task.metadata.status in ("completed", "failed", "cancelled", "paused"):
            return False

        # Cancel the asyncio task if it's actively running.
        if task_id in self._active_tasks:
            self._active_tasks[task_id].cancel()

        task.metadata.paused_from = task.metadata.status
        task.metadata.status = "paused"
        self.store.save_metadata(task)
        return True

    def deliver_to_task(
        self,
        task_id: str,
        update: dict[str, Any],
        *,
        expected_creator: str | None = None,
    ) -> str | None:
        """Deliver a context update to a task.

        Returns ``None`` on success, or an error string on failure.

        When ``expected_creator`` is provided the target task's
        ``parent_task_id`` must match — this prevents one agent from
        injecting updates into another agent's tasks.
        """
        task = self.store.get(task_id)
        if not task:
            return f"Task {task_id} not found"

        if expected_creator and task.metadata.parent_task_id != expected_creator:
            return f"Task {task_id} is not owned by this agent"

        self._deliver_context_update(task_id, update)
        return None

    # -- context delivery --------------------------------------------------

    def _deliver_context_update(self, target_id: str, update: dict[str, Any]) -> None:
        """Deliver, inject, or buffer a context update for a task.

        Three delivery paths, tried in order:
        1. **Mid-stream** — task is running and has a live context
           queue.  Push pre-formatted parts for injection at the next
           turn boundary.
        2. **Immediate resume** — task is suspended and idle.  Write
           ``response.json`` and flip assignee to trigger resume.
        3. **Buffer** — task is busy but has no live queue (e.g.
           batch mode).  Append to ``pending_context_updates`` in
           metadata for later drain.
        """
        # Path 1: mid-stream injection via live stream.
        stream = self._active_streams.get(target_id)
        if stream is not None:
            parts = updates_to_context_parts([update])
            asyncio.create_task(stream.send_context(parts))
            logger.info("Context update injected mid-stream for %s", target_id)
            return

        target = self.store.get(target_id)
        if not target:
            logger.warning("Failed to load task %s for context update", target_id)
            return

        # Path 2: immediate resume via response.json.
        if (
            target.metadata.status == "suspended"
            and target.metadata.assignee == "user"
            and target_id not in self._running_tasks
        ):
            self.store.respond(target_id, {"context_updates": [update]})
            logger.info("Context update delivered to %s via response.json", target_id)
        else:
            # Path 3: buffer in metadata.
            if target.metadata.pending_context_updates is None:
                target.metadata.pending_context_updates = []
            target.metadata.pending_context_updates.append(update)
            self.store.save_metadata(target)
            logger.info("Context update buffered for %s", target_id)

    # -- tag enrichment ----------------------------------------------------

    def _enrich_parent_tags(self, task: Ticket) -> Ticket | None:
        """Merge a completed task's tags into its parent's tags.

        Called when a subagent finishes (any terminal status).  Performs
        a deduplicated union — one level up only.

        Returns the enriched parent task so the caller can broadcast
        a ``task_update`` via SSE, or ``None`` if nothing changed.
        """
        parent_id = task.metadata.parent_task_id
        child_tags = task.metadata.tags
        if not parent_id or not child_tags:
            return None

        parent = self.store.get(parent_id)
        if not parent:
            logger.warning(
                "Tag enrichment: parent %s not found for %s",
                parent_id, task.id[:8],
            )
            return None

        existing = set(parent.metadata.tags or [])
        merged = existing | set(child_tags)
        if merged == existing:
            return None  # Nothing new.

        parent.metadata.tags = sorted(merged)
        self.store.save_metadata(parent)
        logger.info(
            "Tag enrichment: %s -> %s (added %s)",
            task.id[:8],
            parent_id[:8],
            sorted(merged - existing),
        )
        return parent

    # -- orchestration loops -----------------------------------------------

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

    async def recover_stuck_tasks(self) -> list[Ticket]:
        """Flip any ``running`` or ``paused`` tasks back to a runnable state.

        For ``paused`` tasks with ``paused_from`` set, the original status
        is restored.  Otherwise they become ``available``.

        Returns the full task list (for ``on_startup``).
        """
        tickets = self.store.query_all()
        for t in tickets:
            if t.metadata.status == "running":
                logger.info("Recovered stuck running task: %s", t.id)
                t.metadata.status = "available"
                self.store.save_metadata(t)
            elif t.metadata.status == "paused":
                restored = t.metadata.paused_from or "available"
                logger.info(
                    "Recovered paused task: %s (restoring to %s)",
                    t.id, restored,
                )
                t.metadata.status = restored
                t.metadata.paused_from = None
                self.store.save_metadata(t)
        return tickets

    async def run_all_waves(self) -> list[dict]:
        """Batch mode: run cycles until no work remains.

        Used by the CLI drain.  Runs tasks via ``asyncio.gather``
        (all-at-once per cycle) and collects summaries.
        """
        all_summaries: list[dict] = []
        cycle = 0

        while True:
            promote_blocked_tasks(self.store)

            all_available = self.store.query_all(status="available")

            # Route coordination tasks before processing work tasks.
            coordination = [
                t for t in all_available
                if t.metadata.kind == "coordination"
            ]
            for t in coordination:
                await route_coordination_task(
                    t, self.store, self._running_tasks,
                    self._emit,
                )

            items = [
                t for t in all_available
                if t.metadata.kind != "coordination"
            ]
            resumable = [
                t for t in self.store.query_all(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not items and not resumable:
                if cycle == 0:
                    blocked = self.store.query_all(status="blocked")
                    if blocked:
                        print(
                            f"No runnable tasks. "
                            f"{len(blocked)} blocked task(s) remain.",
                            file=sys.stderr,
                        )
                    else:
                        print(
                            "No available or resumable tasks.",
                            file=sys.stderr,
                        )
                break

            cycle += 1
            total = len(items) + len(resumable)

            await self._emit(CycleStarted(
                cycle=cycle, available=len(items), resumable=len(resumable),
            ))

            print(
                f"Cycle {cycle}: {len(items)} new + {len(resumable)} "
                f"resumable = {total} task(s)...",
                file=sys.stderr,
            )

            coros = [
                self._task_runner.run_task(item)
                for item in items
            ] + [
                self._task_runner.resume_task(item)
                for item in resumable
            ]
            results = await asyncio.gather(*coros, return_exceptions=True)

            all_items_in_cycle = items + resumable
            for item, result in zip(all_items_in_cycle, results):
                if isinstance(result, Exception):
                    all_summaries.append({
                        "ticket": item.id,
                        "status": "failed",
                        "error": str(result),
                    })
                else:
                    all_summaries.append({
                        "ticket": item.id,
                        "status": result.status,
                        "events": result.events,
                        "output": result.output,
                    })

        await self._emit(CycleComplete(total_cycles=cycle))

        return all_summaries

    # -- internal ----------------------------------------------------------

    def _on_events_broadcast_internal(self, task: Ticket) -> None:
        asyncio.create_task(self._emit(TaskAdded(task=task)))
        self.trigger()

    async def _wrap_execution(
        self, task: Ticket, coro: Awaitable[SessionResult],
    ) -> None:
        """Run a task coroutine and handle post-completion cleanup."""
        try:
            await coro
        finally:
            self._running_tasks.discard(task.id)
            self._active_tasks.pop(task.id, None)
            updated = self.store.get(task.id) or task
            run_task_done_hooks(updated)
            self._notify_task_done(task.id)

            parent_id = updated.metadata.parent_task_id
            if parent_id and updated.metadata.status in ("completed", "failed"):
                update = {
                    "task_id": updated.id,
                    "status": updated.metadata.status,
                    "outcome": (
                        updated.metadata.outcome
                        or updated.metadata.error
                        or "(no outcome)"
                    ),
                }
                self._deliver_context_update(parent_id, update)

            enriched = self._enrich_parent_tags(updated)
            if enriched:
                await self._emit(TaskDone(task=enriched))
            await self._emit(TaskDone(task=updated))

            self.trigger()

    async def _run_cycles(self) -> None:
        """Run cycles until no more work is available (server mode).

        Unlike ``run_all_waves`` (batch gather), this fires each task
        as an independent ``asyncio.Task`` for concurrent execution.
        """
        cycle = 0

        while True:
            promote_blocked_tasks(self.store)

            all_available = self.store.query_all(status="available")

            # Route coordination tasks before processing work tasks.
            coordination = [
                t for t in all_available
                if t.metadata.kind == "coordination"
            ]
            for t in coordination:
                await route_coordination_task(
                    t, self.store, self._running_tasks,
                    self._emit,
                )

            items = [
                t for t in all_available
                if t.metadata.kind != "coordination"
            ]
            resumable = [
                t for t in self.store.query_all(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not items and not resumable:
                break

            cycle += 1

            await self._emit(CycleStarted(
                cycle=cycle, available=len(items), resumable=len(resumable),
            ))

            for item in items:
                if item.id in self._running_tasks:
                    continue
                self._running_tasks.add(item.id)
                coro = self._task_runner.run_task(item)
                async_task = asyncio.create_task(self._wrap_execution(item, coro))
                self._active_tasks[item.id] = async_task

            for item in resumable:
                if item.id in self._running_tasks:
                    continue
                self._running_tasks.add(item.id)
                coro = self._task_runner.resume_task(item)
                async_task = asyncio.create_task(self._wrap_execution(item, coro))
                self._active_tasks[item.id] = async_task

            await asyncio.sleep(1)

        await self._emit(CycleComplete(total_cycles=cycle))
