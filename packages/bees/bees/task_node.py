# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations
from bees.task_store import TaskStore
from bees.ticket import Ticket


class TaskNode:
    """Wraps a Ticket and a TaskStore to provide a tree traversal API."""

    def __init__(self, task: Ticket, store: TaskStore):
        self._task = task
        self.store = store

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
        tasks = self.store.get_children(self._task.id)
        return [TaskNode(t, self.store) for t in tasks]

    @property
    def parent(self) -> TaskNode | None:
        """Returns the parent of this task."""
        if not self._task.metadata.parent_ticket_id:
            return None
        parent_task = self.store.get(self._task.metadata.parent_ticket_id)
        return TaskNode(parent_task, self.store) if parent_task else None

    def query(self, tags: list[str]) -> list[TaskNode]:
        """Searches for tasks in the subtree that contain all of the specified tags."""
        all_tickets = self.store.query_all()
        
        # Build child map
        from collections import defaultdict
        child_map = defaultdict(list)
        ticket_map = {}
        for t in all_tickets:
            ticket_map[t.id] = t
            if t.metadata.parent_ticket_id:
                child_map[t.metadata.parent_ticket_id].append(t.id)
                
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
                matching_nodes.append(TaskNode(t, self.store))
                
        return matching_nodes
