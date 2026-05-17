# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the AgentStore CRUD operations."""

from __future__ import annotations

import json
import pytest
from pathlib import Path

from bees.agent import Agent, AgentMetadata
from bees.agent_store import AgentStore


@pytest.fixture
def store(tmp_path: Path) -> AgentStore:
    """Create an AgentStore backed by a temp directory."""
    return AgentStore(tmp_path)


class TestCreate:
    def test_creates_directory_and_metadata(self, store: AgentStore) -> None:
        agent = store.create(type="researcher", slug="deep-dive")

        assert agent.id
        assert agent.dir.exists()
        assert agent.metadata_path.exists()

        # Verify JSON round-trip.
        data = json.loads(agent.metadata_path.read_text())
        assert data["type"] == "researcher"
        assert data["slug"] == "deep-dive"
        assert data["status"] == "available"
        assert data["finite"] is True
        assert "created_at" in data

    def test_root_agent_self_owns_workspace(self, store: AgentStore) -> None:
        agent = store.create(type="orchestrator", slug="root")
        assert agent.metadata.workspace_root_id == agent.id

    def test_child_agent_inherits_workspace(self, store: AgentStore) -> None:
        parent = store.create(type="orchestrator", slug="root")
        child = store.create(
            type="researcher",
            slug="deep-dive",
            parent_id=parent.id,
            workspace_root_id=parent.metadata.workspace_root_id,
        )
        assert child.metadata.parent_id == parent.id
        assert child.metadata.workspace_root_id == parent.id

    def test_all_fields_persisted(self, store: AgentStore) -> None:
        agent = store.create(
            type="researcher",
            slug="deep-dive",
            finite=False,
            runner="live",
            model="gemini-2.5-pro",
            voice="Kore",
            functions=["tasks.*", "files.*"],
            skills=["web-search"],
            options={"temperature": 0.7},
            watch_events=[{"type": "data_ready"}],
            signal_type="research_done",
            playbook_id="researcher",
            tasks=["summarizer"],
            tags=["research", "deep"],
        )

        data = json.loads(agent.metadata_path.read_text())
        assert data["finite"] is False
        assert data["runner"] == "live"
        assert data["model"] == "gemini-2.5-pro"
        assert data["voice"] == "Kore"
        assert data["functions"] == ["tasks.*", "files.*"]
        assert data["skills"] == ["web-search"]
        assert data["options"] == {"temperature": 0.7}
        assert data["watch_events"] == [{"type": "data_ready"}]
        assert data["signal_type"] == "research_done"
        assert data["playbook_id"] == "researcher"
        assert data["tasks"] == ["summarizer"]
        assert data["tags"] == ["research", "deep"]


class TestGet:
    def test_get_existing(self, store: AgentStore) -> None:
        created = store.create(type="researcher", slug="deep-dive")
        loaded = store.get(created.id)

        assert loaded is not None
        assert loaded.id == created.id
        assert loaded.metadata.type == "researcher"
        assert loaded.metadata.slug == "deep-dive"
        assert loaded.metadata.status == "available"
        assert loaded.metadata.finite is True

    def test_get_nonexistent_returns_none(self, store: AgentStore) -> None:
        assert store.get("nonexistent-id") is None

    def test_get_malformed_metadata_returns_none(self, store: AgentStore) -> None:
        agent_dir = store.agents_dir / "malformed"
        agent_dir.mkdir(parents=True)
        (agent_dir / "metadata.json").write_text("{invalid json")
        assert store.get("malformed") is None

    def test_get_missing_metadata_returns_none(self, store: AgentStore) -> None:
        agent_dir = store.agents_dir / "no-metadata"
        agent_dir.mkdir(parents=True)
        assert store.get("no-metadata") is None


class TestQueryAll:
    def test_empty_store(self, store: AgentStore) -> None:
        assert store.query_all() == []

    def test_returns_all_agents(self, store: AgentStore) -> None:
        store.create(type="researcher", slug="a")
        store.create(type="researcher", slug="b")

        agents = store.query_all()
        assert len(agents) == 2

    def test_filter_by_status(self, store: AgentStore) -> None:
        a = store.create(type="researcher", slug="a")
        b = store.create(type="researcher", slug="b")

        a.metadata.status = "completed"
        store.save_metadata(a)

        available = store.query_all(status="available")
        assert len(available) == 1
        assert available[0].id == b.id

        completed = store.query_all(status="completed")
        assert len(completed) == 1
        assert completed[0].id == a.id

    def test_sorted_newest_first(self, store: AgentStore) -> None:
        a = store.create(type="researcher", slug="a")
        b = store.create(type="researcher", slug="b")

        agents = store.query_all()
        # b was created after a, so b should be first.
        assert agents[0].id == b.id
        assert agents[1].id == a.id


class TestGetChildren:
    def test_roots_when_no_parent(self, store: AgentStore) -> None:
        root = store.create(type="orchestrator", slug="root")
        child = store.create(
            type="researcher", slug="child",
            parent_id=root.id,
            workspace_root_id=root.id,
        )

        roots = store.get_children(None)
        assert len(roots) == 1
        assert roots[0].id == root.id

    def test_children_of_parent(self, store: AgentStore) -> None:
        root = store.create(type="orchestrator", slug="root")
        child1 = store.create(
            type="researcher", slug="child1",
            parent_id=root.id, workspace_root_id=root.id,
        )
        child2 = store.create(
            type="researcher", slug="child2",
            parent_id=root.id, workspace_root_id=root.id,
        )

        children = store.get_children(root.id)
        ids = {c.id for c in children}
        assert ids == {child1.id, child2.id}


class TestSaveMetadata:
    def test_update_status(self, store: AgentStore) -> None:
        agent = store.create(type="researcher", slug="deep-dive")
        agent.metadata.status = "running"
        store.save_metadata(agent)

        reloaded = store.get(agent.id)
        assert reloaded is not None
        assert reloaded.metadata.status == "running"

    def test_update_active_session(self, store: AgentStore) -> None:
        agent = store.create(type="researcher", slug="deep-dive")
        agent.metadata.active_session = "session-123"
        store.save_metadata(agent)

        reloaded = store.get(agent.id)
        assert reloaded is not None
        assert reloaded.metadata.active_session == "session-123"
