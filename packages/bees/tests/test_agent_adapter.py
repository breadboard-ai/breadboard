# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the TicketToAgentAdapter."""

from __future__ import annotations

import pytest
from pathlib import Path

from bees.agent import Agent
from bees.agent_adapter import TicketToAgentAdapter, ticket_to_agent
from bees.task_store import TaskStore
from bees.ticket import Ticket, TicketMetadata


@pytest.fixture
def ticket_store(tmp_path: Path) -> TaskStore:
    """Create a TaskStore backed by a temp directory."""
    (tmp_path / "tickets").mkdir()
    return TaskStore(tmp_path)


@pytest.fixture
def adapter(ticket_store: TaskStore) -> TicketToAgentAdapter:
    return TicketToAgentAdapter(ticket_store)


class TestTicketToAgent:
    def test_basic_conversion(self, ticket_store: TaskStore) -> None:
        ticket = ticket_store.create(
            "Do something",
            slug="my-agent",
            playbook_id="researcher",
            model="gemini-2.5-pro",
            runner="generate",
            functions=["system.*", "files.*"],
        )

        agent = ticket_to_agent(ticket)

        assert agent.id == ticket.id
        assert agent.dir == ticket.dir
        assert agent.metadata.slug == "my-agent"
        assert agent.metadata.type == "researcher"
        assert agent.metadata.model == "gemini-2.5-pro"
        assert agent.metadata.runner == "generate"
        assert agent.metadata.functions == ["system.*", "files.*"]

    def test_finite_from_system_functions(self, ticket_store: TaskStore) -> None:
        # Has system.* → finite
        ticket = ticket_store.create(
            "Do something",
            functions=["system.*", "files.*"],
        )
        agent = ticket_to_agent(ticket)
        assert agent.metadata.finite is True

    def test_infinite_without_system_functions(self, ticket_store: TaskStore) -> None:
        # No system.* → infinite
        ticket = ticket_store.create(
            "Do something",
            functions=["files.*", "tasks.*"],
        )
        agent = ticket_to_agent(ticket)
        assert agent.metadata.finite is False

    def test_default_finite_when_no_functions(self, ticket_store: TaskStore) -> None:
        # No functions list → finite (backward compat)
        ticket = ticket_store.create("Do something")
        agent = ticket_to_agent(ticket)
        assert agent.metadata.finite is True

    def test_parent_mapping(self, ticket_store: TaskStore) -> None:
        parent = ticket_store.create("Parent task")
        child = ticket_store.create(
            "Child task",
            parent_task_id=parent.id,
            owning_task_id=parent.id,
        )

        agent = ticket_to_agent(child)
        assert agent.metadata.parent_id == parent.id
        assert agent.metadata.workspace_root_id == parent.id

    def test_root_agent_workspace(self, ticket_store: TaskStore) -> None:
        ticket = ticket_store.create("Root task")
        agent = ticket_to_agent(ticket)
        # Root agents own their workspace.
        assert agent.metadata.workspace_root_id == ticket.id

    def test_all_fields_mapped(self, ticket_store: TaskStore) -> None:
        ticket = ticket_store.create(
            "Do something",
            slug="my-agent",
            playbook_id="researcher",
            model="gemini-2.5-pro",
            voice="Kore",
            runner="live",
            functions=["system.*"],
            skills=["web-search"],
            options={"temp": 0.5},
            watch_events=[{"type": "data_ready"}],
            tags=["research"],
        )
        ticket.metadata.signal_type = "done"
        ticket.metadata.active_session = "sess-1"
        ticket_store.save_metadata(ticket)

        agent = ticket_to_agent(ticket)
        assert agent.metadata.voice == "Kore"
        assert agent.metadata.skills == ["web-search"]
        assert agent.metadata.options == {"temp": 0.5}
        assert agent.metadata.watch_events == [{"type": "data_ready"}]
        assert agent.metadata.signal_type == "done"
        assert agent.metadata.active_session == "sess-1"
        assert agent.metadata.tags == ["research"]


class TestAdapterGet:
    def test_get_existing(
        self, ticket_store: TaskStore, adapter: TicketToAgentAdapter,
    ) -> None:
        ticket = ticket_store.create("Do something", slug="test")
        agent = adapter.get(ticket.id)

        assert agent is not None
        assert isinstance(agent, Agent)
        assert agent.id == ticket.id
        assert agent.metadata.slug == "test"

    def test_get_nonexistent(self, adapter: TicketToAgentAdapter) -> None:
        assert adapter.get("nonexistent") is None


class TestAdapterQueryAll:
    def test_returns_all(
        self, ticket_store: TaskStore, adapter: TicketToAgentAdapter,
    ) -> None:
        ticket_store.create("Task A")
        ticket_store.create("Task B")

        agents = adapter.query_all()
        assert len(agents) == 2
        assert all(isinstance(a, Agent) for a in agents)

    def test_filter_by_status(
        self, ticket_store: TaskStore, adapter: TicketToAgentAdapter,
    ) -> None:
        a = ticket_store.create("Task A")
        b = ticket_store.create("Task B")

        a.metadata.status = "completed"
        ticket_store.save_metadata(a)

        available = adapter.query_all(status="available")
        assert len(available) == 1
        assert available[0].id == b.id


class TestAdapterGetChildren:
    def test_roots(
        self, ticket_store: TaskStore, adapter: TicketToAgentAdapter,
    ) -> None:
        root = ticket_store.create("Root task")
        child = ticket_store.create("Child task", parent_task_id=root.id)

        roots = adapter.get_children(None)
        assert len(roots) == 1
        assert roots[0].id == root.id

    def test_children_of_parent(
        self, ticket_store: TaskStore, adapter: TicketToAgentAdapter,
    ) -> None:
        root = ticket_store.create("Root task")
        child1 = ticket_store.create("Child 1", parent_task_id=root.id)
        child2 = ticket_store.create("Child 2", parent_task_id=root.id)

        children = adapter.get_children(root.id)
        ids = {c.id for c in children}
        assert ids == {child1.id, child2.id}


class TestRoundTrip:
    """Integration: create agent + task → query → verify linkage."""

    def test_agent_task_linkage(self, tmp_path: Path) -> None:
        from bees.agent_store import AgentStore
        from bees.task_file_store import TaskFileStore

        agent_store = AgentStore(tmp_path)
        task_store = TaskFileStore(tmp_path)

        # Create an agent.
        agent = agent_store.create(type="researcher", slug="deep-dive")

        # Create a task assigned to that agent.
        task = task_store.create(
            "Find pricing for product X",
            assignee=agent.id,
            created_by="parent-uuid",
        )

        # Query tasks for the agent.
        agent_tasks = task_store.query_by_assignee(agent.id)
        assert len(agent_tasks) == 1
        assert agent_tasks[0].id == task.id
        assert agent_tasks[0].objective == "Find pricing for product X"

        # Verify the agent exists independently.
        loaded = agent_store.get(agent.id)
        assert loaded is not None
        assert loaded.metadata.slug == "deep-dive"
        assert loaded.metadata.type == "researcher"
