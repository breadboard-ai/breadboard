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

import json
import logging
import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from opal_backend.backend_client import HttpBackendClient
from opal_backend.local.http_client_impl import HttpxClient

from opal_backend.agent_events import (
    AgentEventSink,
    build_hooks_from_sink,
)
from opal_backend.agent_file_system import AgentFileSystem
from opal_backend.events import (
    AgentResult,
    CompleteEvent,
    ErrorEvent,
    FileData,
)
from opal_backend.functions.system import get_system_function_group
from opal_backend.functions.generate import get_generate_function_group
from opal_backend.functions.image import get_image_function_group
from opal_backend.functions.video import get_video_function_group
from opal_backend.functions.audio import get_audio_function_group
from opal_backend.functions.chat import get_chat_function_group
from opal_backend.interaction_store import (
    InteractionStore,
    InteractionState,
)
from opal_backend.local.api_surface import create_api_router
from opal_backend.loop import (
    AgentRunArgs,
    Loop,
    LoopController,
)
from opal_backend.suspend import SuspendResult
from opal_backend.task_tree_manager import TaskTreeManager

from opal_backend.pidgin import to_pidgin, ToPidginResult

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

# HttpClient protocol impl for the agent loop and functions.
_http_client = HttpxClient(timeout=120.0)

# In-memory store for suspended interactions (dev only).
_interaction_store = InteractionStore()


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
# Helper: build function groups from config
# ---------------------------------------------------------------------------

def _build_function_groups(
    *,
    controller: LoopController,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    access_token: str,
    client: HttpxClient,
    backend: HttpBackendClient,
    enable_g1_quota: bool = False,
):
    """Build the standard set of function groups."""
    return [
        get_system_function_group(
            controller,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
        ),
        get_generate_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            client=client,
            backend=backend,
        ),
        get_image_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_video_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_audio_function_group(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        get_chat_function_group(
            task_tree_manager=task_tree_manager,
            file_system=file_system,
        ),
    ]


# ---------------------------------------------------------------------------
# Agent backend — real Gemini loop via Resumable Stream Protocol
# ---------------------------------------------------------------------------

class DevAgentBackend:
    """Implements AgentBackend using the real Python agent loop.

    Single POST /v1beta1/streamRunAgent → SSE stream.

    Handles both start and resume requests:
    - **Start**: ``{kind, segments/objective}`` — creates a new loop
    - **Resume**: ``{interactionId, response}`` — reconstructs the loop
      from saved state, injects the response, continues streaming

    Design decision: reconnect, not keepalive. The SSE stream closes
    when the loop suspends. Suspends can last seconds, hours, or days.
    """

    async def run(self, request: Request) -> EventSourceResponse:
        raw_body = await request.json()

        # Extract access token from Authorization header.
        auth_header = request.headers.get("authorization", "")
        access_token = ""
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
        """Start a new agent run."""
        # Create file system and task tree manager.
        file_system = AgentFileSystem()
        task_tree_manager = TaskTreeManager(file_system)

        # Build the objective — segments-based or legacy.
        segments = body.get("segments")
        flags = body.get("flags", {})
        enable_g1_quota = flags.get("googleOne", False)
        if segments is not None:
            use_notebooklm_flag = flags.get("useNotebookLM", False)

            pidgin_result = to_pidgin(
                segments,
                file_system,
                use_notebooklm_flag=use_notebooklm_flag,
            )

            if isinstance(pidgin_result, dict) and "$error" in pidgin_result:
                return _error_stream(pidgin_result["$error"])

            objective = {
                "parts": [{
                    "text": f"<objective>{pidgin_result.text}</objective>"
                }],
                "role": "user",
            }
        else:
            objective = body.get("objective")
            if not objective:
                return _error_stream(
                    "Missing 'segments' or 'objective' in request body"
                )

        controller = LoopController()
        backend = HttpBackendClient(
            upstream_base=UPSTREAM_BASE,
            client=_http_client,
            origin=origin,
        )
        function_groups = _build_function_groups(
            controller=controller,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            client=_http_client,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        )

        run_args = AgentRunArgs(
            objective=objective,
            function_groups=function_groups,
        )

        return self._stream_loop(
            run_args=run_args,
            controller=controller,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            origin=origin,
            backend=backend,
        )

    async def _resume(
        self, interaction_id: str, response: dict,
        access_token: str, origin: str,
    ) -> EventSourceResponse:
        """Resume a suspended agent run."""
        state = _interaction_store.load(interaction_id)
        if state is None:
            return _error_stream(
                f"Unknown interaction ID: {interaction_id}"
            )

        # Inject the client's response as a function result.
        # The saved function_call_part has the function name — wrap the
        # response as a functionResponse so the loop can continue.
        fc = state.function_call_part.get("functionCall", {})
        func_name = fc.get("name", "unknown")

        function_response_turn = {
            "parts": [{
                "functionResponse": {
                    "name": func_name,
                    "response": response,
                }
            }],
            "role": "user",
        }

        # Rebuild the conversation: saved contents + injected response.
        contents = state.contents + [function_response_turn]

        controller = LoopController()
        backend = HttpBackendClient(
            upstream_base=UPSTREAM_BASE,
            client=_http_client,
            origin=origin,
        )
        function_groups = _build_function_groups(
            controller=controller,
            file_system=state.file_system,
            task_tree_manager=state.task_tree_manager,
            access_token=access_token,
            client=_http_client,
            backend=backend,
        )

        run_args = AgentRunArgs(
            objective=contents[0],  # Original objective.
            function_groups=function_groups,
            contents=contents,
        )

        return self._stream_loop(
            run_args=run_args,
            controller=controller,
            file_system=state.file_system,
            task_tree_manager=state.task_tree_manager,
            access_token=access_token,
            origin=origin,
            backend=backend,
        )

    def _stream_loop(
        self,
        *,
        run_args: AgentRunArgs,
        controller: LoopController,
        file_system: AgentFileSystem,
        task_tree_manager: TaskTreeManager,
        access_token: str,
        origin: str,
        backend: HttpBackendClient,
    ) -> EventSourceResponse:
        """Common streaming logic for both start and resume."""
        sink = AgentEventSink()
        run_args.hooks = build_hooks_from_sink(sink)

        loop = Loop(
            access_token=access_token,
            origin=origin,
            client=_http_client,
            backend=backend,
            controller=controller,
        )

        async def generate():
            """Run the loop and yield SSE events."""
            try:
                result = await loop.run(run_args)

                if isinstance(result, SuspendResult):
                    # Save state for later resume.
                    _interaction_store.save(
                        result.interaction_id,
                        InteractionState(
                            contents=result.contents,
                            function_call_part=result.function_call_part,
                            access_token=access_token,
                            origin=origin,
                            file_system=file_system,
                            task_tree_manager=task_tree_manager,
                        ),
                    )
                    # Emit the suspend event — the client reads this,
                    # collects user input, and POSTs back to resume.
                    # Set the interaction_id on the typed event.
                    result.suspend_event.interaction_id = (
                        result.interaction_id
                    )
                    sink.emit(result.suspend_event)

                elif isinstance(result, dict) and "$error" in result:
                    sink.emit(ErrorEvent(message=result["$error"]))
                    sink.emit(CompleteEvent(
                        result=AgentResult(success=False),
                    ))
                else:
                    # Collect intermediate files from the file system.
                    intermediate = None
                    if result.success and file_system.files:
                        intermediate = [
                            FileData(
                                path=path,
                                content=file_system._file_to_part(desc),
                            )
                            for path, desc in file_system.files.items()
                        ]
                    sink.emit(CompleteEvent(
                        result=AgentResult(
                            success=result.success
                            if hasattr(result, "success")
                            else False,
                            outcomes=result.outcomes
                            if hasattr(result, "outcomes")
                            else None,
                            intermediate=intermediate,
                        ),
                    ))
            except Exception as e:
                logger.exception("Agent loop failed")
                sink.emit(ErrorEvent(message=str(e)))
            finally:
                sink.close()

        async def stream():
            """Yield SSE-formatted events from the sink."""
            import asyncio

            loop_task = asyncio.create_task(generate())
            try:
                async for event in sink:
                    yield {
                        "data": json.dumps(event.to_dict()),
                    }
            finally:
                if not loop_task.done():
                    loop_task.cancel()

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
        "endpoint": "POST /v1beta1/streamRunAgent → SSE stream",
    }
