# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Agent node — tree traversal and manipulation API for agents.

``AgentNode`` wraps an ``Agent`` and provides the public-facing API
consumed by the server, eval, hivetool, and config hooks.  It is the
successor to ``TaskNode`` which wrapped the legacy ``Ticket`` type.
"""

from __future__ import annotations
from collections import defaultdict
from typing import TYPE_CHECKING, TypedDict, overload

from bees.agent import Agent

if TYPE_CHECKING:
    from bees.bees import Bees

__all__ = ["AgentNode"]


class ReplyResponse(TypedDict):
    text: str


class ChooseResponse(TypedDict):
    selectedIds: list[str]


# Backward compat alias — will be removed in a future cleanup.
TaskNode = "AgentNode"


class AgentNode:
    """Wraps an Agent and provides a tree traversal and manipulation API.

    AgentNode is the public-facing API consumed by the server, eval, and
    hivetool.  All data is stored and returned as ``Agent`` objects.
    """

    def __init__(self, agent: Agent, bees: Bees):
        self._agent = agent
        self._bees = bees
        self._store = bees._store

    @property
    def agent(self) -> Agent:
        """Returns the underlying Agent object."""
        return self._agent

    # Backward compat — will be removed in a future cleanup.
    @property
    def task(self) -> Agent:
        """Returns the underlying Agent object (legacy alias)."""
        return self._agent

    @property
    def id(self) -> str:
        """Returns the agent ID."""
        return self._agent.id

    @property
    def children(self) -> list[AgentNode]:
        """Returns children of this agent."""
        agents = self._store.get_children(self._agent.id)
        return [AgentNode(a, self._bees) for a in agents]

    @property
    def parent(self) -> AgentNode | None:
        """Returns the parent of this agent."""
        parent_id = self._agent.metadata.parent_id
        if not parent_id:
            return None
        parent_agent = self._store.get(parent_id)
        if not parent_agent:
            return None
        return AgentNode(parent_agent, self._bees)

    @property
    def awaiting_response(self) -> bool:
        """Returns True if the agent is suspended and assigned to the user."""
        return (
            self._agent.metadata.status == "suspended"
            and self._agent.metadata.assignee == "user"
        )

    def query(self, tags: list[str]) -> list[AgentNode]:
        """Searches for agents in the subtree that contain all specified tags."""
        all_agents = self._store.query_all()

        # Build child map.
        child_map: dict[str, list[str]] = defaultdict(list)
        agent_map: dict[str, Agent] = {}
        for a in all_agents:
            agent_map[a.id] = a
            if a.metadata.parent_id:
                child_map[a.metadata.parent_id].append(a.id)

        # Find all descendants of current node.
        descendants: list[str] = []

        def get_descendants(node_id: str) -> None:
            for child_id in child_map[node_id]:
                descendants.append(child_id)
                get_descendants(child_id)

        get_descendants(self._agent.id)

        # Filter by tags.
        matching_nodes: list[AgentNode] = []

        # Check self.
        agent_tags = self._agent.metadata.tags or []
        if all(tag in agent_tags for tag in tags):
            matching_nodes.append(self)

        # Check descendants.
        for d_id in descendants:
            a = agent_map[d_id]
            a_tags = a.metadata.tags or []
            if all(tag in a_tags for tag in tags):
                matching_nodes.append(AgentNode(a, self._bees))

        return matching_nodes

    async def create_child(self, objective: str, **kwargs) -> AgentNode:
        """Creates a child agent under this agent."""
        kwargs["owning_task_id"] = self.id
        kwargs["parent_task_id"] = self.id
        agent = await self._bees._scheduler.create_task(objective, **kwargs)
        return AgentNode(agent, self._bees)

    @overload
    def respond(self, response: ReplyResponse) -> Agent: ...

    @overload
    def respond(self, response: ChooseResponse) -> Agent: ...

    @overload
    def respond(self, *, text: str) -> Agent: ...

    @overload
    def respond(self, *, selectedIds: list[str]) -> Agent: ...

    def respond(
        self,
        response: dict | None = None,
        *,
        text: str | None = None,
        selectedIds: list[str] | None = None,
    ) -> Agent:
        """Delivers a response to this agent."""
        if response is not None:
            if text is not None or selectedIds is not None:
                raise ValueError(
                    "Cannot provide both a dictionary response and keyword arguments"
                )
            payload = response
        else:
            if text is not None and selectedIds is not None:
                raise ValueError("Cannot provide both 'text' and 'selectedIds'")
            if text is None and selectedIds is None:
                raise ValueError(
                    "Must provide either 'text' or 'selectedIds' "
                    "(or a dictionary response)"
                )
            payload = {}
            if text is not None:
                payload["text"] = text
            else:
                payload["selectedIds"] = selectedIds

        self._store.respond(self.id, payload)
        refreshed = self._store.get(self.id)
        if refreshed:
            self._agent = refreshed
        self._bees.trigger()
        return self._agent

    def save(self) -> None:
        """Saves the agent metadata."""
        self._store.save_metadata(self._agent)

    def retry(self) -> None:
        """Retries a paused agent."""
        self._agent.metadata.status = "available"
        self._agent.metadata.error = None
        self.save()
        self._bees.trigger()

    def pause(self) -> bool:
        """Pause this agent.

        Cancels the asyncio task if running, stashes the current status
        in ``paused_from``, and sets status to ``paused``.
        Returns True if the agent was paused, False if it was already
        in a terminal or paused state.
        """
        paused = self._bees._scheduler.pause_task(self.id)
        if paused:
            refreshed = self._store.get(self.id)
            if refreshed:
                self._agent = refreshed
        return paused

    def resume(self) -> bool:
        """Resume this agent from a paused state.

        Restores the pre-pause status from ``paused_from``.
        Returns True if the agent was resumed, False if it wasn't paused.
        """
        if self._agent.metadata.status != "paused":
            return False
        self._agent.metadata.status = (
            self._agent.metadata.paused_from or "available"
        )
        self._agent.metadata.paused_from = None
        self.save()
        self._bees.trigger()
        return True

    def delete(self) -> list[str]:
        """Delete this agent and all its descendants.

        Cancels in-flight work, removes agent directories and session
        logs.  Returns a list of all deleted agent IDs.
        """
        return self._bees.delete_task(self.id)
