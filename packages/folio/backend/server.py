# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from contextlib import asynccontextmanager
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uuid
from dotenv import load_dotenv
from pydantic import BaseModel
from bees.bees import Bees
from bees.playbook import load_playbook
from opal_backend.local.backend_client_impl import HttpBackendClient

# Load environment variables from .env file
load_dotenv()

HIVE_DIR = Path(__file__).parent / "hive"
bees: Bees | None = None
http_client: httpx.AsyncClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global bees, http_client
    
    gemini_key = os.environ.get("GEMINI_KEY", "")
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    backend = HttpBackendClient(
        upstream_base="",
        httpx_client=http_client,
        access_token="",
        gemini_key=gemini_key,
    )
    
    # Pass None for http as discussed, since it's unused in Bees
    bees = Bees(hive_dir=HIVE_DIR, http=None, backend=backend)
    
    # Start the background scheduler
    await bees.listen()
    
    yield
    
    await bees.shutdown()
    await http_client.aclose()

app = FastAPI(title="Folio", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/folio/tasks")
async def get_tasks():
    if not bees:
        raise HTTPException(500, "Bees not initialized")
    roots = bees._store.get_children(None)
    return [
        {
            "id": t.id,
            "title": t.metadata.title or t.objective[:30],
            "status": t.metadata.status,
            "timestamp": t.metadata.created_at
        }
        for t in roots
    ]

@app.get("/folio/tasks/{task_id}/blocks")
async def get_blocks(task_id: str):
    if not bees:
        raise HTTPException(500, "Bees not initialized")
    ticket = bees._store.get(task_id)
    if not ticket:
        raise HTTPException(404, "Task not found")
        
    children = bees._store.get_children(task_id)
    
    all_tickets = [ticket] + children
    all_tickets.sort(key=lambda t: t.metadata.created_at or "")
    
    blocks = []
    for t in all_tickets:
        block_type = "markdown"
        if t.metadata.status == "running" and bees._store.get_children(t.id):
            block_type = "parallel_workload"
            
        blocks.append({
            "id": t.id,
            "type": block_type,
            "status": t.metadata.status,
            "content": {
                "objective": t.objective,
                "outcome": t.metadata.outcome,
                "title": t.metadata.title
            },
            "timestamp": t.metadata.created_at
        })
        
    return blocks

class TaskCreate(BaseModel):
    objective: str

@app.post("/folio/tasks")
async def create_task(req: TaskCreate):
    if not bees:
        raise HTTPException(500, "Bees not initialized")
        
    # Load playbook and create ticket via public API to wake up scheduler
    data = load_playbook("opie", HIVE_DIR / "config")
    node = await bees.create_child(
        req.objective,
        title=data.get("title"),
        functions=data.get("functions"),
        skills=data.get("skills"),
        tags=data.get("tags"),
        assignee=data.get("assignee"),
        model=data.get("model"),
        watch_events=data.get("watch_events"),
        tasks=data.get("tasks"),
        playbook_id=data.get("name", "opie"),
        playbook_run_id=str(uuid.uuid4()),
    )
    ticket = node.task
    
    return {"id": ticket.id, "message": "Task created and queued for Opie"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
