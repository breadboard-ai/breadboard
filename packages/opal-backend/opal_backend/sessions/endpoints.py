# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Session REST API endpoints.

Stub implementations for Phase 1 — valid response shapes backed by
``InMemorySessionStore``, no real agent loop yet.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from .store import SessionStatus, SessionStore

__all__ = ["create_session_router"]


def create_session_router(store: SessionStore) -> APIRouter:
    """Create a FastAPI router with all session endpoints.

    Args:
        store: SessionStore implementation (e.g. InMemorySessionStore).
    """
    router = APIRouter(prefix="/v1beta1/sessions")

    @router.post("/new")
    async def create_session(request: Request) -> JSONResponse:
        """Create a session and return its ID.

        Phase 1: creates the session in the store but does not spawn a
        loop. The session stays in RUNNING status.
        """
        body = await request.json()
        session_id = f"sess-{uuid.uuid4().hex[:12]}"
        await store.create(session_id)
        return JSONResponse({"sessionId": session_id})

    @router.get("/{session_id}")
    async def stream_events(
        request: Request, session_id: str, after: int = -1,
    ) -> EventSourceResponse:
        """SSE event stream with replay + live.

        Phase 1 stub: emits a start event, replays any stored events,
        then closes the stream.
        """
        status = await store.get_status(session_id)
        if status is None:
            return JSONResponse(
                {"error": "Session not found"}, status_code=404,
            )

        async def event_generator():
            yield {"event": "start", "data": f'{{"sessionId":"{session_id}"}}'}
            events = await store.get_events(session_id, after=after)
            for i, event in enumerate(events):
                import json
                yield {"event": "event", "data": json.dumps(event)}
            yield {"event": "done", "data": "{}"}

        return EventSourceResponse(event_generator())

    @router.post("/{session_id}/resume")
    async def resume_session(
        request: Request, session_id: str,
    ) -> JSONResponse:
        """Inject a response for a suspended session.

        Phase 1 stub: validates the session is suspended, returns ok.
        Does not actually resume anything.
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
