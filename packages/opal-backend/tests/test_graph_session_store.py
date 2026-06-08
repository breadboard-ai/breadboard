# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for InMemoryGraphSessionStore."""

import pytest

from opal_backend.graph_types import (
    Edge, GraphDescriptor, GraphPlan, NodeDescriptor, PlanNodeInfo,
)
from opal_backend.graph_session_store import SuspendedNodeState
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore


def _linear_plan() -> GraphPlan:
    """a → b → c (linear three-node plan)."""
    a = NodeDescriptor(id="a", type="input")
    b = NodeDescriptor(id="b", type="generate")
    c = NodeDescriptor(id="c", type="output")

    e_ab = Edge(from_node="a", to_node="b", out_port="data", in_port="input")
    e_bc = Edge(from_node="b", to_node="c", out_port="context", in_port="result")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=a, downstream=[e_ab], upstream=[])],
        [PlanNodeInfo(node=b, downstream=[e_bc], upstream=[e_ab])],
        [PlanNodeInfo(node=c, downstream=[], upstream=[e_bc])],
    ])


def _diamond_plan() -> GraphPlan:
    """start → (left, right) → merge."""
    start = NodeDescriptor(id="start", type="input")
    left = NodeDescriptor(id="left", type="generate")
    right = NodeDescriptor(id="right", type="generate")
    merge = NodeDescriptor(id="merge", type="output")

    e_sl = Edge(from_node="start", to_node="left", out_port="data", in_port="i1")
    e_sr = Edge(from_node="start", to_node="right", out_port="data", in_port="i2")
    e_lm = Edge(from_node="left", to_node="merge", out_port="r1", in_port="c1")
    e_rm = Edge(from_node="right", to_node="merge", out_port="r2", in_port="c2")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=start, downstream=[e_sl, e_sr], upstream=[])],
        [PlanNodeInfo(node=left, downstream=[e_lm], upstream=[e_sl]),
         PlanNodeInfo(node=right, downstream=[e_rm], upstream=[e_sr])],
        [PlanNodeInfo(node=merge, downstream=[], upstream=[e_lm, e_rm])],
    ])


class TestCreateAndGetPlan:
    @pytest.mark.asyncio
    async def test_create_stores_plan(self):
        store = InMemoryGraphSessionStore()
        plan = _linear_plan()
        await store.create("s1", plan, "g1")
        result = await store.get_plan("s1")
        assert result is plan

    @pytest.mark.asyncio
    async def test_get_plan_missing_session(self):
        store = InMemoryGraphSessionStore()
        assert await store.get_plan("missing") is None

    @pytest.mark.asyncio
    async def test_initial_node_status(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        # Entry node "a" should be ready (no upstream).
        state = store._sessions["s1"]
        assert state.nodes["a"].status == "ready"
        assert state.nodes["a"].pending_deps == 0
        # "b" should be inactive (1 upstream dep).
        assert state.nodes["b"].status == "inactive"
        assert state.nodes["b"].pending_deps == 1


class TestCompleteNode:
    @pytest.mark.asyncio
    async def test_complete_returns_newly_ready(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        newly_ready = await store.complete_node(
            "s1", "a", {"data": "hello"},
        )
        assert newly_ready == ["b"]

    @pytest.mark.asyncio
    async def test_complete_chain(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        await store.complete_node("s1", "a", {"data": "hello"})
        newly_ready = await store.complete_node(
            "s1", "b", {"context": [{"role": "model", "parts": []}]},
        )
        assert newly_ready == ["c"]

    @pytest.mark.asyncio
    async def test_diamond_both_deps_needed(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _diamond_plan(), "g1")

        # Complete start → left and right become ready.
        newly = await store.complete_node("s1", "start", {"data": "x"})
        assert set(newly) == {"left", "right"}

        # Complete only left — merge still not ready.
        newly = await store.complete_node("s1", "left", {"r1": "a"})
        assert newly == []

        # Complete right → merge becomes ready.
        newly = await store.complete_node("s1", "right", {"r2": "b"})
        assert newly == ["merge"]


class TestGetNodeInputs:
    @pytest.mark.asyncio
    async def test_gathers_upstream_outputs(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        await store.complete_node("s1", "a", {"data": "hello"})
        inputs = await store.get_node_inputs("s1", "b")
        assert inputs == {"input": ["hello"]}

    @pytest.mark.asyncio
    async def test_diamond_gathers_from_both_upstreams(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _diamond_plan(), "g1")

        await store.complete_node("s1", "start", {"data": "x"})
        await store.complete_node("s1", "left", {"r1": "left_val"})
        await store.complete_node("s1", "right", {"r2": "right_val"})

        inputs = await store.get_node_inputs("s1", "merge")
        assert "c1" in inputs
        assert "c2" in inputs
        assert inputs["c1"] == ["left_val"]
        assert inputs["c2"] == ["right_val"]


class TestGetNodeConfig:
    @pytest.mark.asyncio
    async def test_returns_config(self):
        plan = GraphPlan(stages=[[
            PlanNodeInfo(
                node=NodeDescriptor(
                    id="gen", type="generate",
                    configuration={"model": "gemini-3"},
                ),
                downstream=[], upstream=[],
            ),
        ]])
        store = InMemoryGraphSessionStore()
        await store.create("s1", plan, "g1")

        config = await store.get_node_config("s1", "gen")
        assert config == {"model": "gemini-3"}

    @pytest.mark.asyncio
    async def test_returns_empty_if_no_config(self):
        plan = GraphPlan(stages=[[
            PlanNodeInfo(
                node=NodeDescriptor(id="n", type="process"),
                downstream=[], upstream=[],
            ),
        ]])
        store = InMemoryGraphSessionStore()
        await store.create("s1", plan, "g1")
        assert await store.get_node_config("s1", "n") == {}


class TestSuspendResume:
    @pytest.mark.asyncio
    async def test_suspend_and_load(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        state = SuspendedNodeState(
            node_id="b", interaction_id="int-1",
            context={"cursor": 42},
        )
        await store.suspend_node("s1", "b", "int-1", state)

        loaded = await store.load_suspended_node("s1", "int-1")
        assert loaded is not None
        node_id, loaded_state = loaded
        assert node_id == "b"
        assert loaded_state.context == {"cursor": 42}

    @pytest.mark.asyncio
    async def test_load_missing_returns_none(self):
        store = InMemoryGraphSessionStore()
        assert await store.load_suspended_node("s1", "missing") is None


class TestGraphLifecycle:
    @pytest.mark.asyncio
    async def test_is_graph_complete_false_initially(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        assert not await store.is_graph_complete("s1")

    @pytest.mark.asyncio
    async def test_is_graph_complete_true_when_all_done(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.complete_node("s1", "a", {})
        await store.complete_node("s1", "b", {})
        await store.complete_node("s1", "c", {})
        assert await store.is_graph_complete("s1")

    @pytest.mark.asyncio
    async def test_get_graph_outputs(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.complete_node("s1", "a", {"data": "x"})
        await store.complete_node("s1", "b", {"context": "y"})

        outputs = await store.get_graph_outputs("s1")
        assert outputs["a"] == {"data": "x"}
        assert outputs["b"] == {"context": "y"}


class TestMarkNodeFailed:
    @pytest.mark.asyncio
    async def test_marks_node_failed(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.complete_node("s1", "a", {"data": "x"})

        await store.mark_node_failed("s1", "b", "some error")
        state = store._sessions["s1"]
        assert state.nodes["b"].status == "failed"
        assert state.nodes["b"].error == "some error"

    @pytest.mark.asyncio
    async def test_skips_dependents(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.complete_node("s1", "a", {"data": "x"})

        await store.mark_node_failed("s1", "b", "error")
        state = store._sessions["s1"]
        assert state.nodes["c"].status == "skipped"


class TestEventLog:
    @pytest.mark.asyncio
    async def test_append_and_get_events(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        idx0 = await store.append_event("s1", {"type": "graphStart"})
        idx1 = await store.append_event("s1", {"type": "nodeStart", "nodeId": "a"})
        assert idx0 == 0
        assert idx1 == 1

        events = await store.get_events("s1")
        assert len(events) == 2
        assert events[0]["type"] == "graphStart"

    @pytest.mark.asyncio
    async def test_get_events_after_index(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.append_event("s1", {"type": "a"})
        await store.append_event("s1", {"type": "b"})
        await store.append_event("s1", {"type": "c"})

        events = await store.get_events("s1", after=0)
        assert len(events) == 2
        assert events[0]["type"] == "b"


class TestStatus:
    @pytest.mark.asyncio
    async def test_default_status(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        assert await store.get_status("s1") == "running"

    @pytest.mark.asyncio
    async def test_set_status(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")
        await store.set_status("s1", "completed")
        assert await store.get_status("s1") == "completed"

    @pytest.mark.asyncio
    async def test_missing_session_status(self):
        store = InMemoryGraphSessionStore()
        assert await store.get_status("missing") is None


class TestListSessions:
    @pytest.mark.asyncio
    async def test_list_sessions_by_graph_id(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")
        await store.create("s2", _linear_plan(), graph_id="g1")
        await store.create("s3", _linear_plan(), graph_id="g2")

        g1_sessions = await store.list_sessions("g1")
        assert len(g1_sessions) == 2
        ids = {s.session_id for s in g1_sessions}
        assert ids == {"s1", "s2"}

        g2_sessions = await store.list_sessions("g2")
        assert len(g2_sessions) == 1
        assert g2_sessions[0].session_id == "s3"

    @pytest.mark.asyncio
    async def test_list_sessions_empty(self):
        store = InMemoryGraphSessionStore()
        sessions = await store.list_sessions("nonexistent")
        assert sessions == []

    @pytest.mark.asyncio
    async def test_list_sessions_includes_status(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")
        await store.set_status("s1", "completed")

        sessions = await store.list_sessions("g1")
        assert sessions[0].status == "completed"

    @pytest.mark.asyncio
    async def test_list_sessions_sorted_newest_first(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")
        await store.create("s2", _linear_plan(), graph_id="g1")

        sessions = await store.list_sessions("g1")
        # s2 created after s1, should be first.
        assert sessions[0].session_id == "s2"
        assert sessions[1].session_id == "s1"
        assert sessions[0].created_at >= sessions[1].created_at


class TestDeleteSession:
    @pytest.mark.asyncio
    async def test_delete_existing_session(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")

        result = await store.delete_session("s1")
        assert result is True
        assert await store.get_status("s1") is None

    @pytest.mark.asyncio
    async def test_delete_missing_session(self):
        store = InMemoryGraphSessionStore()
        result = await store.delete_session("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_removes_from_graph_index(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")
        await store.create("s2", _linear_plan(), graph_id="g1")

        await store.delete_session("s1")

        sessions = await store.list_sessions("g1")
        assert len(sessions) == 1
        assert sessions[0].session_id == "s2"

    @pytest.mark.asyncio
    async def test_delete_all_cleans_graph_index(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="g1")

        await store.delete_session("s1")

        sessions = await store.list_sessions("g1")
        assert sessions == []


class TestGraphIdTracking:
    @pytest.mark.asyncio
    async def test_graph_id_stored(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), graph_id="my-graph")

        sessions = await store.list_sessions("my-graph")
        assert sessions[0].graph_id == "my-graph"

    @pytest.mark.asyncio
    async def test_graph_id_stored_from_create(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        sessions = await store.list_sessions("g1")
        assert len(sessions) == 1
        assert sessions[0].graph_id == "g1"

    @pytest.mark.asyncio
    async def test_created_at_is_set(self):
        store = InMemoryGraphSessionStore()
        await store.create("s1", _linear_plan(), "g1")

        sessions = await store.list_sessions("g1")
        assert sessions[0].created_at > 0

