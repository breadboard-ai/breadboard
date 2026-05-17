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
    accesses the ``TaskStore`` (tickets/) directly for queries and
    mutations, bypassing the Agent-typed ``UnifiedAgentStore``.
    """

    def __init__(self, task: Ticket, bees: Bees):
        self._task = task
        self._bees = bees
        # Use the inner TaskStore for Ticket-typed queries/mutations.
        self._ticket_store = bees._store._ticket_store

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
        tasks = self._ticket_store.get_children(self._task.id)
        return [TaskNode(t, self._bees) for t in tasks]

    @property
    def parent(self) -> TaskNode | None:
        """Returns the parent of this task."""
        if not self._task.metadata.parent_task_id:
            return None
        parent_task = self._ticket_store.get(self._task.metadata.parent_task_id)
        return TaskNode(parent_task, self._bees) if parent_task else None

    @property
    def awaiting_response(self) -> bool:
        """Returns True if the task is suspended and assigned to the user."""
        return self._task.metadata.status == "suspended" and self._task.metadata.assignee == "user"

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks in the subtree that contain all of the specified tags."""
        all_tickets = self._ticket_store.query_all()
        
        # Build child map
        from collections import defaultdict
        child_map = defaultdict(list)
        ticket_map = {}
        for t in all_tickets:
            ticket_map[t.id] = t
            if t.metadata.parent_task_id:
                child_map[t.metadata.parent_task_id].append(t.id)
                
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
            t = ticket_map[d_id]
            t_tags = t.metadata.tags or []
            if all(tag in t_tags for tag in tags):
                matching_nodes.append(TaskNode(t, self._bees))
                
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

        self._task = self._ticket_store.respond(self.id, payload)
        self._bees.trigger()
        return self._task

    def save(self):
        """Saves the task metadata."""
        self._ticket_store.save_metadata(self._task)

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
            refreshed = self._ticket_store.get(self.id)
            if refreshed:
                self._task = refreshed
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
