# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Opal dev backend server.

Reverse-proxies all v1beta1/* requests to One Platform, forwarding
auth headers as-is. Agent-run endpoints will be wired in a later phase.

Run with: uvicorn opal_backend_dev.main:app --reload --port 8080
"""

from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from opal_backend_shared.local.api_surface import create_api_router

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
# Wire it up
# ---------------------------------------------------------------------------

_proxy = DevProxyBackend()
router = create_api_router(proxy=_proxy)
app.include_router(router)


@app.get("/")
async def root():
    """Landing page."""
    return {
        "name": "Opal Dev Backend",
        "upstream": UPSTREAM_BASE,
        "status": "proxy active — all v1beta1/* forwarded to upstream",
    }
