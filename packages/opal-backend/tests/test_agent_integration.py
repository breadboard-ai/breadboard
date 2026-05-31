# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for agent mode integration (Phase 4).

Verifies that:
- Agent nodes stream events wrapped with nodeId
- Agent suspend → node suspend → inputRequired event
- Agent resume → node resume → downstream triggered
- Agent error → node failed → dependents skipped
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import pytest

from opal_backend.events import (
    ContentEvent,
    CompleteEvent,
    StartEvent,
    WaitForInputEvent,
    ErrorEvent,
    AgentEvent,
)
from opal_backend.graph_runner import GraphRunner
from opal_backend.graph_types import Edge, GraphPlan, NodeDescriptor, PlanNodeInfo
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


def _agent_plan() -> GraphPlan:
    """Single agent node (generate in agent mode)."""
    gen = NodeDescriptor(
        id="agent1", type="generate",
        configuration={"mode": "agent", "systemInstruction": "Be helpful"},
    )
    out = NodeDescriptor(id="out", type="output")
    e = Edge(from_node="agent1", to_node="out", out_port="context", in_port="result")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=gen, downstream=[e], upstream=[])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e])],
    ])


def _make_fake_run_agent(events: list[AgentEvent]):
    """Create a fake run_agent that yields the given events."""

    async def fake_run_agent(**kwargs) -> AsyncIterator[AgentEvent]:
        for event in events:
            yield event

    return fake_run_agent


class TestAgentEventsStreaming:
    """Phase 4 🎯: agent events stream with nodeId envelope."""

    @pytest.mark.asyncio
    async def test_agent_events_forwarded(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        fake_agent = _make_fake_run_agent([
            StartEvent(objective={"parts": [{"text": "test"}]}),
            ContentEvent(
                content={"role": "model", "parts": [{"text": "Hello!"}]},
            ),
            CompleteEvent(),
        ])

        runner = GraphRunner(
            store=store, event_bus=bus, scheduler=None,
            run_agent_fn=fake_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        # Check that agent events are wrapped with nodeId.
        agent_events = [e for e in events if e["type"] == "agentEvent"]
        assert len(agent_events) >= 2  # start + content at minimum
        for ae in agent_events:
            assert ae["nodeId"] == "agent1"
            assert "event" in ae

    @pytest.mark.asyncio
    async def test_agent_output_flows_downstream(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        fake_agent = _make_fake_run_agent([
            ContentEvent(
                content={"role": "model", "parts": [{"text": "Result!"}]},
            ),
            CompleteEvent(),
        ])

        runner = GraphRunner(
            store=store, event_bus=bus, scheduler=None,
            run_agent_fn=fake_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_plan()
        await store.create("s1", plan)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        async for event in subscriber:
            if event.get("type") == "graphComplete":
                break

        outputs = await store.get_graph_outputs("s1")
        assert "agent1" in outputs
        assert "out" in outputs


class TestAgentSuspendResume:
    """Agent suspend → inputRequired, resume → downstream."""

    @pytest.mark.asyncio
    async def test_suspend_emits_input_required(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        fake_agent = _make_fake_run_agent([
            StartEvent(objective={"parts": [{"text": "test"}]}),
            WaitForInputEvent(
                request_id="req-1",
                prompt={"parts": [{"text": "What next?"}]},
                input_type="text",
                interaction_id="int-123",
            ),
        ])

        runner = GraphRunner(
            store=store, event_bus=bus, scheduler=None,
            run_agent_fn=fake_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_plan()
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
        assert input_req[0]["nodeId"] == "agent1"
        assert input_req[0]["interactionId"] == "int-123"

        # Status should be suspended.
        assert await store.get_status("s1") == "suspended"

    @pytest.mark.asyncio
    async def test_resume_completes_graph(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        fake_agent = _make_fake_run_agent([
            WaitForInputEvent(
                request_id="req-1",
                prompt={"parts": [{"text": "What next?"}]},
                interaction_id="int-456",
            ),
        ])

        runner = GraphRunner(
            store=store, event_bus=bus, scheduler=None,
            run_agent_fn=fake_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_plan()
        await store.create("s1", plan)

        # Start and wait for suspend.
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        async for event in subscriber:
            if event.get("type") == "inputRequired":
                break

        # Resume the node.
        await runner.resume_node(
            "s1", "int-456",
            {"role": "user", "parts": [{"text": "Continue!"}]},
        )

        # Wait for completion.
        subscriber2 = bus.subscribe("s1")
        async for event in subscriber2:
            if event.get("type") == "graphComplete":
                break

        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"


class TestAgentError:
    """Agent error → node failed → dependents skipped."""

    @pytest.mark.asyncio
    async def test_agent_error_marks_node_failed(self):
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        async def failing_agent(**kwargs):
            yield StartEvent(objective={"parts": [{"text": "test"}]})
            raise RuntimeError("Agent crashed")

        runner = GraphRunner(
            store=store, event_bus=bus, scheduler=None,
            run_agent_fn=failing_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_plan()
        await store.create("s1", plan)

        events: list[dict] = []
        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        # Graph should complete (with failures) and close the bus.
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "graphComplete":
                break

        # Agent node should be failed, output skipped.
        state = store._sessions["s1"]
        assert state.nodes["agent1"].status == "failed"
        assert state.nodes["out"].status == "skipped"

        # Verify nodeError event was emitted.
        error_events = [e for e in events if e["type"] == "nodeError"]
        assert len(error_events) == 1
        assert "Agent crashed" in error_events[0]["error"]
