# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph runner — per-node task execution logic.

Orchestrates the full lifecycle of a single node task:
1. Emit ``nodeStart`` event
2. Load inputs from ``GraphSessionStore``
3. Load config from the stored plan
4. Run the appropriate handler
5. Save outputs via ``complete_node()``
6. Schedule newly-ready downstream nodes
7. Check if graph is complete → emit ``graphComplete``
8. Emit ``nodeEnd`` event

Only stdlib + typing — no external deps (synced to production).
"""

from __future__ import annotations

import traceback
from typing import Any

from .event_bus import EventBus
from .graph_session_store import GraphSessionStore
from .node_handlers import dispatch_handler
from .task_scheduler import TaskScheduler

__all__ = ["GraphRunner"]


class GraphRunner:
    """Runs individual node tasks and coordinates the graph lifecycle.

    Wired together by the server entry point (``dev/main.py`` or
    ``fake/main.py``) with concrete implementations of the three
    protocol dependencies.
    """

    def __init__(
        self,
        store: GraphSessionStore,
        event_bus: EventBus,
        scheduler: TaskScheduler,
    ) -> None:
        self._store = store
        self._event_bus = event_bus
        self._scheduler = scheduler

    async def start_graph(
        self, session_id: str,
    ) -> None:
        """Start execution by scheduling all initially-ready nodes.

        Called once after ``store.create()`` has stored the plan.
        """
        plan = await self._store.get_plan(session_id)
        if not plan:
            return

        # Emit graphStart event.
        await self._store.append_event(session_id, {
            "type": "graphStart",
            "sessionId": session_id,
        })
        await self._event_bus.publish(session_id, {
            "type": "graphStart",
            "sessionId": session_id,
        })

        # Schedule all entry nodes (stage 0 — pending_deps == 0).
        if plan.stages:
            for info in plan.stages[0]:
                await self._scheduler.schedule(session_id, info.node.id)

    async def run_node(
        self, session_id: str, node_id: str,
    ) -> None:
        """Execute a single node task (full lifecycle).

        This is the callback passed to ``LocalTaskScheduler``.
        """
        try:
            await self._run_node_inner(session_id, node_id)
        except Exception as exc:
            # Node failed — mark it and skip dependents.
            error_msg = f"{type(exc).__name__}: {exc}"
            await self._emit_node_error(session_id, node_id, error_msg)
            newly_ready = await self._store.mark_node_failed(
                session_id, node_id, error_msg,
            )
            for nid in newly_ready:
                await self._scheduler.schedule(session_id, nid)
            await self._check_graph_complete(session_id)

    async def _run_node_inner(
        self, session_id: str, node_id: str,
    ) -> None:
        """Inner node execution — no error handling."""
        # 1. Emit nodeStart.
        await self._store.append_event(session_id, {
            "type": "nodeStart", "nodeId": node_id,
        })
        await self._event_bus.publish(session_id, {
            "type": "nodeStart", "nodeId": node_id,
        })

        # 2. Load inputs from upstream outputs.
        inputs = await self._store.get_node_inputs(session_id, node_id)

        # 3. Load node config.
        config = await self._store.get_node_config(session_id, node_id)

        # 4. Determine node type and dispatch.
        node_type = await self._get_node_type(session_id, node_id)
        outputs = await dispatch_handler(node_type, inputs, config)

        # 5. Save outputs and get newly-ready downstream nodes.
        newly_ready = await self._store.complete_node(
            session_id, node_id, outputs,
        )

        # 6. Emit nodeEnd.
        await self._store.append_event(session_id, {
            "type": "nodeEnd", "nodeId": node_id,
        })
        await self._event_bus.publish(session_id, {
            "type": "nodeEnd", "nodeId": node_id,
        })

        # 7. Schedule downstream.
        for nid in newly_ready:
            await self._scheduler.schedule(session_id, nid)

        # 8. Check if graph is complete.
        await self._check_graph_complete(session_id)

    async def _get_node_type(
        self, session_id: str, node_id: str,
    ) -> str:
        """Look up node type from the stored plan."""
        plan = await self._store.get_plan(session_id)
        if plan:
            for stage in plan.stages:
                for info in stage:
                    if info.node.id == node_id:
                        return info.node.type
        return "unknown"

    async def _check_graph_complete(
        self, session_id: str,
    ) -> None:
        """Emit graphComplete if all nodes are done."""
        if await self._store.is_graph_complete(session_id):
            outputs = await self._store.get_graph_outputs(session_id)
            await self._store.set_status(session_id, "completed")
            await self._store.append_event(session_id, {
                "type": "graphComplete",
                "sessionId": session_id,
                "outputs": outputs,
            })
            await self._event_bus.publish(session_id, {
                "type": "graphComplete",
                "sessionId": session_id,
                "outputs": outputs,
            })
            # Close the event bus for this session.
            await self._event_bus.close(session_id)

    async def _emit_node_error(
        self, session_id: str, node_id: str, error: str,
    ) -> None:
        """Emit nodeError event."""
        await self._store.append_event(session_id, {
            "type": "nodeError", "nodeId": node_id, "error": error,
        })
        await self._event_bus.publish(session_id, {
            "type": "nodeError", "nodeId": node_id, "error": error,
        })
