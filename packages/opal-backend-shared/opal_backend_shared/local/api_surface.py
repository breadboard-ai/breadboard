# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Shared API surface for Opal backend wrappers.

This module is NOT synced to the production backend — it lives in the `local/`
directory. The production backend has its own HTTP plumbing.

The Resumable Stream Protocol:
    POST /api/agent/run  →  SSE stream

Body (start):  {"kind": "...", "objective": {...}}
Body (resume): {"interactionId": "...", "response": {...}}

The handler receives the raw Request to extract both the JSON body
and the Authorization header (access token for Gemini API calls).

Usage:
    from opal_backend_shared.local.api_surface import create_api_router

    router = create_api_router(agent=my_backend_impl, proxy=my_proxy)
    app.include_router(router)
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from fastapi import APIRouter, Request, Response
from sse_starlette.sse import EventSourceResponse


# ---------------------------------------------------------------------------
# Backend protocols
# ---------------------------------------------------------------------------

@runtime_checkable
class AgentBackend(Protocol):
    """What each wrapper must implement for the agent run endpoint.

    A single POST /api/agent/run that returns an SSE stream.
    The implementation receives the full Request to access both
    the JSON body and the Authorization header.
    """

    async def run(self, request: Request) -> EventSourceResponse: ...


@runtime_checkable
class ProxyBackend(Protocol):
    """What each wrapper must implement for proxying v1beta1/* requests."""

    async def proxy(self, request: Request) -> Response: ...


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------

def create_api_router(
    *,
    agent: AgentBackend | None = None,
    proxy: ProxyBackend | None = None,
) -> APIRouter:
    """Create a FastAPI router with the shared Opal API surface.

    Args:
        agent: Handler for POST /api/agent/run (optional).
        proxy: Handler for v1beta1/* proxy endpoints (optional).
    """
    router = APIRouter()

    # ----- Agent endpoint -----
    if agent is not None:

        @router.post("/api/agent/run")
        async def run(request: Request) -> EventSourceResponse:
            return await agent.run(request)

    # ----- Proxy endpoints -----
    if proxy is not None:

        @router.api_route(
            "/v1beta1/{path:path}",
            methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        )
        async def proxy_v1beta1(request: Request) -> Response:
            return await proxy.proxy(request)

    return router
