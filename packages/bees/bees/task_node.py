# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
from typing import TYPE_CHECKING, TypedDict, overload
from bees.ticket import Ticket

if TYPE_CHECKING:
    from bees.bees import Bees

class ReplyResponse(TypedDict):
    text: str

class ChooseResponse(TypedDict):
    selectedIds: list[str]


class TaskNode:
    """Wraps a Ticket and provides a tree traversal and manipulation API.

    TaskNode is a public-facing API consumed by the server, eval, and
    hivetool. It continues to expose ``Ticket`` objects. Internally it
    uses the ``UnifiedAgentStore`` for queries and converts Agent
    objects to Tickets at the boundary.
    """

    def __init__(self, task: Ticket, bees: Bees):
        self._task = task
        self._bees = bees
        self._store = bees._store

    @property
    def task(self) -> Ticket:
        """Returns the underlying Ticket object."""
        return self._task

    @property
    def id(self) -> str:
        """Returns the task ID."""
        return self._task.id

    @property
    def children(self) -> list[TaskNode]:
        """Returns children of this task."""
        from bees.agent_adapter import agent_to_ticket
        agents = self._store.get_children(self._task.id)
        return [TaskNode(agent_to_ticket(a), self._bees) for a in agents]

    @property
    def parent(self) -> TaskNode | None:
        """Returns the parent of this task."""
        from bees.agent_adapter import agent_to_ticket
        parent_id = self._task.metadata.parent_task_id
        if not parent_id:
            return None
        parent_agent = self._store.get(parent_id)
        if not parent_agent:
            return None
        return TaskNode(agent_to_ticket(parent_agent), self._bees)

    @property
    def awaiting_response(self) -> bool:
        """Returns True if the task is suspended and assigned to the user."""
        return self._task.metadata.status == "suspended" and self._task.metadata.assignee == "user"

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks in the subtree that contain all of the specified tags."""
        from bees.agent_adapter import agent_to_ticket
        all_agents = self._store.query_all()
        
        # Build child map
        from collections import defaultdict
        child_map = defaultdict(list)
        agent_map = {}
        for a in all_agents:
            agent_map[a.id] = a
            if a.metadata.parent_id:
                child_map[a.metadata.parent_id].append(a.id)
                
        # Find all descendants of current node
        descendants = []
        def get_descendants(node_id):
            for child_id in child_map[node_id]:
                descendants.append(child_id)
                get_descendants(child_id)
                
        get_descendants(self._task.id)
        
        # Filter by tags
        matching_nodes: list[TaskNode] = []
        
        # Check self
        ticket_tags = self._task.metadata.tags or []
        if all(tag in ticket_tags for tag in tags):
            matching_nodes.append(self)
            
        # Check descendants
        for d_id in descendants:
            a = agent_map[d_id]
            a_tags = a.metadata.tags or []
            if all(tag in a_tags for tag in tags):
                matching_nodes.append(TaskNode(agent_to_ticket(a), self._bees))
                
        return matching_nodes

    async def create_child(self, objective: str, **kwargs) -> TaskNode:
        """Creates a child task under this task."""
        from bees.agent_adapter import agent_to_ticket
        kwargs['owning_task_id'] = self.id
        kwargs['parent_task_id'] = self.id
        agent = await self._bees._scheduler.create_task(objective, **kwargs)
        return TaskNode(agent_to_ticket(agent), self._bees)

    @overload
    def respond(self, response: ReplyResponse) -> Ticket: ...
    
    @overload
    def respond(self, response: ChooseResponse) -> Ticket: ...
    
    @overload
    def respond(self, *, text: str) -> Ticket: ...
    
    @overload
    def respond(self, *, selectedIds: list[str]) -> Ticket: ...
    
    def respond(
        self, 
        response: dict | None = None, 
        *, 
        text: str | None = None, 
        selectedIds: list[str] | None = None
    ) -> Ticket:
        """Delivers a response to this task."""
        
        if response is not None:
            if text is not None or selectedIds is not None:
                raise ValueError("Cannot provide both a dictionary response and keyword arguments")
            payload = response
        else:
            if text is not None and selectedIds is not None:
                raise ValueError("Cannot provide both 'text' and 'selectedIds'")
            if text is None and selectedIds is None:
                raise ValueError("Must provide either 'text' or 'selectedIds' (or a dictionary response)")
            
            payload = {}
            if text is not None:
                payload["text"] = text
            else:
                payload["selectedIds"] = selectedIds

        self._store.respond(self.id, payload)
        refreshed = self._store.get(self.id)
        if refreshed:
            from bees.agent_adapter import agent_to_ticket
            self._task = agent_to_ticket(refreshed)
        self._bees.trigger()
        return self._task

    def save(self):
        """Saves the task metadata."""
        from bees.agent_adapter import agent_to_ticket, ticket_to_agent
        agent = ticket_to_agent(self._task)
        self._store.save_metadata(agent)

    def retry(self):
        """Retries a paused task."""
        self._task.metadata.status = "available"
        self._task.metadata.error = None
        self.save()
        self._bees.trigger()

    def pause(self) -> bool:
        """Pause this task.

        Cancels the asyncio task if running, stashes the current status
        in ``paused_from``, and sets status to ``paused``.
        Returns True if the task was paused, False if it was already
        in a terminal or paused state.
        """
        paused = self._bees._scheduler.pause_task(self.id)
        if paused:
            # Refresh our snapshot.
            refreshed = self._store.get(self.id)
            if refreshed:
                from bees.agent_adapter import agent_to_ticket
                self._task = agent_to_ticket(refreshed)
        return paused

    def resume(self) -> bool:
        """Resume this task from a paused state.

        Restores the pre-pause status from ``paused_from``.
        Returns True if the task was resumed, False if it wasn't paused.
        """
        if self._task.metadata.status != "paused":
            return False
        self._task.metadata.status = self._task.metadata.paused_from or "available"
        self._task.metadata.paused_from = None
        self.save()
        self._bees.trigger()
        return True

    def delete(self) -> list[str]:
        """Delete this task and all its descendants.

        Cancels in-flight work, removes ticket directories and session
        logs.  Returns a list of all deleted task IDs.
        """
        return self._bees.delete_task(self.id)
