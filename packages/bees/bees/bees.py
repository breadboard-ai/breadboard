# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
import asyncio
from collections import defaultdict
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

from bees.protocols.events import SchedulerEvent
from bees.protocols.session import SessionRunner
from bees.task_store import TaskStore
from bees.task_node import TaskNode
from bees.scheduler import Scheduler

T = TypeVar("T", bound=SchedulerEvent)

# Callback type for typed event listeners.
EventCallback = Callable[..., Any]


class Bees:
    """The high-level entry point for the Bees library.

    Acts like the 'Document' in the DOM analogy.
    """

    def __init__(
        self,
        hive_dir: Path,
        runners: dict[str, SessionRunner],
        *,
        root_override: str | None = None,
    ):
        self._store = TaskStore(hive_dir)
        self._observers: dict[type[SchedulerEvent], list[EventCallback]] = defaultdict(list)
        self._loop_task = None

        self._scheduler = Scheduler(
            runners=runners, emit=self._emit, store=self._store,
            root_override=root_override,
        )

    async def _emit(self, event: SchedulerEvent) -> None:
        """Dispatch a typed event to all registered observers."""
        # Dispatch to observers registered for this specific event type.
        for callback in self._observers.get(type(event), []):
            res = callback(event)
            if asyncio.iscoroutine(res):
                await res

    def on(self, event_type: type[T], callback: Callable[[T], Any]) -> None:
        """Register a typed event listener.

        Example::

            bees.on(TaskDone, lambda e: print(f"Done: {e.task.id}"))
        """
        self._observers[event_type].append(callback)

    def pause_all(self) -> int:
        """Pause all non-terminal tasks.

        Cancels in-flight asyncio tasks and flips statuses to ``paused``,
        preserving the original status in ``paused_from`` for later resume.
        Returns the number of tasks paused.
        """
        return self._scheduler.pause_all_tasks()

    def resume_all(self) -> int:
        """Resume all paused tasks, restoring their pre-pause status.

        Returns the number of tasks resumed.
        """
        count = 0
        for task in self._store.query_all(status="paused"):
            task.metadata.status = task.metadata.paused_from or "available"
            task.metadata.paused_from = None
            self._store.save_metadata(task)
            count += 1
        return count

    async def run(self) -> list[dict]:
        """Run the hive to completion (batch mode).

        Boots the root template, recovers stuck tasks, then runs
        cycles until no work remains.  Returns per-task summaries.

        Counterpart to :meth:`listen` — one-shot vs. reactive.
        """
        await self._scheduler.startup()
        try:
            return await self._scheduler.run_all_waves()
        finally:
            await self._scheduler.shutdown()

    async def listen(self):
        """Starts the scheduler loop."""
        await self._scheduler.startup()
        self._loop_task = asyncio.create_task(self._scheduler.start_loop())
        self._scheduler.trigger()

    def trigger(self):
        """Wake the scheduler to re-evaluate available work."""
        self._scheduler.trigger()

    async def shutdown(self):
        """Stops the scheduler loop and cleans up."""
        await self._scheduler.shutdown()
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass

    @property
    def children(self) -> list[TaskNode]:
        """Returns all tasks that have no parents, as TaskNodes."""
        return [TaskNode(task, self) for task in self._store.get_children(None)]

    @property
    def all(self) -> list[TaskNode]:
        """Returns all tasks in the hive."""
        return [TaskNode(task, self) for task in self._store.query_all()]

    def get_by_id(self, task_id: str) -> TaskNode | None:
        """Looks up a task by ID and returns it as a TaskNode."""
        task = self._store.get(task_id)
        return TaskNode(task, self) if task else None

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks that contain all of the specified tags."""
        all_tasks = self._store.query_all()
        matching_nodes: list[TaskNode] = []
        for task in all_tasks:
            task_tags = task.metadata.tags or []
            if all(tag in task_tags for tag in tags):
                matching_nodes.append(TaskNode(task, self))
        return matching_nodes

    async def create_child(self, objective: str, **kwargs) -> TaskNode:
        """Creates a root task."""
        task = await self._scheduler.create_task(objective, **kwargs)
        return TaskNode(task, self)
