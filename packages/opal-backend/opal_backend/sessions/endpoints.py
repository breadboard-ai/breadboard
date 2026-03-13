# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session REST API endpoints.

Phase 3: endpoints backed by real agent loop execution via
``new_session()``, ``start_session()``, and ``resume_session()``.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from ..backend_client import BackendClient
from ..drive_operations_client import DriveOperationsClient
from ..interaction_store import InteractionStore
from .api import Subscribers, new_session, resume_session, start_session
from .store import SessionStatus, SessionStore

__all__ = ["create_session_router"]


class SessionDeps:
    """Per-request dependency factory for session endpoints.

    Wraps the construction of BackendClient and DriveOperationsClient
    so the endpoint layer doesn't need to know the concrete types.
    """

    def __init__(
        self,
        *,
        backend_factory: Callable[[str, str], BackendClient],
        drive_factory: Callable[[str], DriveOperationsClient] | None = None,
        interaction_store: InteractionStore,
    ) -> None:
        self.backend_factory = backend_factory
        self.drive_factory = drive_factory
        self.interaction_store = interaction_store


def create_session_router(
    store: SessionStore,
    subscribers: Subscribers,
    deps: SessionDeps | None = None,
) -> APIRouter:
    """Create a FastAPI router with all session endpoints.

    Args:
        store: SessionStore implementation (e.g. InMemorySessionStore).
        subscribers: Subscriber queue manager for live SSE delivery.
        deps: Per-request dependency factories. If None, endpoints
              return stub responses (Phase 1 behavior).
    """
    router = APIRouter(prefix="/v1beta1/sessions")

    @router.post("/new")
    async def create_session(request: Request) -> JSONResponse:
        """Create a session and start the agent loop in the background."""
        body = await request.json()
        segments = body.get("segments")
        if not segments:
            return JSONResponse(
                {"error": "Missing 'segments' in request body"},
                status_code=400,
            )

        session_id = f"sess-{uuid.uuid4().hex[:12]}"

        if deps is None:
            # Phase 1 stub: just create in store, no loop.
            await store.create(session_id)
            return JSONResponse({"sessionId": session_id})

        # Extract user's OAuth token. In production, the backend
        # eats the Authorization header, so the original user token
        # is only available as accessToken in the body.
        access_token = body.pop("accessToken", "")
        if not access_token:
            return JSONResponse(
                {"error": "Missing 'accessToken' in request body"},
                status_code=400,
            )
        origin = request.headers.get("origin", "")

        flags = body.get("flags", {})
        graph = body.get("graph")

        # Build per-request clients.
        backend = deps.backend_factory(access_token, origin)
        drive = deps.drive_factory(access_token) if deps.drive_factory else None

        # Create session and start loop.
        await new_session(
            session_id=session_id,
            segments=segments,
            store=store,
            backend=backend,
            interaction_store=deps.interaction_store,
            flags=flags,
            graph=graph,
            drive=drive,
        )

        asyncio.create_task(
            start_session(
                session_id=session_id,
                store=store,
                subscribers=subscribers,
            ),
            name=f"session-{session_id}",
        )

        return JSONResponse({"sessionId": session_id})

    @router.get("/{session_id}")
    async def stream_events(
        request: Request, session_id: str, after: int = -1,
    ) -> EventSourceResponse:
        """SSE event stream: replay stored events, then stream live.

        Clients can reconnect at any time with ``?after=N`` to resume
        from event N. If the session is still running, the stream stays
        open for live events.
        """
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Session not found"}, status_code=404,
            )

        async def event_generator():
            yield {"event": "start", "data": json.dumps({"sessionId": session_id})}

            # Phase 1: replay stored events.
            events = await store.get_events(session_id, after=after)
            next_index = after + 1
            for i, event in enumerate(events):
                yield {
                    "event": "event",
                    "id": str(next_index + i),
                    "data": json.dumps(event),
                }
            next_index += len(events)

            # Only subscribe for live events when a real loop is running.
            # In stub mode (deps is None), no background task exists.
            current_status = await store.get_status(session_id)
            if (
                deps is not None
                and current_status in (SessionStatus.RUNNING, SessionStatus.SUSPENDED)
            ):
                queue = subscribers.subscribe(session_id)
                try:
                    while True:
                        item = await queue.get()
                        if item is None:
                            break  # Session ended.
                        yield {
                            "event": "event",
                            "id": str(next_index),
                            "data": json.dumps(item),
                        }
                        next_index += 1
                finally:
                    subscribers.unsubscribe(session_id, queue)

            yield {"event": "done", "data": "{}"}

        return EventSourceResponse(event_generator())

    @router.post("/{session_id}/resume")
    async def resume_session_endpoint(
        request: Request, session_id: str,
    ) -> JSONResponse:
        """Inject a response for a suspended session.

        Validates the session is suspended, sets status to RUNNING,
        and spawns a background task to continue the loop.
        """
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Session not found"}, status_code=404,
            )
        if status != SessionStatus.SUSPENDED:
            return JSONResponse(
                {"error": f"Session not in suspended status (current: {status})"},
                status_code=409,
            )

        body = await request.json()
        response = body.get("response", {})

        await store.set_status(session_id, SessionStatus.RUNNING)

        asyncio.create_task(
            resume_session(
                session_id=session_id,
                response=response,
                store=store,
                subscribers=subscribers,
            ),
            name=f"resume-{session_id}",
        )

        return JSONResponse({"ok": True})

    @router.get("/{session_id}/status")
    async def get_session_status(session_id: str) -> JSONResponse:
        """Lightweight status check."""
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Session not found"}, status_code=404,
            )
        events = await store.get_events(session_id)
        return JSONResponse({
            "sessionId": session_id,
            "status": status.value,
            "eventCount": len(events),
        })

    @router.post("/{session_id}:cancel")
    async def cancel_session(session_id: str) -> JSONResponse:
        """Cancel a running session."""
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Session not found"}, status_code=404,
            )
        terminal = {SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.CANCELLED}
        if status in terminal:
            return JSONResponse(
                {"error": f"Session already in terminal state ({status})"},
                status_code=409,
            )
        await store.set_status(session_id, SessionStatus.CANCELLED)
        return JSONResponse({
            "sessionId": session_id,
            "status": "cancelled",
        })

    return router
