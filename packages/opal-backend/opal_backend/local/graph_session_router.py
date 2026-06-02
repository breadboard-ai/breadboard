# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph session REST API endpoints (FastAPI transport layer).

Parallel to ``session_router.py`` for agent sessions. This module
provides the HTTP endpoints for graph execution:

    POST /v1beta1/graphSessions/new    → start a graph run
    GET  /v1beta1/graphSessions/{id}   → SSE stream (replay + live)
    GET  /v1beta1/graphSessions/{id}/status → lightweight status
    POST /v1beta1/graphSessions/{id}:cancel → cancel running tasks
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from ..event_bus import EventBus
from ..graph_condense import condense
from ..graph_plan import create_plan
from ..graph_runner import GraphRunner
from ..graph_session_store import GraphSessionStore
from ..graph_types import GraphDescriptor
from ..task_scheduler import TaskScheduler

__all__ = ["create_graph_session_router"]


def create_graph_session_router(
    *,
    store: GraphSessionStore,
    event_bus: EventBus,
    runner: GraphRunner,
    scheduler: TaskScheduler,
    drive_client_factory: Any | None = None,
) -> APIRouter:
    """Create a FastAPI router with graph session endpoints.

    Args:
        store: GraphSessionStore for graph execution state.
        event_bus: EventBus for live SSE event delivery.
        runner: GraphRunner for node task execution.
        scheduler: TaskScheduler for cancellation support.
        drive_client_factory: Optional callable ``(access_token: str) -> DriveOperationsClient``.
            Required when clients use ``graphId`` to load graphs from Drive.
    """
    router = APIRouter(prefix="/v1beta1/graphSessions")

    @router.post("/new")
    async def create_graph_session(request: Request) -> JSONResponse:
        """Start a new graph run.

        Body: {graph: GraphDescriptor, accessToken?: str}
              OR {graphId: str, accessToken: str}

        Optional:
            mode: "interactive" (default) or "headless"
            inputs: {nodeId: LLMContent, ...}  (headless pre-supplied inputs)
        """
        body = await request.json()
        graph_data = body.get("graph")
        graph_id = body.get("graphId")

        if not graph_data and not graph_id:
            return JSONResponse(
                {"error": "Missing 'graph' or 'graphId' in request body"},
                status_code=400,
            )

        # Extract user's OAuth token (same pattern as session_router).
        access_token = body.get("accessToken", "")
        origin = request.headers.get("origin", "")

        # Load graph from Drive if graphId is provided.
        if graph_id:
            if not access_token:
                return JSONResponse(
                    {"error": "'accessToken' is required when using 'graphId'"},
                    status_code=400,
                )
            if drive_client_factory is None:
                return JSONResponse(
                    {"error": "Drive graph loading is not configured"},
                    status_code=500,
                )
            try:
                drive_client = drive_client_factory(access_token)
                file_bytes = await drive_client.get_file_media(graph_id)
                graph_data = json.loads(file_bytes)
            except (ValueError, json.JSONDecodeError) as exc:
                return JSONResponse(
                    {"error": f"Failed to load graph from Drive: {exc}"},
                    status_code=400,
                )

        # Parse, condense (break cycles), and plan.
        graph = GraphDescriptor.from_dict(graph_data)
        condensed = condense(graph)
        plan = create_plan(condensed)

        if not plan.stages:
            return JSONResponse(
                {"error": "Graph has no executable nodes"},
                status_code=400,
            )

        session_id = str(uuid.uuid4())

        # Headless mode: pass pre-supplied inputs to the store.
        mode = body.get("mode", "interactive")
        inputs = body.get("inputs", {})
        headless_inputs = inputs if mode == "headless" else None

        # Store the plan and kick off initial tasks.
        await store.create(session_id, plan, headless_inputs=headless_inputs)
        await runner.start_graph(
            session_id, access_token=access_token, origin=origin,
        )

        return JSONResponse({"sessionId": session_id})

    @router.get("/{session_id}")
    async def stream_graph_events(
        request: Request, session_id: str, after: int = -1,
    ) -> EventSourceResponse:
        """SSE stream: replay stored events, then live events.

        Query params:
            after: Only return events with index > this value.
                   Default -1 means all events.
        """
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Graph session not found"}, status_code=404,
            )

        async def event_generator():
            yield {
                "event": "start",
                "data": json.dumps({"sessionId": session_id}),
            }

            # Phase 1: replay stored events.
            events = await store.get_events(session_id, after=after)
            next_index = after + 1
            for i, event in enumerate(events):
                idx = next_index + i
                yield {
                    "event": "event",
                    "id": str(idx),
                    "data": json.dumps({**event, "index": idx}),
                }
            next_index += len(events)

            # Phase 2: subscribe for live events if still running.
            current_status = await store.get_status(session_id)
            if current_status in ("running", "suspended"):
                subscription = event_bus.subscribe(session_id)
                try:
                    async for item in subscription:
                        yield {
                            "event": "event",
                            "id": str(next_index),
                            "data": json.dumps(
                                {**item, "index": next_index},
                            ),
                        }
                        next_index += 1
                finally:
                    event_bus.unsubscribe(session_id, subscription)

            yield {"event": "done", "data": "{}"}

        return EventSourceResponse(
            content=event_generator(),
            media_type="text/event-stream",
        )

    @router.get("/{session_id}/status")
    async def get_graph_status(session_id: str) -> JSONResponse:
        """Lightweight status check."""
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Graph session not found"}, status_code=404,
            )
        return JSONResponse({"sessionId": session_id, "status": status})

    @router.post("/{session_id}:cancel")
    async def cancel_graph_session(session_id: str) -> JSONResponse:
        """Cancel all running node tasks in the session."""
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Graph session not found"}, status_code=404,
            )

        await scheduler.cancel(session_id)
        await store.set_status(session_id, "cancelled")
        await event_bus.publish(session_id, {
            "type": "graphCancelled", "sessionId": session_id,
        })
        await event_bus.close(session_id)

        return JSONResponse({
            "sessionId": session_id, "status": "cancelled",
        })

    @router.post("/{session_id}:resume")
    async def resume_graph_session(
        request: Request, session_id: str,
    ) -> JSONResponse:
        """Resume a suspended node after user input.

        Body: {interactionId: str, response: dict}
        """
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Graph session not found"}, status_code=404,
            )

        body = await request.json()
        interaction_id = body.get("interactionId")
        if not interaction_id:
            return JSONResponse(
                {"error": "Missing 'interactionId' in request body"},
                status_code=400,
            )

        response = body.get("response", {})

        try:
            await runner.resume_node(
                session_id, interaction_id, response,
            )
        except ValueError as exc:
            return JSONResponse(
                {"error": str(exc)}, status_code=404,
            )

        return JSONResponse({
            "sessionId": session_id, "status": "running",
        })

    return router
