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
import hashlib
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


from bees.scheduler import Scheduler, SchedulerHooks
from app.auth import load_gemini_key
from app.config import load_hive_dir
from bees import Task, TaskStore
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger(__name__)

hive_dir = load_hive_dir()
task_store = TaskStore(hive_dir)


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


async def _on_ticket_added(ticket: Task) -> None:
    """Broadcast a newly added ticket."""
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


async def _on_ticket_start(ticket: Task) -> None:
    """Broadcast when a ticket transitions to running."""
    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })


async def _on_ticket_done(ticket: Task) -> None:
    """Post-completion hook: broadcast and run playbook hooks."""
    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })



async def _on_cycle_complete(cycles: int) -> None:
    await broadcaster.broadcast({"type": "drain_complete", "waves": cycles})





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
        on_ticket_added=_on_ticket_added,
        on_cycle_start=_on_cycle_start,
        on_ticket_event=_on_ticket_event,
        on_ticket_start=_on_ticket_start,
        on_ticket_done=_on_ticket_done,
        on_cycle_complete=_on_cycle_complete,
    )
    scheduler = Scheduler(http=http_client, backend=backend, hooks=hooks, store=task_store)

    # Startup scheduler (recovers tickets and boots root if needed)
    await scheduler.startup()

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


def _ticket_to_dict(ticket: Task) -> dict[str, Any]:
    """Serialize a ticket for JSON response."""
    d = {
        "id": ticket.id,
        "objective": ticket.objective,
        **ticket.metadata.to_dict(),
    }
    # Include chat history for chat-tagged tickets so the shell can
    # restore conversation after page reload / server restart.
    if ticket.metadata.tags and "chat" in ticket.metadata.tags:
        d["chat_history"] = _read_chat_log(ticket)
    return d


def _read_chat_log(ticket: Task) -> list[dict[str, str]]:
    """Read the ticket's chat log written by the chat function.

    Returns a list of ``{"role": "agent"|"user", "text": "..."}`` entries.
    """
    log_path = ticket.dir / "chat_log.json"
    if not log_path.exists():
        return []
    try:
        return json.loads(log_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


@app.get("/tickets")
async def get_tickets(tag: str | None = None) -> list[dict[str, Any]]:
    """List all tickets, sorted by created_at latest first, optionally filtered by tag."""
    tickets = task_store.query_all()

    if tag:
        tickets = [t for t in tickets if t.metadata.tags and tag in t.metadata.tags]

    # Sort by created_at latest first (ISO string sorting works for chronological order).
    tickets.sort(key=lambda t: t.metadata.created_at or "", reverse=True)

    return [_ticket_to_dict(t) for t in tickets]


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str) -> dict[str, Any]:
    """Get a single ticket."""
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    return _ticket_to_dict(ticket)


@app.get("/tickets/{ticket_id}/files")
async def list_ticket_files(ticket_id: str) -> list[str]:
    """List files in the ticket's filesystem directory."""
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")

    fs_dir = ticket.fs_dir
    if not fs_dir.is_dir():
        return []

    return [
        str(p.relative_to(fs_dir))
        for p in fs_dir.rglob("*")
        if p.is_file()
    ]


@app.get("/tickets/{ticket_id}/files/{path:path}")
async def get_ticket_file(ticket_id: str, path: str) -> FileResponse:
    """Serve files from the ticket's filesystem."""
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")

    file_path = ticket.fs_dir / path
    if not file_path.is_file():
        raise HTTPException(404, f"File {path} not found")

    try:
        file_path.resolve().relative_to(ticket.fs_dir.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")

    return FileResponse(file_path)



@app.post("/tickets")
async def add_ticket(req: AddTicketRequest) -> dict[str, Any]:
    """Create a new ticket and trigger scheduling."""
    if not scheduler:
        raise HTTPException(500, "Scheduler not initialized")

    ticket = await scheduler.create_task(
        req.objective,
        tags=req.tags,
        functions=req.functions,
        skills=req.skills,
    )

    return _ticket_to_dict(ticket)


@app.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str, req: RespondRequest,
) -> dict[str, Any]:
    """Submit a response to a suspended ticket and trigger scheduling."""
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    if ticket.metadata.status != "suspended":
        raise HTTPException(400, f"Ticket is not suspended")
    if ticket.metadata.assignee != "user":
        raise HTTPException(400, f"Ticket is not assigned to user")

    response: dict[str, Any] = {}
    if req.selectedIds is not None:
        response["selectedIds"] = req.selectedIds
    if req.text is not None:
        response["text"] = req.text
    if req.contextUpdates:
        response["context_updates"] = req.contextUpdates

    ticket = task_store.respond(ticket_id, response)

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
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")

    ticket.metadata.tags = req.tags
    ticket.save_metadata()

    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })

    return _ticket_to_dict(ticket)


@app.post("/tickets/{ticket_id}/retry")
async def retry_ticket(ticket_id: str) -> dict[str, Any]:
    """Retry a paused ticket by flipping it back to available.

    Paused tickets are those that hit a transient Gemini API error
    (e.g. 503).  Retrying clears the error and re-queues the ticket
    for the scheduler to pick up.
    """
    ticket = task_store.get(ticket_id)
    if not ticket:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    if ticket.metadata.status != "paused":
        raise HTTPException(400, "Ticket is not paused")

    ticket.metadata.status = "available"
    ticket.metadata.error = None
    ticket.save_metadata()

    await broadcaster.broadcast({
        "type": "ticket_update",
        "ticket": _ticket_to_dict(ticket),
    })

    if scheduler:
        scheduler.trigger()
    return _ticket_to_dict(ticket)





# ---------------------------------------------------------------------------
# System Pulse — Flash-powered status summary
# ---------------------------------------------------------------------------


def should_include_ticket(
    ticket: Task,
    status: str | None = None,
    tags: str | None = None,
    kind: str | None = None,
) -> bool:
    """Evaluate if a ticket matches the query parameters."""
    
    # 1. Kind filter
    if kind:
        is_neg = kind.startswith("!")
        val = kind[1:] if is_neg else kind
        match = ticket.metadata.kind == val
        if is_neg and match:
            return False
        if not is_neg and not match:
            return False

    # 2. Status filter
    if status:
        is_neg = status.startswith("!")
        val = status[1:] if is_neg else status
        allowed_statuses = set(val.split(","))
        match = ticket.metadata.status in allowed_statuses
        if is_neg and match:
            return False
        if not is_neg and not match:
            return False

    # 3. Tags filter
    if tags:
        tag_list = tags.split(",")
        ticket_tags = set(ticket.metadata.tags or [])
        
        positive_reqs = []
        negative_reqs = []
        for t in tag_list:
            if t.startswith("!"):
                negative_reqs.append(t[1:])
            else:
                positive_reqs.append(t)
                
        for nt in negative_reqs:
            if nt in ticket_tags:
                return False
                
        if positive_reqs:
            if not any(pt in ticket_tags for pt in positive_reqs):
                return False

    return True


_pulse_cache: dict[str, Any] = {"hash": "", "text": "", "active": False}


@app.get("/status")
async def get_status(
    status: str | None = None,
    tags: str | None = None,
    kind: str | None = None,
) -> dict[str, Any]:
    """Return a status response containing both the summary text and structured tasks."""
    tickets = task_store.query_all()

    by_run: dict[str, list[Task]] = {}
    active_running = []

    for t in tickets:
        if not should_include_ticket(t, status=status, tags=tags, kind=kind):
            continue

        run_id = t.metadata.playbook_run_id or f"standalone-{t.id}"
        by_run.setdefault(run_id, []).append(t)

        if t.metadata.status in ("available", "running", "blocked", "suspended"):
            active_running.append(t)

    # 1. Generate text
    if not active_running:
        text = ""
    else:
        first_ticket = active_running[0]
        title = first_ticket.metadata.title or "a task"
        if len(active_running) == 1:
            text = f"Working on {title}…"
        elif len(active_running) == 2:
            text = f"Working on {title} and 1 other task…"
        else:
            text = f"Working on {title} and {len(active_running) - 1} other tasks…"

    # 2. Build task objects
    active_statuses = {"available", "running", "blocked", "suspended"}
    tasks = []
    for run_id, group in by_run.items():
        if not any(t.metadata.status in active_statuses for t in group):
            continue

        group.sort(key=lambda t: t.metadata.created_at or "")
        first_ticket = group[0]
        title = "Task"
        if first_ticket.metadata.playbook_id:
            title = first_ticket.metadata.playbook_id.replace("-", " ").title()
        elif first_ticket.metadata.title:
            title = first_ticket.metadata.title

        completed_steps = sum(1 for t in group if t.metadata.status in ("success", "error"))
        total_steps = len(group)
        active_tickets = [t for t in group if t.metadata.status in active_statuses]
        current_ticket = active_tickets[0] if active_tickets else group[-1]

        tasks.append({
            "id": run_id,
            "title": title,
            "context": first_ticket.metadata.context or "",
            "current_step": current_ticket.metadata.title or "Working...",
            "status": current_ticket.metadata.status,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "created_at": first_ticket.metadata.created_at,
            "tags": list(set(first_ticket.metadata.tags or []))
        })

    tasks.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return {"text": text, "active": bool(active_running), "tasks": tasks}


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
                    _ticket_to_dict(t) for t in task_store.query_all()
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
        "app.server:app",
        host="0.0.0.0",
        port=3200,
        reload=True,
        reload_dirs=[str(__import__("pathlib").Path(__file__).parent)],
        reload_includes=["*.md", "*.json", "*.yaml"],
    )


if __name__ == "__main__":
    main()
