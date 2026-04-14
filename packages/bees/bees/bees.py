# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
import asyncio
from collections import defaultdict
from pathlib import Path
from bees.task_store import TaskStore
from bees.task_node import TaskNode
from bees.scheduler import Scheduler, SchedulerHooks


class Bees:
    """The high-level entry point for the Bees library.

    Acts like the 'Document' in the DOM analogy.
    """

    def __init__(self, hive_dir: Path, backend):
        self._store = TaskStore(hive_dir)
        self._backend = backend
        self._events = defaultdict(list)
        self._loop_task = None
        
        hooks = SchedulerHooks(
            on_ticket_added=lambda t: self._emit("task_added", t),
            on_cycle_start=lambda c, a, r: self._emit("cycle_start", c, a, r),
            on_ticket_event=lambda t, e: self._emit("task_event", t, e),
            on_ticket_start=lambda t: self._emit("task_start", t),
            on_ticket_done=lambda t: self._emit("task_done", t),
            on_cycle_complete=lambda c: self._emit("cycle_complete", c),
        )
        self._scheduler = Scheduler(backend=backend, hooks=hooks, store=self._store)

    async def _emit(self, event_name: str, *args):
        for callback in self._events[event_name]:
            res = callback(*args)
            if asyncio.iscoroutine(res):
                await res

    def on(self, event_name: str, callback):
        """Registers an event listener."""
        self._events[event_name].append(callback)

    async def listen(self):
        """Starts the scheduler loop."""
        await self._scheduler.startup()
        self._loop_task = asyncio.create_task(self._scheduler.start_loop())
        self._scheduler.trigger()

    def _trigger(self):
        """Triggers the scheduler to process tasks."""
        self._scheduler.trigger()

    async def shutdown(self):
        """Stops the scheduler loop and cleans up."""
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

