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
    """Wraps a Ticket and provides a tree traversal and manipulation API."""

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
        tasks = self._store.get_children(self._task.id)
        return [TaskNode(t, self._bees) for t in tasks]

    @property
    def parent(self) -> TaskNode | None:
        """Returns the parent of this task."""
        if not self._task.metadata.parent_task_id:
            return None
        parent_task = self._store.get(self._task.metadata.parent_task_id)
        return TaskNode(parent_task, self._bees) if parent_task else None

    @property
    def awaiting_response(self) -> bool:
        """Returns True if the task is suspended and assigned to the user."""
        return self._task.metadata.status == "suspended" and self._task.metadata.assignee == "user"

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks in the subtree that contain all of the specified tags."""
        all_tickets = self._store.query_all()
        
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
        kwargs['owning_task_id'] = self.id
        kwargs['parent_task_id'] = self.id
        ticket = await self._bees._scheduler.create_task(objective, **kwargs)
        return TaskNode(ticket, self._bees)

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

        self._task = self._store.respond(self.id, payload)
        self._bees._trigger()
        return self._task

    def save(self):
        """Saves the task metadata."""
        self._store.save_metadata(self._task)

    def retry(self):
        """Retries a paused task."""
        self._task.metadata.status = "available"
        self._task.metadata.error = None
        self.save()
        self._bees._trigger()
