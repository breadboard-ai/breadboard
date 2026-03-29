# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees HTTP server — REST API + scheduler + SSE event stream.

Provides the same functionality as the CLI tools (ticket:add,
ticket:drain, ticket:respond) via HTTP, plus auto-scheduling and
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

from bees.playbook import PlaybookAborted, list_playbooks, load_playbook, run_playbook, run_startup_hooks, run_ticket_done_hooks
from bees.scheduler import Scheduler, SchedulerHooks
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
scheduler: Scheduler | None = None


# ---------------------------------------------------------------------------
# Lifecycle hooks — application-specific behaviour wired to SSE
# ---------------------------------------------------------------------------


async def _on_startup(tickets: list[Ticket]) -> None:
    """Run playbook startup hooks and broadcast any created tickets."""
    new_tickets = run_startup_hooks(tickets)
    for ticket in new_tickets:
        await broadcaster.broadcast({
            "type": "ticket_added",
            "ticket": _ticket_to_dict(ticket),
        })


async def _on_cycle_start(cycle: int, new: int, resumable: int) -> None:
    await broadcaster.broadcast({
        "type": "drain_start",
        "wave": cycle,
        "new": new,
        "resumable": resumable,
    })


async def _on_ticket_event(ticket_id: str, event: dict[str, Any]) -> None:
    await broadcaster.broadcast({
        "type": "session_event",
        "ticket_id": ticket_id,
        "event": event,
    })


async def _on_ticket_start(ticket: Ticket) -> None:
    """Broadcast when a ticket transitions to running."""
    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })


async def _on_ticket_done(ticket: Ticket) -> None:
    """Post-completion hook: broadcast and run playbook hooks."""
    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })
    run_ticket_done_hooks(ticket)


def _on_playbook_run(tickets: list[Ticket]) -> None:
    """When a running agent invokes a playbook mid-session."""
    for ticket in tickets:
        asyncio.create_task(broadcaster.broadcast({
            "type": "ticket_added",
            "ticket": _ticket_to_dict(ticket),
        }))
    if scheduler:
        scheduler.trigger()


async def _on_cycle_complete(cycles: int) -> None:
    await broadcaster.broadcast({"type": "drain_complete", "waves": cycles})


def _on_coordination_emit(ticket: Ticket) -> None:
    """When a running agent emits a coordination signal."""
    asyncio.create_task(broadcaster.broadcast({
        "type": "ticket_added",
        "ticket": _ticket_to_dict(ticket),
    }))
    if scheduler:
        scheduler.trigger()


async def _on_playbook_complete(run_id: str, siblings: list[Ticket], triggering_ticket: Ticket) -> None:
    """Broadcast playbook completion via SSE.

    Watcher delivery (notifying interested tickets) is handled by the
    scheduler's ``_deliver_to_watchers`` — this hook is only for the
    SSE event stream so the frontend can react to completion.
    """
    playbook_name = triggering_ticket.metadata.playbook_id or "(unknown)"
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
    contextUpdates: list[str] | None = None


class UpdateTagsRequest(BaseModel):
    tags: list[str]


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global scheduler

    gemini_key = load_gemini_key()
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    backend = HttpBackendClient(
        upstream_base="",
        httpx_client=http_client,
        access_token="",
        gemini_key=gemini_key,
    )

    hooks = SchedulerHooks(
        on_startup=_on_startup,
        on_cycle_start=_on_cycle_start,
        on_ticket_event=_on_ticket_event,
        on_ticket_start=_on_ticket_start,
        on_ticket_done=_on_ticket_done,
        on_playbook_run=_on_playbook_run,
        on_coordination_emit=_on_coordination_emit,
        on_playbook_complete=_on_playbook_complete,
        on_cycle_complete=_on_cycle_complete,
    )
    scheduler = Scheduler(http=http_client, backend=backend, hooks=hooks)

    # Recover stuck tickets and fire startup hook.
    tickets = await scheduler.recover_stuck_tickets()
    if hooks.on_startup:
        await hooks.on_startup(tickets)

    loop_task = asyncio.create_task(scheduler.start_loop())

    # Auto-schedule any existing available tickets on startup.
    scheduler.trigger()

    yield

    loop_task.cancel()
    await http_client.aclose()


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
    """Create a new ticket and trigger scheduling."""
    ticket = create_ticket(req.objective, tags=req.tags, functions=req.functions, skills=req.skills)

    await broadcaster.broadcast({
        "type": "ticket_added",
        "ticket": _ticket_to_dict(ticket),
    })

    if scheduler:
        scheduler.trigger()
    return _ticket_to_dict(ticket)


@app.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str, req: RespondRequest,
) -> dict[str, Any]:
    """Submit a response to a suspended ticket and trigger scheduling."""
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
    if req.contextUpdates:
        response["context_updates"] = req.contextUpdates
        
    response_path.write_text(
        json.dumps(response, indent=2, ensure_ascii=False) + "\n"
    )
    ticket.metadata.assignee = "agent"
    ticket.save_metadata()

    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })

    if scheduler:
        scheduler.trigger()
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
    playbooks = []
    for name in list_playbooks():
        try:
            data = load_playbook(name)
            if data.get("hidden"):
                continue
            playbooks.append({
                "name": data.get("name", name),
                "title": data.get("title", name),
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
    except PlaybookAborted as exc:
        return {"playbook": name, "status": "skipped", "message": str(exc)}
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    for ticket in tickets:
        await broadcaster.broadcast({
            "type": "ticket_added",
            "ticket": _ticket_to_dict(ticket),
        })

    if scheduler:
        scheduler.trigger()

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
