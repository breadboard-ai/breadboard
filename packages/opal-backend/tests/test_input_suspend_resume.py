# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for input node suspend/resume (Phase 5).

🎯 Input → Generate → Output works interactively via RPC.
"""

from __future__ import annotations

import asyncio

import pytest

from opal_backend.graph_runner import GraphRunner
from opal_backend.graph_types import Edge, GraphPlan, NodeDescriptor, PlanNodeInfo
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


def _input_gen_output_plan() -> GraphPlan:
    """input → generate → output."""
    inp = NodeDescriptor(
        id="inp", type="input",
        configuration={"prompt": "What is your name?", "schema": {"type": "string"}},
    )
    gen = NodeDescriptor(id="gen", type="generate")
    out = NodeDescriptor(id="out", type="output")
    e1 = Edge(from_node="inp", to_node="gen", out_port="data", in_port="input")
    e2 = Edge(from_node="gen", to_node="out", out_port="context", in_port="result")
    return GraphPlan(stages=[
        [PlanNodeInfo(node=inp, downstream=[e1], upstream=[])],
        [PlanNodeInfo(node=gen, downstream=[e2], upstream=[e1])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e2])],
    ])


def _two_input_plan() -> GraphPlan:
    """Two independent inputs → output."""
    inp1 = NodeDescriptor(
        id="inp1", type="input", configuration={"prompt": "First"},
    )
    inp2 = NodeDescriptor(
        id="inp2", type="input", configuration={"prompt": "Second"},
    )
    out = NodeDescriptor(id="out", type="output")
    e1 = Edge(from_node="inp1", to_node="out", out_port="data", in_port="r1")
    e2 = Edge(from_node="inp2", to_node="out", out_port="data", in_port="r2")
    return GraphPlan(stages=[
        [
            PlanNodeInfo(node=inp1, downstream=[e1], upstream=[]),
            PlanNodeInfo(node=inp2, downstream=[e2], upstream=[]),
        ],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e1, e2])],
    ])


class TestInputSuspend:
    """Input nodes suspend and emit inputRequired."""

    @pytest.mark.asyncio
    async def test_input_node_suspends(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _input_gen_output_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        # Collect events until inputRequired.
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "inputRequired":
                break

        # Verify inputRequired event.
        input_req = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_req) == 1
        assert input_req[0]["nodeId"] == "inp"
        assert "interactionId" in input_req[0]

        # Status should be suspended.
        assert await store.get_status("s1") == "suspended"

        # Generate and output should still be inactive.
        state = store._sessions["s1"]
        assert state.nodes["gen"].status == "inactive"
        assert state.nodes["out"].status == "inactive"


class TestInputResumeFlow:
    """Full interactive flow: input → generate → output."""

    @pytest.mark.asyncio
    async def test_resume_completes_graph(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _input_gen_output_plan()
        await store.create("s1", plan)

        # Start — will suspend at input.
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        interaction_id = None
        async for event in subscriber:
            if event.get("type") == "inputRequired":
                interaction_id = event["interactionId"]
                break

        assert interaction_id is not None

        # Resume with user input.
        await runner.resume_node(
            "s1", interaction_id,
            {"role": "user", "parts": [{"text": "Kevin"}]},
        )

        # Graph should complete — collect remaining events.
        subscriber2 = bus.subscribe("s1")
        async for event in subscriber2:
            if event.get("type") == "graphComplete":
                break

        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"

        # Verify outputs exist.
        outputs = await store.get_graph_outputs("s1")
        assert "inp" in outputs
        assert "gen" in outputs
        assert "out" in outputs


class TestResumeErrors:
    """Error cases for resume."""

    @pytest.mark.asyncio
    async def test_invalid_interaction_id(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _input_gen_output_plan()
        await store.create("s1", plan)
        await runner.start_graph("s1")

        with pytest.raises(ValueError, match="No suspended node"):
            await runner.resume_node("s1", "bogus", {})


class TestMultipleInputNodes:
    """Two independent input nodes: each suspends independently."""

    @pytest.mark.asyncio
    async def test_two_inputs_both_suspend(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_input_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        # Both inputs are in stage 0, so both get scheduled.
        # Collect until we have 2 inputRequired events.
        input_count = 0
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "inputRequired":
                input_count += 1
                if input_count == 2:
                    break

        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 2
        node_ids = {e["nodeId"] for e in input_reqs}
        assert node_ids == {"inp1", "inp2"}

    @pytest.mark.asyncio
    async def test_resume_both_inputs_completes(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _two_input_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        # Collect both inputRequired events.
        input_count = 0
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "inputRequired":
                input_count += 1
                if input_count == 2:
                    break

        input_reqs = [e for e in events if e["type"] == "inputRequired"]

        # Resume both.
        for req in input_reqs:
            await runner.resume_node(
                "s1", req["interactionId"],
                {"text": f"value for {req['nodeId']}"},
            )

        # Graph should complete.
        subscriber2 = bus.subscribe("s1")
        async for event in subscriber2:
            if event.get("type") == "graphComplete":
                break

        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"
