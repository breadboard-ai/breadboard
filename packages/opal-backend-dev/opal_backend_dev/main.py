# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Opal dev backend server.

Reverse-proxies all v1beta1/* requests to One Platform, forwarding
auth headers as-is. Agent-run endpoints use the real Gemini loop
from opal-backend-shared with system termination functions.

Run with: uvicorn opal_backend_dev.main:app --reload --port 8080
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from opal_backend_shared.agent_events import (
    AgentEventSink,
    build_hooks_from_sink,
)
from opal_backend_shared.functions.system import get_system_function_group
from opal_backend_shared.local.api_surface import (
    StartRunResponse,
    create_api_router,
)
from opal_backend_shared.loop import (
    AgentRunArgs,
    Loop,
    LoopController,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Opal Dev Backend",
    description="Local development backend for Opal",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# The target for proxying existing One Platform APIs.
# Set by start-dev-backend.sh from unified-server's .env file.
UPSTREAM_BASE = os.environ.get(
    "PROXY_UPSTREAM_URL",
    "https://appcatalyst.pa.googleapis.com",
)



# Persistent HTTP client for proxying.
_client = httpx.AsyncClient(timeout=120.0)


# ---------------------------------------------------------------------------
# Proxy implementation
# ---------------------------------------------------------------------------

class DevProxyBackend:
    """Forwards v1beta1/* requests to One Platform."""

    async def proxy(self, request: Request) -> Response:
        # Build the upstream URL.
        # request.url.path is like /v1beta1/executeStep
        upstream_url = f"{UPSTREAM_BASE}{request.url.path}"
        if request.url.query:
            upstream_url += f"?{request.url.query}"

        # Forward headers (including Authorization).
        headers = dict(request.headers)
        # Remove hop-by-hop headers that shouldn't be forwarded.
        for h in ("host", "transfer-encoding"):
            headers.pop(h, None)

        body = await request.body()

        upstream_resp = await _client.request(
            method=request.method,
            url=upstream_url,
            headers=headers,
            content=body,
        )

        # Forward the upstream response back to the client.
        return Response(
            content=upstream_resp.content,
            status_code=upstream_resp.status_code,
            headers=dict(upstream_resp.headers),
        )


# ---------------------------------------------------------------------------
# Agent backend — real Gemini loop
# ---------------------------------------------------------------------------

class DevAgentBackend:
    """Implements AgentBackend using the real Python agent loop.

    Each ``start_run()`` creates a Loop with system termination functions,
    starts the loop as a background asyncio task, and stores the event
    sink. ``event_stream()`` drains the sink into an SSE stream.

    The access token for Gemini API calls will be forwarded from the
    user's request headers once the request-scoped auth plumbing is
    wired (Phase 4.4d+).
    """

    def __init__(self) -> None:
        # Active runs: run_id → (task, sink, controller)
        self._runs: dict[
            str,
            tuple[asyncio.Task, AgentEventSink, LoopController],
        ] = {}

    async def start_run(self, scenario: str) -> StartRunResponse:
        run_id = str(uuid.uuid4())

        # Create the event sink and hooks.
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        # Create the loop + controller.
        controller = LoopController()
        loop = Loop(controller=controller)

        # Wire up system functions (termination only for now).
        system_group = get_system_function_group(controller)

        # Build the objective content.
        objective: dict = {
            "parts": [{"text": f"Scenario: {scenario}"}],
            "role": "user",
        }

        run_args = AgentRunArgs(
            objective=objective,
            function_groups=[system_group],
            hooks=hooks,
        )

        # Start the loop as a background task.
        async def run_loop() -> None:
            try:
                result = await loop.run(run_args)
                # Emit the final complete event.
                sink.emit({
                    "type": "complete",
                    "result": {
                        "success": result.success
                        if hasattr(result, "success")
                        else False,
                        "outcomes": result.outcomes
                        if hasattr(result, "outcomes")
                        else None,
                    },
                })
            except Exception as e:
                logger.exception("Loop failed for run %s", run_id)
                sink.emit({
                    "type": "error",
                    "message": str(e),
                })
            finally:
                sink.close()

        task = asyncio.create_task(run_loop())
        self._runs[run_id] = (task, sink, controller)

        return StartRunResponse(run_id=run_id, scenario=scenario)

    async def event_stream(self, run_id: str) -> EventSourceResponse:
        entry = self._runs.get(run_id)
        if entry is None:
            return EventSourceResponse(
                content=iter([]),
                status_code=404,
            )

        _, sink, _ = entry

        async def generate():
            async for event in sink:
                event_type = event.get("type", "message")
                yield {
                    "event": event_type,
                    "data": json.dumps(event),
                }

        return EventSourceResponse(content=generate())

    async def submit_input(
        self, run_id: str, request_id: str, response
    ) -> dict:
        # Input handling will be added in a later phase when we port
        # the suspend/resume pattern (waitForInput, waitForChoice).
        return {"status": "not_implemented"}

    async def abort_run(self, run_id: str) -> dict:
        entry = self._runs.pop(run_id, None)
        if entry is None:
            return {"status": "not_found"}

        task, sink, controller = entry
        # Terminate the controller — the loop will exit on next iteration.
        from opal_backend_shared.loop import AgentResult

        controller.terminate(
            AgentResult(success=False, outcomes={"parts": [{"text": "Aborted"}]})
        )
        sink.close()
        task.cancel()
        return {"status": "aborted"}


# ---------------------------------------------------------------------------
# Wire it up
# ---------------------------------------------------------------------------

_proxy = DevProxyBackend()
_agent = DevAgentBackend()

router = create_api_router(
    proxy=_proxy,
    agent=_agent,
)
app.include_router(router)


@app.get("/")
async def root():
    """Landing page."""
    return {
        "name": "Opal Dev Backend",
        "upstream": UPSTREAM_BASE,
        "agent": "active",
        "status": "proxy active — all v1beta1/* forwarded to upstream",
    }

