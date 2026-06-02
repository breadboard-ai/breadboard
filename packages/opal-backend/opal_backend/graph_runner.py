# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph runner — per-node task execution logic.

Orchestrates the full lifecycle of a single node task:
1. Emit ``nodeStart`` event
2. Load inputs from ``GraphSessionStore``
3. Load config from the stored plan
4. Run the appropriate handler (with agent event forwarding)
5. Save outputs via ``complete_node()``
6. Schedule newly-ready downstream nodes
7. Check if graph is complete → emit ``graphComplete``
8. Emit ``nodeEnd`` event

Handles ``NodeSuspended`` — saves node state and emits
``inputRequired`` without completing the node.

Only stdlib + typing — no external deps (synced to production).
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Callable

from .backend_client import BackendClient
from .event_bus import EventBus
from .events import AgentEvent
from .graph_session_store import GraphSessionStore, SuspendedNodeState
from .interaction_store import InteractionStore
from .node_handlers import (
    NodeHandlerDeps,
    NodeSuspended,
    consume_agent_events,
    dispatch_handler,
)
from .task_scheduler import TaskScheduler

__all__ = ["GraphRunner"]


class GraphRunner:
    """Runs individual node tasks and coordinates the graph lifecycle.

    Wired together by the server entry point (``dev/main.py`` or
    ``fake/main.py``) with concrete implementations of the protocol
    dependencies.
    """

    def __init__(
        self,
        store: GraphSessionStore,
        event_bus: EventBus,
        scheduler: TaskScheduler,
        *,
        backend_factory: Callable[[str, str], BackendClient] | None = None,
        interaction_store: InteractionStore | None = None,
        run_agent_fn: Callable[..., AsyncIterator[AgentEvent]] | None = None,
        resume_agent_fn: Callable[..., AsyncIterator[AgentEvent]] | None = None,
    ) -> None:
        self._store = store
        self._event_bus = event_bus
        self._scheduler = scheduler
        self._backend_factory = backend_factory
        self._interaction_store = interaction_store
        self._run_agent_fn = run_agent_fn
        self._resume_agent_fn = resume_agent_fn
        # Per-session auth context, set by start_graph().
        self._session_auth: dict[str, tuple[str, str]] = {}

    async def start_graph(
        self, session_id: str,
        *,
        access_token: str = "",
        origin: str = "",
    ) -> None:
        """Start execution by scheduling all initially-ready nodes.

        Called once after ``store.create()`` has stored the plan.

        Args:
            access_token: User's OAuth token for backend API calls.
            origin: Request origin header for backend API calls.
        """
        # Store auth context so node tasks can create authenticated clients.
        self._session_auth[session_id] = (access_token, origin)

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
        except NodeSuspended as suspended:
            await self._handle_suspend(session_id, node_id, suspended)
        except Exception as exc:
            await self._handle_node_error(session_id, node_id, exc)

    async def resume_node(
        self, session_id: str, interaction_id: str,
        response: dict[str, Any],
    ) -> None:
        """Resume a suspended node after user input.

        Loads the suspended node state, re-runs the agent via
        ``resume_agent_fn``, and completes the node normally. If the
        agent suspends again, saves state and emits a new
        ``inputRequired``.
        """
        loaded = await self._store.load_suspended_node(
            session_id, interaction_id,
        )
        if not loaded:
            raise ValueError(
                f"No suspended node for interaction {interaction_id}",
            )

        node_id, suspended_state = loaded
        await self._store.set_status(session_id, "running")

        # Input nodes save context={"inputs": ..., "config": ...} and
        # don't use the agent InteractionStore. Complete them directly
        # with the user's response as the node output.
        is_input_node = "inputs" in suspended_state.context

        if is_input_node or not self._resume_agent_fn:
            # The response is form data keyed by schema property names,
            # e.g. {"request": {"role": "user", "parts": [...]}}. The
            # downstream node expects context: [LLMContent], so extract
            # the values — mirrors the TS askUser() which does
            # `const request = response.request as LLMContent`.
            context: list[Any] = []
            if response:
                for value in response.values():
                    if isinstance(value, dict) and "parts" in value:
                        context.append(value)
                    elif value is not None:
                        context.append(value)
            outputs = {"context": context}
            try:
                await self._complete_node(session_id, node_id, outputs)
            except Exception as exc:
                await self._handle_node_error(session_id, node_id, exc)
            return

        deps = self._build_handler_deps(session_id, node_id)

        try:
            agent_iter = self._resume_agent_fn(
                interaction_id=interaction_id,
                response=response,
                backend=deps.backend,
                store=self._interaction_store,
            )
            outputs = await consume_agent_events(
                agent_iter, deps, suspend_context=suspended_state.context,
            )
            await self._complete_node(session_id, node_id, outputs)
        except NodeSuspended as suspended:
            await self._handle_suspend(session_id, node_id, suspended)
        except Exception as exc:
            await self._handle_node_error(session_id, node_id, exc)

    # -------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------

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

        # 4. Load graph-level assets for template substitution.
        plan = await self._store.get_plan(session_id)
        assets = plan.assets if plan else {}

        # 5. Build handler deps.
        deps = self._build_handler_deps(session_id, node_id, assets)

        # 6. Determine node type and dispatch.
        node_type = await self._get_node_type(session_id, node_id)
        outputs = await dispatch_handler(node_type, inputs, config, deps)

        # 7. Complete node (save outputs, emit nodeEnd, schedule, check).
        await self._complete_node(session_id, node_id, outputs)

    async def _complete_node(
        self, session_id: str, node_id: str,
        outputs: dict[str, Any],
    ) -> None:
        """Save outputs, emit nodeEnd, schedule downstream, check done."""
        newly_ready = await self._store.complete_node(
            session_id, node_id, outputs,
        )

        await self._store.append_event(session_id, {
            "type": "nodeEnd", "nodeId": node_id, "outputs": outputs,
        })
        await self._event_bus.publish(session_id, {
            "type": "nodeEnd", "nodeId": node_id, "outputs": outputs,
        })

        for nid in newly_ready:
            await self._scheduler.schedule(session_id, nid)

        await self._check_graph_complete(session_id)

    async def _handle_node_error(
        self, session_id: str, node_id: str,
        exc: Exception,
    ) -> None:
        """Emit error, mark failed, schedule dependents, check done."""
        error_msg = f"{type(exc).__name__}: {exc}"
        await self._emit_node_error(session_id, node_id, error_msg)
        newly_ready = await self._store.mark_node_failed(
            session_id, node_id, error_msg,
        )
        for nid in newly_ready:
            await self._scheduler.schedule(session_id, nid)
        await self._check_graph_complete(session_id)

    def _build_handler_deps(
        self, session_id: str, node_id: str,
        assets: dict[str, Any] | None = None,
    ) -> NodeHandlerDeps:
        """Build handler dependencies for the current node."""

        async def on_agent_event(event_dict: dict[str, Any]) -> None:
            """Forward agent events wrapped with nodeId."""
            wrapped = {
                "type": "agentEvent",
                "nodeId": node_id,
                "event": event_dict,
            }
            await self._store.append_event(session_id, wrapped)
            await self._event_bus.publish(session_id, wrapped)

        async def on_thought_event(text: str) -> None:
            """Forward thought events from generateWebpageStream."""
            await self._event_bus.publish(session_id, {
                "type": "thoughtEvent",
                "nodeId": node_id,
                "text": text,
            })

        token, origin = self._session_auth.get(session_id, ("", ""))
        return NodeHandlerDeps(
            on_agent_event=on_agent_event,
            on_thought_event=on_thought_event,
            run_agent_fn=self._run_agent_fn,
            backend=self._backend_factory(token, origin) if self._backend_factory else None,
            interaction_store=self._interaction_store,
            assets=assets,
        )

    async def _handle_suspend(
        self, session_id: str, node_id: str,
        suspended: NodeSuspended,
    ) -> None:
        """Handle a NodeSuspended exception from a handler."""
        state = SuspendedNodeState(
            node_id=node_id,
            interaction_id=suspended.interaction_id,
            context=suspended.context,
        )
        await self._store.suspend_node(
            session_id, node_id,
            suspended.interaction_id, state,
        )
        await self._store.set_status(session_id, "suspended")

        # Emit inputRequired event.
        event = {
            "type": "inputRequired",
            "nodeId": node_id,
            "interactionId": suspended.interaction_id,
            "suspendEvent": suspended.suspend_event,
        }
        await self._store.append_event(session_id, event)
        await self._event_bus.publish(session_id, event)

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

