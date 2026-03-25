# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees HTTP server — REST API + auto-drain + SSE event stream.

Provides the same functionality as the CLI tools (ticket:add,
ticket:drain, ticket:respond) via HTTP, plus auto-draining and
real-time status updates via Server-Sent Events.

Usage::

    npm run dev:server -w packages/bees
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from bees.drain import (
    _promote_blocked_tickets,
    _resume_ticket,
    _run_ticket,
    resolve_segments,
)
from bees.session import load_gemini_key
from bees.ticket import (
    Ticket,
    create_ticket,
    list_tickets,
    load_ticket,
)
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# SSE broadcaster
# ---------------------------------------------------------------------------


class Broadcaster:
    """Fan-out SSE events to all connected clients."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[dict[str, Any]]] = []

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._queues.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        if queue in self._queues:
            self._queues.remove(queue)

    async def broadcast(self, event: dict[str, Any]) -> None:
        for queue in list(self._queues):
            await queue.put(event)


broadcaster = Broadcaster()


# ---------------------------------------------------------------------------
# Auto-drain loop
# ---------------------------------------------------------------------------

_drain_trigger = asyncio.Event()
_drain_running = False
_http_client: httpx.AsyncClient | None = None
_backend: HttpBackendClient | None = None
_tool_files: dict[str, str] = {}


async def _drain_loop() -> None:
    """Background loop that drains whenever triggered."""
    global _drain_running
    while True:
        await _drain_trigger.wait()
        _drain_trigger.clear()

        if _drain_running:
            continue

        _drain_running = True
        try:
            await _run_drain_wave()
        except Exception as exc:
            logger.exception("Drain error: %s", exc)
            await broadcaster.broadcast({
                "type": "drain_error", "error": str(exc),
            })
        finally:
            _drain_running = False


_running_tickets: set[str] = set()


async def _run_drain_wave() -> None:
    """Run drain waves until no more work is available."""
    assert _http_client and _backend
    wave = 0

    def _make_on_event(t_id: str):
        async def on_event(event: dict[str, Any]):
            await broadcaster.broadcast({
                "type": "session_event",
                "ticket_id": t_id,
                "event": event,
            })
        return on_event

    while True:
        # Promote blocked tickets.
        promoted = _promote_blocked_tickets()
        if promoted:
            await broadcaster.broadcast({
                "type": "promoted", "count": promoted,
            })
            # Broadcast updated blocked tickets.
            for t in list_tickets():
                if t.metadata.status == "available" or t.metadata.status == "failed":
                    await broadcaster.broadcast({
                        "type": "ticket_update",
                        "ticket": _ticket_to_dict(t),
                    })

        tickets = list_tickets(status="available")
        resumable = [
            t for t in list_tickets(status="suspended")
            if t.metadata.assignee == "agent"
        ]

        if not tickets and not resumable:
            break

        wave += 1
        await broadcaster.broadcast({
            "type": "drain_start",
            "wave": wave,
            "new": len(tickets),
            "resumable": len(resumable),
        })

        for ticket in tickets:
            if ticket.id in _running_tickets:
                continue
            _running_tickets.add(ticket.id)

            async def wrap_run(t=ticket):
                try:
                    await _run_ticket(t, http=_http_client, backend=_backend, on_event=_make_on_event(t.id))
                finally:
                    _running_tickets.remove(t.id)
                    await broadcaster.broadcast({
                        "type": "ticket_update",
                        "ticket": _ticket_to_dict(load_ticket(t.id) or t),
                    })

            asyncio.create_task(wrap_run())

        for ticket in resumable:
            if ticket.id in _running_tickets:
                continue
            _running_tickets.add(ticket.id)

            async def wrap_resume(t=ticket):
                try:
                    await _resume_ticket(t, http=_http_client, backend=_backend, on_event=_make_on_event(t.id))
                finally:
                    _running_tickets.remove(t.id)
                    await broadcaster.broadcast({
                        "type": "ticket_update",
                        "ticket": _ticket_to_dict(load_ticket(t.id) or t),
                    })

            asyncio.create_task(wrap_resume())

        await asyncio.sleep(1)

    await broadcaster.broadcast({"type": "drain_complete", "waves": wave})


def _trigger_drain() -> None:
    """Wake the drain loop."""
    _drain_trigger.set()


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class AddTicketRequest(BaseModel):
    objective: str
    tags: list[str] | None = None


class RespondRequest(BaseModel):
    text: str | None = None
    selectedIds: list[str] | None = None


class UpdateTagsRequest(BaseModel):
    tags: list[str]


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _http_client, _backend

    gemini_key = load_gemini_key()
    _http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    _backend = HttpBackendClient(
        upstream_base="",
        httpx_client=_http_client,
        access_token="",
        gemini_key=gemini_key,
    )
    drain_task = asyncio.create_task(_drain_loop())

    # Auto-drain any existing available tickets on startup.
    _trigger_drain()

    yield

    drain_task.cancel()
    await _http_client.aclose()


app = FastAPI(title="Bees", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


def _ticket_to_dict(ticket: Ticket) -> dict[str, Any]:
    """Serialize a ticket for JSON response."""
    return {
        "id": ticket.id,
        "objective": ticket.objective,
        **ticket.metadata.to_dict(),
    }


@app.get("/tickets")
async def get_tickets(tag: str | None = None) -> list[dict[str, Any]]:
    """List all tickets, sorted by created_at latest first, optionally filtered by tag."""
    tickets = list_tickets()
    
    if tag:
        tickets = [t for t in tickets if t.metadata.tags and tag in t.metadata.tags]
        
    # Sort by created_at latest first (ISO string sorting works for chronological order).
    tickets.sort(key=lambda t: t.metadata.created_at or "", reverse=True)
    
    return [_ticket_to_dict(t) for t in tickets]


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str) -> dict[str, Any]:
    """Get a single ticket."""
    ticket = load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    return _ticket_to_dict(ticket)


@app.post("/tickets")
async def add_ticket(req: AddTicketRequest) -> dict[str, Any]:
    """Create a new ticket and trigger auto-drain."""
    ticket = create_ticket(req.objective, tags=req.tags)

    await broadcaster.broadcast({
        "type": "ticket_added",
        "ticket": _ticket_to_dict(ticket),
    })

    _trigger_drain()
    return _ticket_to_dict(ticket)


@app.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str, req: RespondRequest,
) -> dict[str, Any]:
    """Submit a response to a suspended ticket and trigger drain."""
    ticket = load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    if ticket.metadata.status != "suspended":
        raise HTTPException(400, f"Ticket is not suspended")
    if ticket.metadata.assignee != "user":
        raise HTTPException(400, f"Ticket is not assigned to user")

    # Write response and flip assignee.
    response_path = ticket.dir / "response.json"
    
    response: dict[str, Any] = {}
    if req.selectedIds is not None:
        response["selectedIds"] = req.selectedIds
    elif req.text is not None:
        response["text"] = req.text
        
    response_path.write_text(
        json.dumps(response, indent=2, ensure_ascii=False) + "\n"
    )
    ticket.metadata.assignee = "agent"
    ticket.save_metadata()

    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })

    _trigger_drain()
    return _ticket_to_dict(ticket)


@app.post("/tickets/{ticket_id}/tags")
async def update_ticket_tags(
    ticket_id: str, req: UpdateTagsRequest
) -> dict[str, Any]:
    """Update tags for a ticket and broadcast."""
    ticket = load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")

    ticket.metadata.tags = req.tags
    ticket.save_metadata()

    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })

    return _ticket_to_dict(ticket)


    return _ticket_to_dict(ticket)


@app.get("/tickets/{ticket_id}/bundle")
async def get_ticket_bundle(ticket_id: str) -> dict[str, str]:
    """Get the auto-built CJS bundle for a ticket, if it exists."""
    ticket = load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    
    if not ticket.metadata.bundle_path:
        raise HTTPException(404, "No bundle found for this ticket")
        
    try:
        from pathlib import Path
        path = Path(ticket.metadata.bundle_path)
        if not path.exists():
            raise HTTPException(404, "Bundle file missing from disk")
        return {"code": path.read_text(encoding="utf-8")}
    except Exception as e:
        raise HTTPException(500, f"Error reading bundle: {e}")


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------


@app.get("/events")
async def events() -> EventSourceResponse:
    """Server-Sent Events stream for real-time updates."""
    queue = broadcaster.subscribe()

    async def event_generator() -> AsyncIterator[dict]:
        try:
            # Send initial state.
            yield {
                "event": "init",
                "data": json.dumps([
                    _ticket_to_dict(t) for t in list_tickets()
                ]),
            }
            while True:
                event = await queue.get()
                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event),
                }
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    import uvicorn
    uvicorn.run(
        "bees.server:app",
        host="0.0.0.0",
        port=3200,
        reload=True,
        reload_dirs=[str(__import__("pathlib").Path(__file__).parent)],
    )


if __name__ == "__main__":
    main()
