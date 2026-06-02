# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for headless mode — pre-supplied inputs for non-interactive runs.

🎯 Input nodes auto-resolve with pre-supplied inputs when
running in headless mode. Required inputs without pre-supplied
values error; optional inputs skip with empty context.
Agent nodes still suspend normally in headless mode.
"""

from __future__ import annotations

import pytest

from opal_backend.graph_runner import GraphRunner
from opal_backend.graph_types import Edge, GraphPlan, NodeDescriptor, PlanNodeInfo
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


# ---------------------------------------------------------------------------
# Plan helpers
# ---------------------------------------------------------------------------


def _input_gen_output_plan(
    *,
    input_config: dict | None = None,
) -> GraphPlan:
    """input → generate → output.

    Args:
        input_config: Optional config for the input node
            (e.g. {"p-required": True}).
    """
    inp = NodeDescriptor(
        id="inp", type="input",
        configuration=input_config or {},
    )
    gen = NodeDescriptor(id="gen", type="generate")
    out = NodeDescriptor(id="out", type="output")

    e1 = Edge(from_node="inp", to_node="gen", out_port="context", in_port="input")
    e2 = Edge(from_node="gen", to_node="out", out_port="context", in_port="result")

    return GraphPlan(stages=[
        [PlanNodeInfo(node=inp, downstream=[e1], upstream=[])],
        [PlanNodeInfo(node=gen, downstream=[e2], upstream=[e1])],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e2])],
    ])


def _two_input_plan(
    *,
    inp1_config: dict | None = None,
    inp2_config: dict | None = None,
) -> GraphPlan:
    """Two independent inputs → output."""
    inp1 = NodeDescriptor(
        id="inp1", type="input",
        configuration=inp1_config or {},
    )
    inp2 = NodeDescriptor(
        id="inp2", type="input",
        configuration=inp2_config or {},
    )
    out = NodeDescriptor(id="out", type="output")

    e1 = Edge(from_node="inp1", to_node="out", out_port="context", in_port="r1")
    e2 = Edge(from_node="inp2", to_node="out", out_port="context", in_port="r2")

    return GraphPlan(stages=[
        [
            PlanNodeInfo(node=inp1, downstream=[e1], upstream=[]),
            PlanNodeInfo(node=inp2, downstream=[e2], upstream=[]),
        ],
        [PlanNodeInfo(node=out, downstream=[], upstream=[e1, e2])],
    ])


def _agent_node_plan() -> GraphPlan:
    """Single agent node (generate with mode=agent) — no input node."""
    agent = NodeDescriptor(
        id="agent", type="generate",
        configuration={"generation-mode": "agent"},
    )
    return GraphPlan(stages=[
        [PlanNodeInfo(node=agent, downstream=[], upstream=[])],
    ])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_runner(
    store: InMemoryGraphSessionStore,
    bus: InMemoryEventBus,
) -> GraphRunner:
    """Create a wired runner + scheduler."""
    runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
    scheduler = LocalTaskScheduler(run_fn=runner.run_node)
    runner._scheduler = scheduler
    return runner


async def _collect_until(subscriber, event_type: str) -> list[dict]:
    """Collect events from a subscriber until a specific event type."""
    events: list[dict] = []
    async for event in subscriber:
        events.append(event)
        if event.get("type") == event_type:
            break
    return events


# ---------------------------------------------------------------------------
# Store tests
# ---------------------------------------------------------------------------


class TestHeadlessInputStorage:
    """Headless inputs are stored and retrieved correctly."""

    @pytest.mark.asyncio
    async def test_store_and_retrieve_headless_input(self):
        store = InMemoryGraphSessionStore()
        plan = _input_gen_output_plan()
        headless_inputs = {
            "inp": {"role": "user", "parts": [{"text": "Hello"}]},
        }
        await store.create("s1", plan, headless_inputs=headless_inputs)

        result = await store.get_headless_input("s1", "inp")
        assert result == {"role": "user", "parts": [{"text": "Hello"}]}

    @pytest.mark.asyncio
    async def test_get_headless_input_missing_node(self):
        store = InMemoryGraphSessionStore()
        plan = _input_gen_output_plan()
        await store.create("s1", plan, headless_inputs={"other": "x"})

        result = await store.get_headless_input("s1", "inp")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_headless_input_interactive_session(self):
        """Interactive session (no headless_inputs) returns None."""
        store = InMemoryGraphSessionStore()
        plan = _input_gen_output_plan()
        await store.create("s1", plan)

        result = await store.get_headless_input("s1", "inp")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_headless_input_missing_session(self):
        store = InMemoryGraphSessionStore()
        result = await store.get_headless_input("missing", "inp")
        assert result is None

    @pytest.mark.asyncio
    async def test_is_headless_session_true(self):
        store = InMemoryGraphSessionStore()
        plan = _input_gen_output_plan()
        await store.create("s1", plan, headless_inputs={})

        assert await store.is_headless_session("s1") is True

    @pytest.mark.asyncio
    async def test_is_headless_session_false(self):
        store = InMemoryGraphSessionStore()
        plan = _input_gen_output_plan()
        await store.create("s1", plan)

        assert await store.is_headless_session("s1") is False

    @pytest.mark.asyncio
    async def test_is_headless_session_missing(self):
        store = InMemoryGraphSessionStore()
        assert await store.is_headless_session("missing") is False


# ---------------------------------------------------------------------------
# GraphRunner headless tests
# ---------------------------------------------------------------------------


class TestHeadlessAutoResolve:
    """Input nodes auto-resolve with pre-supplied headless inputs."""

    @pytest.mark.asyncio
    async def test_input_auto_resolves_with_headless_value(self):
        """Input node completes immediately with pre-supplied value."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _input_gen_output_plan()
        headless_inputs = {
            "inp": {"role": "user", "parts": [{"text": "Hello headless"}]},
        }
        await store.create("s1", plan, headless_inputs=headless_inputs)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        # No inputRequired should have been emitted.
        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 0

        # Graph should complete.
        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"

        # Input node output should contain the pre-supplied value.
        outputs = await store.get_graph_outputs("s1")
        assert "inp" in outputs
        assert outputs["inp"]["context"] == [
            {"role": "user", "parts": [{"text": "Hello headless"}]},
        ]

    @pytest.mark.asyncio
    async def test_two_inputs_both_auto_resolve(self):
        """Multiple input nodes each auto-resolve independently."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _two_input_plan()
        headless_inputs = {
            "inp1": {"role": "user", "parts": [{"text": "First"}]},
            "inp2": {"role": "user", "parts": [{"text": "Second"}]},
        }
        await store.create("s1", plan, headless_inputs=headless_inputs)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        # No inputRequired events.
        assert not any(e["type"] == "inputRequired" for e in events)

        # All nodes completed.
        assert await store.is_graph_complete("s1")

        outputs = await store.get_graph_outputs("s1")
        assert outputs["inp1"]["context"] == [
            {"role": "user", "parts": [{"text": "First"}]},
        ]
        assert outputs["inp2"]["context"] == [
            {"role": "user", "parts": [{"text": "Second"}]},
        ]


class TestHeadlessRequiredInputError:
    """Required inputs without pre-supplied values error."""

    @pytest.mark.asyncio
    async def test_required_input_missing_errors(self):
        """A required input node with no headless value errors."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _input_gen_output_plan(
            input_config={"p-required": True},
        )
        # Headless mode, but no input for "inp".
        await store.create("s1", plan, headless_inputs={})

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        # Collect events — should get nodeError, not inputRequired.
        events: list[dict] = []
        async for event in subscriber:
            events.append(event)
            if event.get("type") in ("graphComplete", "nodeError"):
                # The graph might complete after error (node failed +
                # dependents skipped), or we see the error first.
                if event.get("type") == "graphComplete":
                    break
                # Keep going to see if graphComplete follows.
                continue
            if event.get("type") == "graphComplete":
                break

        # Should have a nodeError for the input node.
        node_errors = [e for e in events if e["type"] == "nodeError"]
        assert len(node_errors) >= 1
        error_event = node_errors[0]
        assert error_event["nodeId"] == "inp"
        assert "Required input" in error_event["error"]

        # No inputRequired should have been emitted.
        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 0


class TestHeadlessOptionalInputSkip:
    """Optional inputs without pre-supplied values skip."""

    @pytest.mark.asyncio
    async def test_optional_input_skips_with_empty_context(self):
        """An optional input node auto-completes with empty context."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _input_gen_output_plan(
            input_config={"p-required": False},
        )
        # Headless mode, no input for "inp".
        await store.create("s1", plan, headless_inputs={})

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        # No inputRequired — auto-skipped.
        assert not any(e["type"] == "inputRequired" for e in events)

        # Graph completed.
        assert await store.is_graph_complete("s1")
        assert await store.get_status("s1") == "completed"

        # Input node output has empty context.
        outputs = await store.get_graph_outputs("s1")
        assert outputs["inp"]["context"] == []

    @pytest.mark.asyncio
    async def test_default_required_is_false(self):
        """Input with no p-required config defaults to optional (skip)."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _input_gen_output_plan()  # No config → p-required defaults False.
        await store.create("s1", plan, headless_inputs={})

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        assert not any(e["type"] == "inputRequired" for e in events)
        assert await store.is_graph_complete("s1")

        outputs = await store.get_graph_outputs("s1")
        assert outputs["inp"]["context"] == []


class TestHeadlessMixedInputs:
    """Mix of supplied and missing inputs."""

    @pytest.mark.asyncio
    async def test_one_supplied_one_optional_skipped(self):
        """One input supplied, other optional → both auto-resolve."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _two_input_plan(
            inp1_config={},  # optional
            inp2_config={},  # optional
        )
        # Only supply inp1.
        headless_inputs = {
            "inp1": {"role": "user", "parts": [{"text": "Supplied"}]},
        }
        await store.create("s1", plan, headless_inputs=headless_inputs)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        assert not any(e["type"] == "inputRequired" for e in events)
        assert await store.is_graph_complete("s1")

        outputs = await store.get_graph_outputs("s1")
        assert outputs["inp1"]["context"] == [
            {"role": "user", "parts": [{"text": "Supplied"}]},
        ]
        assert outputs["inp2"]["context"] == []  # Skipped.


class TestInteractiveModeUnchanged:
    """Interactive mode (no headless_inputs) still suspends normally."""

    @pytest.mark.asyncio
    async def test_input_still_suspends_in_interactive_mode(self):
        """Without headless_inputs, input nodes suspend as before."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        runner = _make_runner(store, bus)

        plan = _input_gen_output_plan()
        # Interactive mode: no headless_inputs.
        await store.create("s1", plan)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events: list[dict] = []
        async for event in subscriber:
            events.append(event)
            if event.get("type") == "inputRequired":
                break

        # inputRequired should fire.
        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 1
        assert input_reqs[0]["nodeId"] == "inp"

        # Session is suspended.
        assert await store.get_status("s1") == "suspended"


class TestAgentNodeInHeadlessMode:
    """Agent nodes auto-resolve in headless mode.

    In headless mode, when an agent suspends (waitForInput), the
    graph runner saves suspend state and immediately calls resume_node
    with the headless mode note (+ any pre-supplied context).
    """

    @pytest.mark.asyncio
    async def test_agent_auto_resolves_with_headless_note(self):
        """Agent node in headless mode auto-resumes with note text.

        Verifies: suspend → save state → resume_node called with
        headless note, no inputRequired emitted.
        """
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        # Track resume_node calls.
        resumed: list[dict] = []

        async def _fake_run_agent(*, segments, backend, store, graph):
            """Yield a suspend event to trigger headless auto-resolve."""
            from opal_backend.events import WaitForInputEvent
            yield WaitForInputEvent(
                prompt="What topic?",
                input_type="text",
                interaction_id="int-1",
            )

        async def _fake_resume_agent(
            *, interaction_id, response, backend, store, **kwargs,
        ):
            """Capture the resume call and complete."""
            resumed.append({
                "interaction_id": interaction_id,
                "response": response,
            })
            # Yield nothing — agent completes.
            return
            yield  # Make it an async generator.

        runner = GraphRunner(
            store=store,
            event_bus=bus,
            scheduler=None,
            run_agent_fn=_fake_run_agent,
            resume_agent_fn=_fake_resume_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_node_plan()
        await store.create("s1", plan, headless_inputs={})

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "graphComplete")

        # No inputRequired should have been emitted.
        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 0

        # resume_node should have been called.
        assert len(resumed) == 1
        response_parts = resumed[0]["response"]["input"]["parts"]
        # Single part — just the note, no user context.
        assert len(response_parts) == 1
        assert "headless mode" in response_parts[0]["text"]
        assert "without their input" in response_parts[0]["text"]

    @pytest.mark.asyncio
    async def test_agent_headless_with_pre_supplied_context(self):
        """Agent in headless mode gets headless note + pre-supplied text."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()
        resumed: list[dict] = []

        async def _fake_run_agent(*, segments, backend, store, graph):
            from opal_backend.events import WaitForInputEvent
            yield WaitForInputEvent(
                prompt="What topic?",
                input_type="text",
                interaction_id="int-1",
            )

        async def _fake_resume_agent(
            *, interaction_id, response, backend, store, **kwargs,
        ):
            resumed.append({"response": response})
            return
            yield

        runner = GraphRunner(
            store=store,
            event_bus=bus,
            scheduler=None,
            run_agent_fn=_fake_run_agent,
            resume_agent_fn=_fake_resume_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_node_plan()
        # Pre-supply context for the agent node.
        headless_inputs = {
            "agent": {
                "role": "user",
                "parts": [{"text": "Write about bananas"}],
            },
        }
        await store.create("s1", plan, headless_inputs=headless_inputs)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")
        await _collect_until(subscriber, "graphComplete")

        assert len(resumed) == 1
        response_parts = resumed[0]["response"]["input"]["parts"]
        # First part is the note, second is the user's context.
        assert len(response_parts) == 2
        assert "headless mode" in response_parts[0]["text"]
        assert "context for you to consider" in response_parts[0]["text"]
        assert response_parts[1] == {"text": "Write about bananas"}

    @pytest.mark.asyncio
    async def test_agent_interactive_mode_still_suspends(self):
        """Agent node in interactive mode emits inputRequired normally."""
        store = InMemoryGraphSessionStore()
        bus = InMemoryEventBus()

        async def _fake_run_agent(*, segments, backend, store, graph):
            from opal_backend.events import WaitForInputEvent
            yield WaitForInputEvent(
                prompt="What topic?",
                input_type="text",
                interaction_id="int-1",
            )

        runner = GraphRunner(
            store=store,
            event_bus=bus,
            scheduler=None,
            run_agent_fn=_fake_run_agent,
        )
        scheduler = LocalTaskScheduler(run_fn=runner.run_node)
        runner._scheduler = scheduler

        plan = _agent_node_plan()
        # Interactive mode — no headless_inputs.
        await store.create("s1", plan)

        subscriber = bus.subscribe("s1")
        await runner.start_graph("s1")

        events = await _collect_until(subscriber, "inputRequired")

        # inputRequired should have been emitted.
        input_reqs = [e for e in events if e["type"] == "inputRequired"]
        assert len(input_reqs) == 1
        assert input_reqs[0]["nodeId"] == "agent"

        # Session should be suspended.
        assert await store.get_status("s1") == "suspended"
