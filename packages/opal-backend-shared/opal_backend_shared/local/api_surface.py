# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Shared API surface for Opal backend wrappers.

This module is NOT synced to the production backend — it lives in the `local/`
directory. The production backend has its own HTTP plumbing.

Usage:
    from opal_backend_shared.local.api_surface import create_api_router

    router = create_api_router(backend=my_backend_impl)
    app.include_router(router)
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class StartRunRequest(BaseModel):
    """Request to start an agent run."""
    scenario: str = "echo"


class StartRunResponse(BaseModel):
    """Response from starting an agent run."""
    run_id: str
    scenario: str


class InputRequest(BaseModel):
    """Client response to a suspend event."""
    request_id: str
    response: dict | None = None


# ---------------------------------------------------------------------------
# Backend protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class AgentBackend(Protocol):
    """What each wrapper must implement for agent-run endpoints."""

    async def start_run(self, scenario: str) -> StartRunResponse: ...

    async def event_stream(self, run_id: str) -> EventSourceResponse: ...

    async def submit_input(
        self, run_id: str, request_id: str, response: Any
    ) -> dict: ...

    async def abort_run(self, run_id: str) -> dict: ...


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
        agent: Handler for /api/agent/* endpoints (optional).
        proxy: Handler for v1beta1/* proxy endpoints (optional).
    """
    router = APIRouter()

    # ----- Agent endpoints -----
    if agent is not None:

        @router.post("/api/agent/run")
        async def start_run(req: StartRunRequest) -> StartRunResponse:
            return await agent.start_run(req.scenario)

        @router.get("/api/agent/{run_id}/events")
        async def event_stream(run_id: str) -> EventSourceResponse:
            return await agent.event_stream(run_id)

        @router.post("/api/agent/{run_id}/input")
        async def submit_input(run_id: str, req: InputRequest) -> dict:
            return await agent.submit_input(
                run_id, req.request_id, req.response
            )

        @router.post("/api/agent/{run_id}/abort")
        async def abort_run(run_id: str) -> dict:
            return await agent.abort_run(run_id)

    # ----- Proxy endpoints -----
    if proxy is not None:

        @router.api_route(
            "/v1beta1/{path:path}",
            methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        )
        async def proxy_v1beta1(request: Request) -> Response:
            return await proxy.proxy(request)

    return router
