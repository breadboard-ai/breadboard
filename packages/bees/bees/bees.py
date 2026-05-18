# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
import asyncio
from collections import defaultdict
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

from bees.agent import Agent
from bees.protocols.events import SchedulerEvent
from bees.unified_agent_store import UnifiedAgentStore
from bees.agent_node import AgentNode
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
        runners: dict[str, "SessionRunner"],
        *,
        root_override: str | None = None,
    ):
        self._store = UnifiedAgentStore(hive_dir)
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
        """Pause all non-terminal agents.

        Cancels in-flight asyncio tasks and flips statuses to ``paused``,
        preserving the original status in ``paused_from`` for later resume.
        Returns the number of agents paused.
        """
        return self._scheduler.pause_all_tasks()

    def resume_all(self) -> int:
        """Resume all paused agents, restoring their pre-pause status.

        Returns the number of agents resumed.
        """
        count = 0
        for agent in self._store.query_all(status="paused"):
            agent.metadata.status = agent.metadata.paused_from or "available"
            agent.metadata.paused_from = None
            self._store.save_metadata(agent)
            count += 1
        return count

    def delete_task(self, task_id: str) -> list[str]:
        """Delete an agent and all its descendants.

        Cancels in-flight work, removes agent directories and session
        logs, and marks the agent so that post-completion cleanup is
        skipped for any LLM calls or tool invocations that complete
        after deletion.

        Returns a list of all deleted agent IDs.
        """
        return self._scheduler.delete_task(task_id)

    async def run(self) -> list[dict]:
        """Run the hive to completion (batch mode).

        Boots the root template, recovers stuck agents, then runs
        cycles until no work remains.  Returns per-agent summaries.

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
    def children(self) -> list[AgentNode]:
        """Returns all agents that have no parents, as AgentNodes."""
        agents = self._store.get_children(None)
        return [AgentNode(a, self) for a in agents]

    @property
    def all(self) -> list[AgentNode]:
        """Returns all agents in the hive."""
        agents = self._store.query_all()
        return [AgentNode(a, self) for a in agents]

    def get_by_id(self, task_id: str) -> AgentNode | None:
        """Looks up an agent by ID and returns it as an AgentNode."""
        agent = self._store.get(task_id)
        return AgentNode(agent, self) if agent else None

    def query(self, tags: list[str]) -> list[AgentNode]:
        """Searches for agents that contain all of the specified tags."""
        all_agents = self._store.query_all()
        matching_nodes: list[AgentNode] = []
        for agent in all_agents:
            agent_tags = agent.metadata.tags or []
            if all(tag in agent_tags for tag in tags):
                matching_nodes.append(AgentNode(agent, self))
        return matching_nodes

    async def create_child(self, objective: str, **kwargs) -> AgentNode:
        """Creates a root agent."""
        agent = await self._scheduler.create_task(objective, **kwargs)
        return AgentNode(agent, self)

