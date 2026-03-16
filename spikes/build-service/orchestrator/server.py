#!/usr/bin/env python3
# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Ticket-driven build pipeline orchestrator.

A FastAPI server that:
- Accepts user prompts and creates ticket chains
- Wires pipeline triggers: generation → build (auto) → user review
- Serves a ticket-centric frontend
- Streams ticket updates via SSE

Start with:
    # Terminal 1: build service
    cd ../service && npx tsx server.ts

    # Terminal 2: orchestrator
    cd orchestrator && python server.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from this directory.
_local_env = Path(__file__).resolve().parent / ".env"
if _local_env.is_file():
    load_dotenv(_local_env)

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from tickets import TicketStore, Ticket, Status
from pipeline import register as register_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="Ticket Pipeline")

store = TicketStore(
    workspace_root=Path(__file__).resolve().parent / "workspaces"
)

# SSE queues for live updates.
sse_queues: list[asyncio.Queue] = []


def _broadcast(ticket: Ticket, action: str) -> None:
    """Push ticket updates to all SSE listeners."""
    data = {"action": action, "ticket": ticket.to_dict()}
    for q in sse_queues:
        q.put_nowait(data)


store.subscribe(_broadcast)


# ─── Pipeline Registration ───────────────────────────────────────────────────
# See pipeline.py for the complete trigger topology.
register_pipeline(store)


# ─── Routes ──────────────────────────────────────────────────────────────────

class PromptRequest(BaseModel):
    prompt: str


@app.post("/prompt")
async def create_prompt(request: PromptRequest):
    """Create a ticket chain from a user prompt."""
    # T1: The root request (assigned to the user who made it).
    root = await store.create(
        type="ui_request",
        body=request.prompt,
        metadata={"prompt": request.prompt},
        assigned_to="User",
    )

    # T2: Generation ticket (assigned to Gemini).
    gen_ticket = await store.create(
        type="ui_generation",
        body=f"Generate React UI for: {request.prompt}",
        parent_id=root.id,
        assigned_to="Gemini",
    )

    # Kick off Gemini in the background.
    asyncio.create_task(_run_generation(gen_ticket.id, request.prompt))

    return {"root_ticket_id": root.id, "generation_ticket_id": gen_ticket.id}


async def _run_generation(ticket_id: int, prompt: str) -> None:
    """Background task: call Gemini and resolve the generation ticket."""
    from gemini import generate_ui

    await store.update_status(ticket_id, Status.IN_PROGRESS, "Generating with Gemini...")

    try:
        files = await generate_ui(
            prompt,
            on_progress=lambda msg: store.get(ticket_id) and store.get(ticket_id).add_event("progress", msg),
        )

        # Resolve with the file map as JSON.
        await store.resolve(ticket_id, json.dumps(files), f"Generated {len(files)} files")

    except Exception as e:
        logger.exception("Generation failed for ticket #%d", ticket_id)
        ticket = store.get(ticket_id)
        if ticket:
            await store.update_status(ticket_id, Status.DENIED, f"Generation failed: {e}")


@app.get("/tickets")
async def list_tickets():
    """List all tickets."""
    return [t.to_dict() for t in store.list()]


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int):
    """Get a single ticket."""
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket.to_dict()


@app.get("/tickets/{ticket_id}/files")
async def get_ticket_files(ticket_id: int):
    """Get files from a resolved generation ticket."""
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.type == "ui_generation" and ticket.resolution:
        try:
            return json.loads(ticket.resolution)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid resolution")
    raise HTTPException(status_code=400, detail="Not a generation ticket or not resolved")


@app.post("/tickets/{ticket_id}/approve")
async def approve_ticket(ticket_id: int):
    """Approve a ticket (user action)."""
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        ticket = await store.approve(ticket_id)
        return ticket.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tickets/{ticket_id}/deny")
async def deny_ticket(ticket_id: int, request: Request):
    """Deny a ticket with optional feedback for redo."""
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    reason = body.get("reason", "")
    feedback = body.get("feedback", reason)
    # Store feedback as metadata so the pipeline can use it for redo.
    if feedback:
        store.update_metadata(ticket_id, feedback=feedback)
    try:
        ticket = await store.deny(ticket_id, reason or "User rejected")
        return ticket.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/tickets/{ticket_id}/bundle")
async def get_bundle(ticket_id: int):
    """Get the built CJS bundle.

    Accepts either a ui_build ticket ID directly, or a ui_review ticket
    (looks up the build ticket via metadata).
    """
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Direct build ticket.
    if ticket.type == "ui_build" and ticket.status == Status.RESOLVED and ticket.resolution:
        return JSONResponse(content={"code": ticket.resolution})

    # Review ticket → find the build ticket.
    if ticket.type == "ui_review":
        build_id = int(ticket.metadata.get("build_ticket", "0"))
        build = store.get(build_id)
        if build and build.resolution:
            return JSONResponse(content={"code": build.resolution})

    # Root ticket → find any resolved build child.
    if ticket.type == "ui_request":
        for child in store.children(ticket.id):
            if child.type == "ui_build" and child.status == Status.RESOLVED and child.resolution:
                return JSONResponse(content={"code": child.resolution})

    raise HTTPException(status_code=400, detail="No bundle found for this ticket")


@app.get("/tokens.css")
async def tokens_css():
    """Serve design tokens CSS for iframe injection."""
    tokens_path = static_dir / "tokens.css"
    if tokens_path.is_file():
        from fastapi.responses import Response
        return Response(content=tokens_path.read_text(), media_type="text/css")
    raise HTTPException(status_code=404, detail="tokens.css not found")


# ─── SSE Stream ──────────────────────────────────────────────────────────────

@app.get("/events")
async def sse_stream():
    """Server-Sent Events stream for live ticket updates."""
    queue: asyncio.Queue = asyncio.Queue()
    sse_queues.append(queue)

    async def event_generator():
        try:
            # Send current state as initial payload.
            all_tickets = [t.to_dict() for t in store.list()]
            yield f"data: {json.dumps({'action': 'init', 'tickets': all_tickets})}\n\n"

            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_queues.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


# ─── Static Files ───────────────────────────────────────────────────────────

static_dir = Path(__file__).resolve().parent / "static"
static_dir.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
async def index():
    """Serve the frontend."""
    index_path = static_dir / "index.html"
    if index_path.is_file():
        return HTMLResponse(index_path.read_text())
    return HTMLResponse("<h1>Build static/index.html first</h1>")


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
