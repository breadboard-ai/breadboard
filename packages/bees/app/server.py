# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees HTTP server — REST API + scheduler + SSE event stream.

Provides an agent-centric API for the Opal shell, plus
auto-scheduling and real-time status updates via Server-Sent Events.

Usage::

    npm run dev:server -w packages/bees
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse


from app.auth import load_gemini_key
from app.config import load_hive_dir
from bees import Task, Bees
from bees.runners.gemini import GeminiRunner
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger(__name__)

hive_dir = load_hive_dir()


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
bees: Bees | None = None


# ---------------------------------------------------------------------------
# Lifecycle hooks — application-specific behaviour wired to SSE
# ---------------------------------------------------------------------------


async def _on_task_added(task: Task) -> None:
    """Broadcast a newly added agent."""
    await broadcaster.broadcast({
        "type": "agent:added",
        "agent": _agent_to_dict(task),
    })


async def _on_cycle_start(cycle: int, new: int, resumable: int) -> None:
    await broadcaster.broadcast({
        "type": "scheduler:started",
        "wave": cycle,
        "new": new,
        "resumable": resumable,
    })


async def _on_task_event(task_id: str, event: dict[str, Any]) -> None:
    await broadcaster.broadcast({
        "type": "session:event",
        "task_id": task_id,
        "event": event,
    })


async def _on_task_start(task: Task) -> None:
    """Broadcast when an agent transitions to running."""
    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(task),
    })


async def _on_task_done(task: Task) -> None:
    """Post-completion hook: broadcast updated agent state."""
    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(task),
    })



async def _on_cycle_complete(cycles: int) -> None:
    await broadcaster.broadcast({"type": "scheduler:stopped", "waves": cycles})


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class ReplyRequest(BaseModel):
    text: str


class ChooseRequest(BaseModel):
    selectedIds: list[str]


class UpdateTagsRequest(BaseModel):
    tags: list[str]


class BundleResponse(BaseModel):
    js: str
    css: str | None = None


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global bees

    gemini_key = load_gemini_key()
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    backend = HttpBackendClient(
        upstream_base="",
        httpx_client=http_client,
        access_token="",
        gemini_key=gemini_key,
    )

    runner = GeminiRunner(backend)
    bees = Bees(hive_dir, runner)

    bees.on("task_added", _on_task_added)
    bees.on("cycle_start", _on_cycle_start)
    bees.on("task_event", _on_task_event)
    bees.on("task_start", _on_task_start)
    bees.on("task_done", _on_task_done)
    bees.on("cycle_complete", _on_cycle_complete)

    await bees.listen()

    yield

    await bees.shutdown()
    await http_client.aclose()


app = FastAPI(title="Bees", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _agent_to_dict(task: Task) -> dict[str, Any]:
    """Serialize an agent (task) for JSON response."""
    d = {
        "id": task.id,
        "objective": task.objective,
        **task.metadata.to_dict(),
    }
    # Include chat history for chat-tagged agents so the shell can
    # restore conversation after page reload / server restart.
    if task.metadata.tags and "chat" in task.metadata.tags:
        d["chat_history"] = _read_chat_log(task)
    return d


def _read_chat_log(task: Task) -> list[dict[str, str]]:
    """Read the agent's chat log written by the chat function.

    Returns a list of ``{"role": "agent"|"user", "text": "..."}`` entries.
    """
    log_path = task.dir / "chat_log.json"
    if not log_path.exists():
        return []
    try:
        return json.loads(log_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _require_bees() -> Bees:
    """Return the Bees instance, raising 500 if not yet initialized."""
    if not bees:
        raise HTTPException(500, "Bees not initialized")
    return bees


def _get_node(agent_id: str):
    """Look up a node by agent ID, raising 404 if not found."""
    b = _require_bees()
    node = b.get_by_id(agent_id)
    if not node:
        raise HTTPException(404, f"Agent {agent_id} not found")
    return node


# ---------------------------------------------------------------------------
# REST endpoints — Commands (writes)
# ---------------------------------------------------------------------------


@app.post("/agents/{agent_id}/reply")
async def reply_to_agent(agent_id: str, req: ReplyRequest) -> dict[str, Any]:
    """Send a chat reply to a suspended agent."""
    node = _get_node(agent_id)
    task = node.task
    if task.metadata.status != "suspended":
        raise HTTPException(400, "Agent is not suspended")
    if task.metadata.assignee != "user":
        raise HTTPException(400, "Agent is not assigned to user")

    task = node.respond({"text": req.text})

    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(task),
    })

    return _agent_to_dict(task)


@app.post("/agents/{agent_id}/choose")
async def choose_for_agent(
    agent_id: str, req: ChooseRequest,
) -> dict[str, Any]:
    """Submit a choice selection to a suspended agent."""
    node = _get_node(agent_id)
    task = node.task
    if task.metadata.status != "suspended":
        raise HTTPException(400, "Agent is not suspended")
    if task.metadata.assignee != "user":
        raise HTTPException(400, "Agent is not assigned to user")

    task = node.respond({"selectedIds": req.selectedIds})

    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(task),
    })

    return _agent_to_dict(task)


@app.post("/agents/{agent_id}/retry")
async def retry_agent(agent_id: str) -> dict[str, Any]:
    """Retry a paused agent by flipping it back to available.

    Paused agents are those that hit a transient Gemini API error
    (e.g. 503).  Retrying clears the error and re-queues the agent
    for the scheduler to pick up.
    """
    node = _get_node(agent_id)
    if node.task.metadata.status != "paused":
        raise HTTPException(400, "Agent is not paused")

    node.retry()

    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(node.task),
    })

    return _agent_to_dict(node.task)


@app.post("/agents/{agent_id}/tags")
async def update_agent_tags(
    agent_id: str, req: UpdateTagsRequest
) -> dict[str, Any]:
    """Update tags for an agent and broadcast."""
    node = _get_node(agent_id)

    node.task.metadata.tags = req.tags
    node.save()

    await broadcaster.broadcast({
        "type": "agent:updated",
        "agent": _agent_to_dict(node.task),
    })

    return _agent_to_dict(node.task)


# ---------------------------------------------------------------------------
# REST endpoints — Queries (reads)
# ---------------------------------------------------------------------------


@app.get("/agents/{agent_id}/bundle")
async def get_agent_bundle(
    agent_id: str, slug: str | None = None,
) -> dict[str, Any]:
    """Return the resolved JS (and optional CSS) bundle for an agent.

    When ``slug`` is provided, only files under the slug subdirectory
    are considered. This prevents loading a sibling agent's bundle from
    the shared workspace.
    """
    node = _get_node(agent_id)
    fs_dir = node.task.fs_dir
    if not fs_dir.is_dir():
        raise HTTPException(404, "No files for this agent")

    all_files = [
        str(p.relative_to(fs_dir))
        for p in fs_dir.rglob("*")
        if p.is_file()
    ]

    # Scope to the agent's slug subdirectory when present.
    files = (
        [f for f in all_files if f.startswith(slug + "/")]
        if slug
        else all_files
    )

    js_file = next((f for f in files if f.endswith(".js")), None)
    if not js_file:
        raise HTTPException(404, "No JS bundle found")

    js_content = (fs_dir / js_file).read_text(encoding="utf-8")

    css_file = next((f for f in files if f.endswith(".css")), None)
    css_content = (
        (fs_dir / css_file).read_text(encoding="utf-8")
        if css_file
        else None
    )

    return {"js": js_content, "css": css_content}


@app.get("/agents/{agent_id}/files")
async def list_agent_files(agent_id: str) -> list[str]:
    """List files in the agent's filesystem directory."""
    node = _get_node(agent_id)

    fs_dir = node.task.fs_dir
    if not fs_dir.is_dir():
        return []

    return [
        str(p.relative_to(fs_dir))
        for p in fs_dir.rglob("*")
        if p.is_file()
    ]


@app.get("/agents/{agent_id}/files/{path:path}")
async def get_agent_file(agent_id: str, path: str) -> FileResponse:
    """Serve files from the agent's filesystem."""
    node = _get_node(agent_id)

    file_path = node.task.fs_dir / path
    if not file_path.is_file():
        raise HTTPException(404, f"File {path} not found")

    try:
        file_path.resolve().relative_to(node.task.fs_dir.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")

    return FileResponse(file_path)


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------


@app.get("/events")
async def events() -> EventSourceResponse:
    """Server-Sent Events stream for real-time updates."""
    b = _require_bees()

    queue = broadcaster.subscribe()

    async def event_generator() -> AsyncIterator[dict]:
        try:
            # Send initial state.
            yield {
                "event": "init",
                "data": json.dumps([
                    _agent_to_dict(n.task) for n in b.all
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
