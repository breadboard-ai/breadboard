# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for GraphRunner — end-to-end node task execution.

Phase 2 🎯 objective: a two-node linear graph (text gen → output)
runs via task-per-node, events emitted correctly.
"""

import asyncio

import pytest

from opal_backend.graph_types import Edge, GraphPlan, NodeDescriptor, PlanNodeInfo
from opal_backend.graph_runner import GraphRunner
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


def _two_node_plan() -> GraphPlan:
    """gen → output (two-node linear plan)."""
    gen = NodeDescriptor(id="gen", type="generate")
    out = NodeDescriptor(id="out", type="output")

    e = Edge(from_node="gen", to_node="out", out_port="context", in_port="result")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=gen, downstream=[e], upstream=[])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e])],
    ])


def _three_node_plan() -> GraphPlan:
    """gen1 → gen2 → output (three-node linear plan)."""
    gen1 = NodeDescriptor(id="gen1", type="generate")
    gen2 = NodeDescriptor(id="gen2", type="generate")
    out = NodeDescriptor(id="out", type="output")

    e1 = Edge(from_node="gen1", to_node="gen2", out_port="context", in_port="input")
    e2 = Edge(from_node="gen2", to_node="out", out_port="context", in_port="result")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=gen1, downstream=[e1], upstream=[])],
        [PlanNodeInfo(node=gen2, downstream=[e2], upstream=[e1])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e2])],
    ])


def _diamond_plan() -> GraphPlan:
    """root → (gen1, gen2) → output."""
    root = NodeDescriptor(id="root", type="generate")
    gen1 = NodeDescriptor(id="gen1", type="generate")
    gen2 = NodeDescriptor(id="gen2", type="generate")
    out = NodeDescriptor(id="out", type="output")

    e1 = Edge(from_node="root", to_node="gen1", out_port="context", in_port="i1")
    e2 = Edge(from_node="root", to_node="gen2", out_port="context", in_port="i2")
    e3 = Edge(from_node="gen1", to_node="out", out_port="context", in_port="c1")
    e4 = Edge(from_node="gen2", to_node="out", out_port="context", in_port="c2")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=root, downstream=[e1, e2], upstream=[])],
        [PlanNodeInfo(node=gen1, downstream=[e3], upstream=[e1]),
         PlanNodeInfo(node=gen2, downstream=[e4], upstream=[e2])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e3, e4])],
    ])


class TestTwoNodeLinear:
    """Phase 2 🎯: two-node linear graph runs via task-per-node."""

    @pytest.mark.asyncio
    async def test_events_emitted_in_order(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_node_plan()
        await store.create("s1", plan)

        # Collect events via subscriber.
        events: list[dict] = []
        subscriber = bus.subscribe("s1")

        # Start the graph.
        await runner.start_graph("s1")

        # Wait for graph completion.
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        # Verify event order.
        types = [e["type"] for e in events]
        assert "graphStart" in types
        assert "graphComplete" in types

        # nodeStart/nodeEnd pairs for both nodes.
        node_starts = [e for e in events if e["type"] == "nodeStart"]
        node_ends = [e for e in events if e["type"] == "nodeEnd"]
        assert len(node_starts) == 2
        assert len(node_ends) == 2

        # gen should start before out.
        gen_start_idx = next(
            i for i, e in enumerate(events)
            if e["type"] == "nodeStart" and e["nodeId"] == "gen"
        )
        out_start_idx = next(
            i for i, e in enumerate(events)
            if e["type"] == "nodeStart" and e["nodeId"] == "out"
        )
        assert gen_start_idx < out_start_idx

    @pytest.mark.asyncio
    async def test_graph_completes(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_node_plan()
        await store.create("s1", plan)
        await runner.start_graph("s1")

        # Wait for completion.
        subscriber = bus.subscribe("s1")
        async for event in subscriber:
            if event.get("type") == "graphComplete":
                break

        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"

    @pytest.mark.asyncio
    async def test_outputs_flow_downstream(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_node_plan()
        await store.create("s1", plan)
        await runner.start_graph("s1")

        subscriber = bus.subscribe("s1")
        async for event in subscriber:
            if event.get("type") == "graphComplete":
                break

        # gen node should produce output.
        outputs = await store.get_graph_outputs("s1")
        assert "gen" in outputs
        assert "out" in outputs


class TestThreeNodeLinear:
    @pytest.mark.asyncio
    async def test_three_stage_execution(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _three_node_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")

        await runner.start_graph("s1")

        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        node_starts = [e for e in events if e["type"] == "nodeStart"]
        assert len(node_starts) == 3

        # Verify ordering: gen1 before gen2 before out.
        start_ids = [e["nodeId"] for e in node_starts]
        assert start_ids.index("gen1") < start_ids.index("gen2")
        assert start_ids.index("gen2") < start_ids.index("out")


class TestDiamondGraph:
    @pytest.mark.asyncio
    async def test_parallel_branches(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _diamond_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")

        await runner.start_graph("s1")

        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        node_starts = [e for e in events if e["type"] == "nodeStart"]
        assert len(node_starts) == 4  # inp, gen1, gen2, out

        assert await store.is_graph_complete("s1")

    @pytest.mark.asyncio
    async def test_merge_waits_for_both_branches(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _diamond_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")

        await runner.start_graph("s1")

        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        # out should start after both gen1 and gen2 end.
        out_start_idx = next(
            i for i, e in enumerate(events)
            if e["type"] == "nodeStart" and e["nodeId"] == "out"
        )
        gen1_end_idx = next(
            i for i, e in enumerate(events)
            if e["type"] == "nodeEnd" and e["nodeId"] == "gen1"
        )
        gen2_end_idx = next(
            i for i, e in enumerate(events)
            if e["type"] == "nodeEnd" and e["nodeId"] == "gen2"
        )
        assert out_start_idx > gen1_end_idx
        assert out_start_idx > gen2_end_idx


class TestEventLog:
    @pytest.mark.asyncio
    async def test_events_stored_in_store(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_node_plan()
        await store.create("s1", plan)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        async for event in subscriber:
            if event.get("type") == "graphComplete":
                break

        stored_events = await store.get_events("s1")
        types = [e["type"] for e in stored_events]
        assert "graphStart" in types
        assert "nodeStart" in types
        assert "nodeEnd" in types
        assert "graphComplete" in types
