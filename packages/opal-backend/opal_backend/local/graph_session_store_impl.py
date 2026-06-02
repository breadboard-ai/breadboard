# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""InMemoryGraphSessionStore — dict-backed GraphSessionStore for dev server.

Stores all graph execution state in plain Python dicts. Single-process,
no concurrency hazards (asyncio cooperative multitasking = no races).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..graph_types import GraphPlan
from ..graph_session_store import SuspendedNodeState

__all__ = ["InMemoryGraphSessionStore"]


@dataclass
class _NodeState:
    """Per-node mutable state within a graph session."""

    pending_deps: int = 0
    outputs: dict[str, Any] | None = None
    status: str = "inactive"  # inactive | ready | running | completed | failed | skipped
    error: str | None = None


@dataclass
class _SessionState:
    """All state for a single graph session."""

    plan: GraphPlan
    nodes: dict[str, _NodeState] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    status: str = "running"
    suspended: dict[str, SuspendedNodeState] = field(default_factory=dict)
    # interaction_id → node_id
    interaction_index: dict[str, str] = field(default_factory=dict)
    # Headless mode: node_id → pre-supplied LLMContent value.
    headless_inputs: dict[str, Any] | None = None


class InMemoryGraphSessionStore:
    """Dict-backed implementation of GraphSessionStore.

    Suitable for dev / fake server use. All operations are O(nodes)
    at worst. No external dependencies.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, _SessionState] = {}

    # ── Plan Storage ──

    async def create(
        self, session_id: str, plan: GraphPlan,
        *,
        headless_inputs: dict[str, Any] | None = None,
    ) -> None:
        """Store plan with initial dependency counts."""
        state = _SessionState(plan=plan, headless_inputs=headless_inputs)

        # Compute per-node pending dep counts from plan stages.
        for stage in plan.stages:
            for info in stage:
                ns = _NodeState(
                    pending_deps=len(info.upstream),
                )
                # Entry nodes (no upstream) are immediately ready.
                if ns.pending_deps == 0:
                    ns.status = "ready"
                state.nodes[info.node.id] = ns

        self._sessions[session_id] = state

    async def get_plan(
        self, session_id: str,
    ) -> GraphPlan | None:
        """Load the stored plan."""
        s = self._sessions.get(session_id)
        return s.plan if s else None

    # ── Node Lifecycle ──

    async def complete_node(
        self, session_id: str, node_id: str, outputs: dict[str, Any],
    ) -> list[str]:
        """Mark node complete, decrement downstream deps, return newly-ready."""
        state = self._sessions[session_id]
        ns = state.nodes[node_id]
        ns.outputs = outputs
        ns.status = "completed"

        # Find downstream nodes from plan and decrement.
        newly_ready: list[str] = []
        for stage in state.plan.stages:
            for info in stage:
                if info.node.id != node_id:
                    continue
                for edge in info.downstream:
                    target_id = edge.to_node
                    target_ns = state.nodes.get(target_id)
                    if target_ns and target_ns.pending_deps > 0:
                        target_ns.pending_deps -= 1
                        if target_ns.pending_deps == 0:
                            target_ns.status = "ready"
                            newly_ready.append(target_id)
                break  # Node only appears once in the plan.

        return newly_ready

    async def get_node_inputs(
        self, session_id: str, node_id: str,
    ) -> dict[str, list[Any]]:
        """Gather upstream outputs connected to this node's input ports."""
        state = self._sessions[session_id]
        inputs: dict[str, list[Any]] = {}

        # Walk the plan to find upstream edges for this node.
        for stage in state.plan.stages:
            for info in stage:
                if info.node.id != node_id:
                    continue
                for edge in info.upstream:
                    upstream_ns = state.nodes.get(edge.from_node)
                    if not upstream_ns or upstream_ns.outputs is None:
                        continue
                    in_port = edge.in_port or "input"
                    out_port = edge.out_port or "output"
                    value = upstream_ns.outputs.get(out_port)
                    if value is not None:
                        inputs.setdefault(in_port, []).append(value)
                return inputs

        return inputs

    async def get_node_config(
        self, session_id: str, node_id: str,
    ) -> dict[str, Any]:
        """Load node configuration from the stored plan."""
        state = self._sessions[session_id]
        for stage in state.plan.stages:
            for info in stage:
                if info.node.id == node_id:
                    return info.node.configuration or {}
        return {}

    # ── Headless Inputs ──

    async def get_headless_input(
        self, session_id: str, node_id: str,
    ) -> Any | None:
        """Look up a pre-supplied input for headless mode."""
        state = self._sessions.get(session_id)
        if not state or state.headless_inputs is None:
            return None
        return state.headless_inputs.get(node_id)

    async def is_headless_session(
        self, session_id: str,
    ) -> bool:
        """Return True if the session was created in headless mode."""
        state = self._sessions.get(session_id)
        if not state:
            return False
        return state.headless_inputs is not None

    # ── Suspend / Resume ──

    async def suspend_node(
        self, session_id: str, node_id: str,
        interaction_id: str,
        suspended_state: SuspendedNodeState,
    ) -> None:
        """Save suspended node state."""
        state = self._sessions[session_id]
        ns = state.nodes[node_id]
        ns.status = "suspended"
        state.suspended[node_id] = suspended_state
        state.interaction_index[interaction_id] = node_id

    async def load_suspended_node(
        self, session_id: str, interaction_id: str,
    ) -> tuple[str, SuspendedNodeState] | None:
        """Load suspended node by interaction ID."""
        state = self._sessions.get(session_id)
        if not state:
            return None
        node_id = state.interaction_index.get(interaction_id)
        if not node_id:
            return None
        suspended = state.suspended.get(node_id)
        if not suspended:
            return None
        return (node_id, suspended)

    # ── Graph Lifecycle ──

    async def is_graph_complete(
        self, session_id: str,
    ) -> bool:
        """True when all nodes are in a terminal state."""
        state = self._sessions.get(session_id)
        if not state:
            return False
        return all(
            ns.status in ("completed", "skipped", "failed")
            for ns in state.nodes.values()
        )

    async def get_graph_outputs(
        self, session_id: str,
    ) -> dict[str, Any]:
        """Load outputs from all completed nodes."""
        state = self._sessions.get(session_id)
        if not state:
            return {}
        result: dict[str, Any] = {}
        for node_id, ns in state.nodes.items():
            if ns.outputs is not None:
                result[node_id] = ns.outputs
        return result

    async def mark_node_failed(
        self, session_id: str, node_id: str, error: str,
    ) -> list[str]:
        """Mark node failed, skip dependents without alternative paths."""
        state = self._sessions[session_id]
        ns = state.nodes[node_id]
        ns.status = "failed"
        ns.error = error

        # Find and skip downstream dependents that have no other path.
        skipped: list[str] = []
        to_skip = [node_id]
        while to_skip:
            current = to_skip.pop()
            for stage in state.plan.stages:
                for info in stage:
                    if info.node.id != current:
                        continue
                    for edge in info.downstream:
                        target_id = edge.to_node
                        target_ns = state.nodes.get(target_id)
                        if not target_ns:
                            continue
                        if target_ns.status in ("completed", "failed", "skipped"):
                            continue
                        # Check if target has any OTHER completed upstream.
                        has_alt = self._has_alternative_path(
                            state, target_id, node_id,
                        )
                        if not has_alt:
                            target_ns.status = "skipped"
                            skipped.append(target_id)
                            to_skip.append(target_id)

        # Return any nodes that are now newly ready (from other paths).
        newly_ready: list[str] = []
        for nid, nstate in state.nodes.items():
            if nstate.status == "ready" and nid not in skipped:
                newly_ready.append(nid)

        return newly_ready

    def _has_alternative_path(
        self, state: _SessionState, target_id: str, failed_id: str,
    ) -> bool:
        """Check if target has any completed upstream other than failed_id."""
        for stage in state.plan.stages:
            for info in stage:
                if info.node.id != target_id:
                    continue
                for edge in info.upstream:
                    if edge.from_node == failed_id:
                        continue
                    upstream_ns = state.nodes.get(edge.from_node)
                    if upstream_ns and upstream_ns.status == "completed":
                        return True
                return False
        return False

    # ── Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any],
    ) -> int:
        """Append event to session log. Returns event index."""
        state = self._sessions[session_id]
        idx = len(state.events)
        event_with_idx = {**event, "index": idx}
        state.events.append(event_with_idx)
        return idx

    async def get_events(
        self, session_id: str, *, after: int = -1,
    ) -> list[dict[str, Any]]:
        """Return events with index > after."""
        state = self._sessions.get(session_id)
        if not state:
            return []
        return [e for e in state.events if e.get("index", 0) > after]

    # ── Status ──

    async def get_status(
        self, session_id: str,
    ) -> str | None:
        """Return session status."""
        state = self._sessions.get(session_id)
        return state.status if state else None

    async def set_status(
        self, session_id: str, status: str,
    ) -> None:
        """Set session status."""
        state = self._sessions.get(session_id)
        if state:
            state.status = status
