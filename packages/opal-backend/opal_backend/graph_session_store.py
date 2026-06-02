# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""GraphSessionStore protocol — graph execution state coordination.

Stores graph execution state and coordinates node scheduling.
This is separate from ``SessionStore`` (agent sessions). Graph
sessions use task-per-node coordination; agent sessions use the
existing ``sessions/api.py`` flow. Both share ``EventBus`` for
live event delivery.

Only stdlib + typing — no external deps (synced to production).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from .graph_types import GraphPlan

__all__ = [
    "GraphSessionStore",
    "SuspendedNodeState",
]


@dataclass
class SuspendedNodeState:
    """State saved when a node suspends (waiting for user input).

    Attributes:
        node_id: The suspended node.
        interaction_id: Unique ID for this suspend/resume cycle.
        context: Opaque state the node handler needs on resume.
    """

    node_id: str
    interaction_id: str
    context: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class GraphSessionStore(Protocol):
    """Graph execution state and node scheduling coordination.

    Implementations:
    - ``InMemoryGraphSessionStore`` (``local/``) — dict-backed, dev server
    - Production — database with atomic operations
    """

    # ── Plan Storage ──

    async def create(
        self, session_id: str, plan: GraphPlan,
        *,
        headless_inputs: dict[str, Any] | None = None,
    ) -> None:
        """Store plan with initial dependency counts.

        Args:
            headless_inputs: Optional mapping of node_id → LLMContent
                for headless mode. When set, input nodes auto-resolve
                using pre-supplied values instead of suspending.
        """
        ...

    async def get_plan(
        self, session_id: str,
    ) -> GraphPlan | None:
        """Load the stored plan."""
        ...

    # ── Node Lifecycle ──

    async def complete_node(
        self, session_id: str, node_id: str, outputs: dict[str, Any],
    ) -> list[str]:
        """Atomically mark node complete, return newly-ready node IDs.

        This is THE coordination point. Must guarantee:
        - Outputs are persisted before downstream checks
        - When concurrent nodes complete, each downstream is
          triggered exactly once (when its last dep completes)
        """
        ...

    async def get_node_inputs(
        self, session_id: str, node_id: str,
    ) -> dict[str, list[Any]]:
        """Load upstream node outputs that are this node's inputs.

        Returns a dict mapping input port → values gathered from
        upstream node outputs connected to this port.
        """
        ...

    async def get_node_config(
        self, session_id: str, node_id: str,
    ) -> dict[str, Any]:
        """Load node configuration from the stored plan."""
        ...

    # ── Headless Inputs ──

    async def get_headless_input(
        self, session_id: str, node_id: str,
    ) -> Any | None:
        """Look up a pre-supplied input for headless mode.

        Returns the LLMContent value for the given node ID, or None
        if no headless input was provided (or session is interactive).
        """
        ...

    async def is_headless_session(
        self, session_id: str,
    ) -> bool:
        """Return True if the session was created in headless mode.

        A session is headless when ``headless_inputs`` was provided
        to ``create()`` (even if the dict is empty).
        """
        ...

    # ── Suspend / Resume ──

    async def suspend_node(
        self, session_id: str, node_id: str,
        interaction_id: str,
        state: SuspendedNodeState,
    ) -> None:
        """Save suspended node state. Task ends after this."""
        ...

    async def load_suspended_node(
        self, session_id: str, interaction_id: str,
    ) -> tuple[str, SuspendedNodeState] | None:
        """Load suspended node by interaction ID. Returns (nodeId, state)."""
        ...

    # ── Graph Lifecycle ──

    async def is_graph_complete(
        self, session_id: str,
    ) -> bool:
        """True when all nodes are completed (or skipped)."""
        ...

    async def get_graph_outputs(
        self, session_id: str,
    ) -> dict[str, Any]:
        """Load final outputs from all completed nodes."""
        ...

    async def mark_node_failed(
        self, session_id: str, node_id: str, error: str,
    ) -> list[str]:
        """Mark node failed, skip dependents, return newly-ready nodes.

        When a node fails, dependents that have no other path are
        marked as skipped. Dependents that have alternative completed
        paths may still become ready.
        """
        ...

    # ── Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any],
    ) -> int:
        """Append event to the session log. Returns event index."""
        ...

    async def get_events(
        self, session_id: str, *, after: int = -1,
    ) -> list[dict[str, Any]]:
        """Return events with index > after."""
        ...

    # ── Status ──

    async def get_status(
        self, session_id: str,
    ) -> str | None:
        """Return session status (running, suspended, completed, etc.)."""
        ...

    async def set_status(
        self, session_id: str, status: str,
    ) -> None:
        """Set session status."""
        ...
