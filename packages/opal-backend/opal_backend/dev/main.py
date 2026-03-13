# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Opal dev backend server.

Reverse-proxies all v1beta1/* requests to One Platform, forwarding
auth headers as-is. Agent runs use the real Gemini loop from
opal-backend-shared with system termination functions.

Protocol:
    POST /v1beta1/streamRunAgent → SSE stream (Resumable Stream Protocol)
    Body (segments): {"kind": "...", "segments": [...], "flags": {...}}
    Body (legacy):   {"kind": "...", "objective": {...}}

Run with: uvicorn opal_backend.dev.main:app --reload --port 8080
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

from opal_backend.events import ErrorEvent
from opal_backend.local.api_surface import create_api_router
from opal_backend.local.backend_client_impl import HttpBackendClient
from opal_backend.local.drive_operations_client_impl import (
    HttpDriveOperationsClient,
)

from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from opal_backend.sessions.endpoints import SessionDeps, create_session_router
from opal_backend.sessions.api import (
    Subscribers, new_session, register_task, start_session,
    resume_session as resume_session_fn, update_context,
)
from opal_backend.sessions.store import SessionStatus

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

# Persistent HTTP client for proxying (raw httpx — proxy needs full request control).
_proxy_client = httpx.AsyncClient(timeout=120.0)

# In-memory store for suspended interactions (dev only).
_interaction_store = InMemoryInteractionStore()

# In-memory store for sessions (dev only).
_session_store = InMemorySessionStore()
_subscribers = Subscribers()
_session_deps = SessionDeps(
    backend_factory=lambda token, origin: HttpBackendClient(
        upstream_base=UPSTREAM_BASE,
        httpx_client=httpx.AsyncClient(timeout=120.0),
        access_token=token,
        origin=origin,
    ),
    drive_factory=lambda token: HttpDriveOperationsClient(
        httpx_client=httpx.AsyncClient(timeout=120.0),
        access_token=token,
    ),
    interaction_store=_interaction_store,
)
_session_router = create_session_router(
    _session_store, _subscribers, deps=_session_deps,
)


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

        upstream_resp = await _proxy_client.request(
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
    """Implements AgentBackend using the session-backed agent loop.

    Single POST /v1beta1/streamRunAgent → SSE stream.
    Under the hood, creates a session, starts/resumes the loop, and
    streams events from the subscriber queue — backward-compatible
    shim over the session API.

    Handles both start and resume requests:
    - **Start**: ``{kind, segments/objective}`` — creates a new session
    - **Resume**: ``{interactionId, response}`` — finds the suspended
      session and resumes it
    """

    async def run(self, request: Request) -> EventSourceResponse:
        raw_body = await request.json()

        # Extract access token from body (required — matches session API).
        access_token = raw_body.pop("accessToken", "")
        if not access_token:
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                access_token = auth_header[len("Bearer "):]

        # OP validates Origin to identify the requesting app.
        origin = request.headers.get("origin", "")

        # Unwrap proto oneof envelope:
        #   {start: {kind, segments, flags}}  → start run
        #   {resume: {interactionId, response}} → resume run
        if "resume" in raw_body:
            resume = raw_body["resume"]
            return await self._resume(
                resume.get("interactionId", ""),
                resume.get("response", {}),
                access_token, origin,
            )
        elif "start" in raw_body:
            return await self._start(raw_body["start"], access_token, origin)
        else:
            # Flat format fallback (legacy / dev tooling).
            interaction_id = raw_body.get("interactionId")
            if interaction_id:
                return await self._resume(
                    interaction_id, raw_body.get("response", {}),
                    access_token, origin,
                )
            else:
                return await self._start(raw_body, access_token, origin)

    async def _start(
        self, body: dict, access_token: str, origin: str,
    ) -> EventSourceResponse:
        """Start a new agent run via the session API."""
        segments = body.get("segments")
        flags = body.get("flags", {})

        if not segments:
            return _error_stream(
                "Missing 'segments' in request body"
            )

        graph_info = body.get("graph")
        session_id = f"sess-{uuid.uuid4().hex[:12]}"

        backend = HttpBackendClient(
            upstream_base=UPSTREAM_BASE,
            httpx_client=httpx.AsyncClient(timeout=120.0),
            access_token=access_token,
            origin=origin,
        )
        drive = HttpDriveOperationsClient(
            httpx_client=httpx.AsyncClient(timeout=120.0),
            access_token=access_token,
        )

        await new_session(
            session_id=session_id,
            segments=segments,
            store=_session_store,
            backend=backend,
            interaction_store=_interaction_store,
            flags=flags,
            graph=graph_info,
            drive=drive,
        )

        # Subscribe BEFORE starting the loop so we don't miss events.
        queue = _subscribers.subscribe(session_id)

        task = asyncio.create_task(
            start_session(
                session_id=session_id,
                store=_session_store,
                subscribers=_subscribers,
            ),
            name=f"shim-{session_id}",
        )
        register_task(session_id, task)

        return self._stream_queue(session_id, queue)

    async def _resume(
        self, interaction_id: str, response: dict,
        access_token: str, origin: str,
    ) -> EventSourceResponse:
        """Resume a suspended agent run via the session API."""
        # Find the session that owns this interaction_id.
        session_id = await _session_store.get_session_by_resume_id(
            interaction_id,
        )
        if not session_id:
            return _error_stream(
                f"No suspended session for interaction: {interaction_id}"
            )

        # Refresh clients with the (possibly updated) token.
        if access_token:
            update_context(
                session_id,
                backend=HttpBackendClient(
                    upstream_base=UPSTREAM_BASE,
                    httpx_client=httpx.AsyncClient(timeout=120.0),
                    access_token=access_token,
                    origin=origin,
                ),
                drive=HttpDriveOperationsClient(
                    httpx_client=httpx.AsyncClient(timeout=120.0),
                    access_token=access_token,
                ),
            )

        await _session_store.set_status(
            session_id, SessionStatus.RUNNING,
        )

        # Subscribe BEFORE resuming.
        queue = _subscribers.subscribe(session_id)

        task = asyncio.create_task(
            resume_session_fn(
                session_id=session_id,
                response=response,
                store=_session_store,
                subscribers=_subscribers,
            ),
            name=f"shim-resume-{session_id}",
        )
        register_task(session_id, task)

        return self._stream_queue(session_id, queue)

    def _stream_queue(
        self, session_id: str, queue: asyncio.Queue,
    ) -> EventSourceResponse:
        """Stream events from a subscriber queue as SSE."""
        async def stream():
            try:
                while True:
                    item = await queue.get()
                    if item is None:
                        break  # Session ended.
                    yield {"data": json.dumps(item)}
            finally:
                _subscribers.unsubscribe(session_id, queue)
        return EventSourceResponse(content=stream())


def _error_stream(message: str) -> EventSourceResponse:
    """Return an SSE stream with a single error event."""
    async def generate():
        event = ErrorEvent(message=message)
        yield {
            "data": json.dumps(event.to_dict()),
        }
    return EventSourceResponse(content=generate())


# ---------------------------------------------------------------------------
# Wire it up
# ---------------------------------------------------------------------------

_proxy = DevProxyBackend()
_agent = DevAgentBackend()

# ---------------------------------------------------------------------------
# CreateCachedContent — dedicated endpoint (before catch-all proxy)
# ---------------------------------------------------------------------------

GEMINI_KEY = os.environ.get("GEMINI_KEY", "")
GENAI_CACHE_URL = "https://generativelanguage.googleapis.com/v1beta/cachedContents"


@app.post("/v1beta1/createCachedContent")
async def create_cached_content(request: Request) -> Response:
    """Create cached content via the Gemini API.

    Mirrors the production backend's CreateCachedContent RPC.
    The Gemini cache API does not support OAuth, so the dev server
    hides the API key behind the user's OAuth-authenticated request.
    """
    if not GEMINI_KEY:
        return Response(
            content=json.dumps({"errorMessage": "GEMINI_KEY not set in .env"}),
            status_code=500,
            media_type="application/json",
        )

    body = await request.json()
    cached_content = body.get("cachedContent", {})

    resp = await _proxy_client.post(
        f"{GENAI_CACHE_URL}?key={GEMINI_KEY}",
        json=cached_content,
        headers={"Content-Type": "application/json"},
    )

    if resp.status_code == 200:
        resp_body = json.loads(resp.content)
        # Wrap in the CreateCachedContentResponse envelope
        # to match the production protobuf shape.
        wrapped = json.dumps({"cachedContent": resp_body})
        return Response(
            content=wrapped,
            status_code=200,
            media_type="application/json",
        )
    else:
        error_body = resp.content.decode("utf-8", errors="replace")
        return Response(
            content=json.dumps({"errorMessage": error_body}),
            status_code=resp.status_code,
            media_type="application/json",
        )


# ---------------------------------------------------------------------------
# Gemini model proxy — intercepts /{model}:{method} when enableGeminiBackend
# is false and calls route through OPAL_BACKEND_API_PREFIX instead of the
# public Gemini API. The dev server proxies these to the real Gemini API
# using GEMINI_KEY (same auth pattern as createCachedContent above).
# ---------------------------------------------------------------------------

GENAI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"


@app.post("/v1beta1/models/{model}:generateContent")
async def proxy_generate_content(model: str, request: Request) -> Response:
    """Proxy a generateContent call to the Gemini API."""
    return await _proxy_gemini_model_call(model, "generateContent", request)


@app.post("/v1beta1/models/{model}:streamGenerateContent")
async def proxy_stream_generate_content(
    model: str, request: Request
) -> Response:
    """Proxy a streamGenerateContent call to the Gemini API.

    Uses a streaming response to forward SSE chunks in real time.
    """
    return await _stream_gemini_model_call(
        model, "streamGenerateContent", request
    )


def _gemini_upstream_url(model: str, method: str, query: str) -> str:
    """Build the upstream Gemini API URL with API key auth."""
    url = f"{GENAI_MODELS_URL}/{model}:{method}?key={GEMINI_KEY}"
    if query:
        url += f"&{query}"
    return url


async def _proxy_gemini_model_call(
    model: str, method: str, request: Request
) -> Response:
    """Forward a non-streaming Gemini model call with API key auth."""
    if not GEMINI_KEY:
        return Response(
            content=json.dumps({"errorMessage": "GEMINI_KEY not set in .env"}),
            status_code=500,
            media_type="application/json",
        )

    upstream_url = _gemini_upstream_url(model, method, request.url.query)
    body = await request.body()

    resp = await _proxy_client.request(
        method="POST",
        url=upstream_url,
        content=body,
        headers={"Content-Type": "application/json"},
    )

    resp_headers = dict(resp.headers)
    for h in ("content-encoding", "content-length", "transfer-encoding"):
        resp_headers.pop(h, None)

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
    )


async def _stream_gemini_model_call(
    model: str, method: str, request: Request
) -> Response:
    """Forward a streaming Gemini model call, passing SSE chunks through."""
    if not GEMINI_KEY:
        return Response(
            content=json.dumps({"errorMessage": "GEMINI_KEY not set in .env"}),
            status_code=500,
            media_type="application/json",
        )

    from starlette.responses import StreamingResponse

    upstream_url = _gemini_upstream_url(model, method, request.url.query)
    body = await request.body()

    # Use a separate client for streaming so we don't hold the shared
    # _proxy_client's connection pool open for the duration.
    stream_client = httpx.AsyncClient(timeout=120.0)

    async def generate():
        try:
            async with stream_client.stream(
                "POST",
                upstream_url,
                content=body,
                headers={"Content-Type": "application/json"},
            ) as resp:
                if not resp.is_success:
                    error = await resp.aread()
                    yield error
                    return
                async for chunk in resp.aiter_bytes():
                    yield chunk
        finally:
            await stream_client.aclose()

    return StreamingResponse(
        content=generate(),
        media_type="text/event-stream",
    )


router = create_api_router(
    proxy=_proxy,
    agent=_agent,
    sessions=_session_router,
)
app.include_router(router)


@app.get("/")
async def root():
    """Landing page."""
    return {
        "name": "Opal Dev Backend",
        "upstream": UPSTREAM_BASE,
        "agent": "active (Resumable Stream Protocol)",
        "endpoint": "POST /v1beta1/streamRunAgent → SSE stream",
    }
