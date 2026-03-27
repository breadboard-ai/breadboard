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
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from bees.drain import (
    _promote_blocked_tickets,
    _resume_ticket,
    _run_ticket,
    resolve_segments,
)
from bees.playbook import PLAYBOOKS_DIR, load_playbook, run_playbook
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

    def _on_playbook_run(tickets: list[Ticket]) -> None:
        for ticket in tickets:
            asyncio.create_task(broadcaster.broadcast({
                "type": "ticket_added",
                "ticket": _ticket_to_dict(ticket),
            }))
        _trigger_drain()

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
                    await _run_ticket(t, http=_http_client, backend=_backend, on_event=_make_on_event(t.id), on_playbook_run=_on_playbook_run)
                finally:
                    _running_tickets.remove(t.id)
                    updated = load_ticket(t.id) or t
                    await broadcaster.broadcast({
                        "type": "ticket_update",
                        "ticket": _ticket_to_dict(updated),
                    })
                    await _check_playbook_completion(updated)
                    _trigger_drain()

            asyncio.create_task(wrap_run())

        for ticket in resumable:
            if ticket.id in _running_tickets:
                continue
            _running_tickets.add(ticket.id)

            async def wrap_resume(t=ticket):
                try:
                    await _resume_ticket(t, http=_http_client, backend=_backend, on_event=_make_on_event(t.id), on_playbook_run=_on_playbook_run)
                finally:
                    _running_tickets.remove(t.id)
                    updated = load_ticket(t.id) or t
                    await broadcaster.broadcast({
                        "type": "ticket_update",
                        "ticket": _ticket_to_dict(updated),
                    })
                    await _check_playbook_completion(updated)
                    _trigger_drain()

            asyncio.create_task(wrap_resume())

        await asyncio.sleep(1)

    await broadcaster.broadcast({"type": "drain_complete", "waves": wave})


def _trigger_drain() -> None:
    """Wake the drain loop."""
    _drain_trigger.set()


async def _check_playbook_completion(ticket: Ticket) -> None:
    """Check if a ticket's playbook run is fully complete.

    When all tickets sharing a ``playbook_run_id`` have reached a
    terminal state (completed or failed), we:
    1. Broadcast a ``playbook_complete`` SSE event.
    2. Wake Opie with a system notification so it can inform the user.
    """
    run_id = ticket.metadata.playbook_run_id
    if not run_id:
        return

    # Skip if *this* ticket is the opie ticket (don't self-notify).
    if ticket.metadata.tags and "opie" in ticket.metadata.tags:
        return

    # Gather all tickets in this playbook run.
    siblings = [
        t for t in list_tickets()
        if t.metadata.playbook_run_id == run_id
    ]
    if not siblings:
        return

    terminal = {"completed", "failed"}
    all_done = all(t.metadata.status in terminal for t in siblings)
    if not all_done:
        return

    playbook_name = ticket.metadata.playbook_id or "(unknown)"
    succeeded = sum(1 for t in siblings if t.metadata.status == "completed")
    failed = sum(1 for t in siblings if t.metadata.status == "failed")

    logger.info(
        "Playbook run %s (%s) complete: %d succeeded, %d failed",
        run_id, playbook_name, succeeded, failed,
    )

    await broadcaster.broadcast({
        "type": "playbook_complete",
        "playbook_run_id": run_id,
        "playbook_id": playbook_name,
        "succeeded": succeeded,
        "failed": failed,
    })

    # Build a summary of completed ticket outcomes.
    summaries: list[str] = []
    for t in siblings:
        title = t.metadata.title or t.id[:8]
        outcome = t.metadata.outcome or "(no outcome)"
        summaries.append(f"- **{title}**: {outcome}")
    summary_text = "\n".join(summaries)

    # Wake Opie with a system notification.
    opie = next(
        (t for t in list_tickets()
         if t.metadata.tags and "opie" in t.metadata.tags
         and t.metadata.status == "suspended"
         and t.metadata.assignee == "user"),
        None,
    )
    if opie:
        notification = (
            f'[System Notification] Playbook "{playbook_name}" has completed.\n'
            f"Results:\n{summary_text}\n\n"
            f"Please summarise these results for the user and ask what they'd like to do next."
        )
        response_path = opie.dir / "response.json"
        response_path.write_text(
            json.dumps({"text": notification}, indent=2, ensure_ascii=False)
            + "\n"
        )
        opie.metadata.assignee = "agent"
        opie.save_metadata()

        await broadcaster.broadcast({
            "type": "ticket_update",
            "ticket": _ticket_to_dict(opie),
        })

        logger.info("Notified Opie of playbook completion: %s", playbook_name)
        _trigger_drain()


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class AddTicketRequest(BaseModel):
    objective: str
    tags: list[str] | None = None
    functions: list[str] | None = None
    skills: list[str] | None = None


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

    # Auto-boot Opie if no opie-tagged ticket exists yet.
    existing = list_tickets()
    has_opie = any(
        t.metadata.tags and "opie" in t.metadata.tags
        for t in existing
    )
    if not has_opie:
        try:
            opie_tickets = run_playbook("opie")
            for ticket in opie_tickets:
                await broadcaster.broadcast({
                    "type": "ticket_added",
                    "ticket": _ticket_to_dict(ticket),
                })
            logger.info("Auto-booted Opie (%d tickets)", len(opie_tickets))
        except Exception as exc:
            logger.warning("Failed to auto-boot Opie: %s", exc)

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


@app.get("/tickets/{ticket_id}/files/{path:path}")
async def get_ticket_file(ticket_id: str, path: str) -> FileResponse:
    """Serve files from the ticket's filesystem."""
    ticket = load_ticket(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
        
    file_path = ticket.dir / "filesystem" / path
    if not file_path.is_file():
        raise HTTPException(404, f"File {path} not found")
        
    try:
        file_path.resolve().relative_to((ticket.dir / "filesystem").resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")
        
    return FileResponse(file_path)



@app.post("/tickets")
async def add_ticket(req: AddTicketRequest) -> dict[str, Any]:
    """Create a new ticket and trigger auto-drain."""
    ticket = create_ticket(req.objective, tags=req.tags, functions=req.functions, skills=req.skills)

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


# ---------------------------------------------------------------------------
# Playbook endpoints
# ---------------------------------------------------------------------------


@app.get("/playbooks")
async def get_playbooks() -> list[dict[str, str]]:
    """List available playbooks."""
    if not PLAYBOOKS_DIR.exists():
        return []

    playbooks = []
    for path in sorted(PLAYBOOKS_DIR.glob("*.yaml")):
        try:
            data = load_playbook(path.stem)
            playbooks.append({
                "name": path.stem,
                "title": data.get("title", path.stem),
                "description": data.get("description", ""),
            })
        except Exception:
            continue
    return playbooks


@app.post("/playbooks/{name}/run")
async def run_playbook_endpoint(name: str) -> dict[str, Any]:
    """Run a playbook, creating tickets for each step."""
    try:
        tickets = run_playbook(name)
    except FileNotFoundError:
        raise HTTPException(404, f"Playbook '{name}' not found")
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    for ticket in tickets:
        await broadcaster.broadcast({
            "type": "ticket_added",
            "ticket": _ticket_to_dict(ticket),
        })

    _trigger_drain()

    return {
        "playbook": name,
        "tickets": [_ticket_to_dict(t) for t in tickets],
    }




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
        reload_includes=["*.md", "*.json", "*.yaml"],
    )


if __name__ == "__main__":
    main()
