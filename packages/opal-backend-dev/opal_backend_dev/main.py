# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Opal dev backend server.

Reverse-proxies all v1beta1/* requests to One Platform, forwarding
auth headers as-is. Agent runs use the real Gemini loop from
opal-backend-shared with system termination functions.

Protocol:
    POST /api/agent/run → SSE stream (Resumable Stream Protocol)
    Body: {"kind": "...", "objective": {...}}

Run with: uvicorn opal_backend_dev.main:app --reload --port 8080
"""

from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from opal_backend_shared.agent_events import (
    AgentEventSink,
    build_hooks_from_sink,
)
from opal_backend_shared.functions.system import get_system_function_group
from opal_backend_shared.local.api_surface import create_api_router
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
        upstream_url = f"{UPSTREAM_BASE}{request.url.path}"
        if request.url.query:
            upstream_url += f"?{request.url.query}"

        # Forward headers (including Authorization).
        headers = dict(request.headers)
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
        # Strip encoding headers — httpx decompresses the body, so
        # forwarding Content-Encoding would cause ERR_CONTENT_DECODING_FAILED.
        resp_headers = dict(upstream_resp.headers)
        for h in ("content-encoding", "content-length", "transfer-encoding"):
            resp_headers.pop(h, None)

        return Response(
            content=upstream_resp.content,
            status_code=upstream_resp.status_code,
            headers=resp_headers,
        )


# ---------------------------------------------------------------------------
# Agent backend — real Gemini loop via Resumable Stream Protocol
# ---------------------------------------------------------------------------

class DevAgentBackend:
    """Implements AgentBackend using the real Python agent loop.

    Single POST /api/agent/run → SSE stream.

    The handler parses the request body, extracts the access token
    from the Authorization header, runs the Loop inline, and streams
    events directly back to the client as SSE.

    No background tasks or run maps needed — the HTTP response IS
    the event stream.
    """

    async def run(self, request: Request) -> EventSourceResponse:
        # Parse the request body.
        body = await request.json()

        # Extract access token from Authorization header.
        auth_header = request.headers.get("authorization", "")
        access_token = ""
        if auth_header.startswith("Bearer "):
            access_token = auth_header[len("Bearer "):]

        # Build the objective from the request body.
        objective = body.get("objective")
        if not objective:
            return _error_stream("Missing 'objective' in request body")

        # Create the event sink and hooks.
        sink = AgentEventSink()
        hooks = build_hooks_from_sink(sink)

        # Create the loop with auth.
        controller = LoopController()
        loop = Loop(access_token=access_token, controller=controller)

        # Wire up system functions (termination only for now).
        system_group = get_system_function_group(controller)

        run_args = AgentRunArgs(
            objective=objective,
            function_groups=[system_group],
            hooks=hooks,
        )

        async def generate():
            """Run the loop and yield SSE events."""
            try:
                result = await loop.run(run_args)

                # The loop returns err() dicts ({"$error": "message"})
                # on caught exceptions. Surface them as error events.
                if isinstance(result, dict) and "$error" in result:
                    sink.emit({
                        "type": "error",
                        "message": result["$error"],
                    })
                    sink.emit({
                        "type": "complete",
                        "result": {"success": False, "outcomes": None},
                    })
                else:
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
                logger.exception("Agent loop failed")
                sink.emit({
                    "type": "error",
                    "message": str(e),
                })
            finally:
                sink.close()

        async def stream():
            """Yield SSE-formatted events from the sink.

            We start the loop as a concurrent task so the sink can
            drain events as they're produced.
            """
            import asyncio

            loop_task = asyncio.create_task(generate())
            try:
                async for event in sink:
                    event_type = event.get("type", "message")
                    yield {
                        "event": event_type,
                        "data": json.dumps(event),
                    }
            finally:
                if not loop_task.done():
                    loop_task.cancel()

        return EventSourceResponse(content=stream())


def _error_stream(message: str) -> EventSourceResponse:
    """Return an SSE stream with a single error event."""
    async def generate():
        yield {
            "event": "error",
            "data": json.dumps({"type": "error", "message": message}),
        }
    return EventSourceResponse(content=generate())


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
        "agent": "active (Resumable Stream Protocol)",
        "endpoint": "POST /api/agent/run → SSE stream",
    }
