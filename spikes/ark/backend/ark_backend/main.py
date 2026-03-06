"""Ark backend — FastAPI spike server."""

import asyncio
import json
import mimetypes
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ark_backend.artifacts import generate_artifacts

app = FastAPI(title="Ark Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve the out/ directory relative to the project root (one level above
# the ark_backend package).
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Serve generated artifacts as static files.
app.mount("/out", StaticFiles(directory=str(OUT_DIR)), name="out")

# ---------------------------------------------------------------------------
# Echo
# ---------------------------------------------------------------------------


class EchoRequest(BaseModel):
    message: str


class EchoResponse(BaseModel):
    echo: str


@app.post("/echo")
async def echo(request: EchoRequest) -> EchoResponse:
    """Echo the incoming message back."""
    return EchoResponse(echo=request.message)


# ---------------------------------------------------------------------------
# Agent runs
# ---------------------------------------------------------------------------

# Simulated generation steps — each is (delay_seconds, event_data).
_SIMULATION_STEPS = [
    (0.5,  {"step": "thinking",    "detail": "Analyzing objective…"}),
    (1.5,  {"step": "planning",    "detail": "Breaking down into components…"}),
    (1.0,  {"step": "scaffolding", "detail": "Generating HTML skeleton…"}),
    (3.0,  {"step": "component",   "detail": "Building header component…",    "code": "<header>…</header>"}),
    (2.5,  {"step": "component",   "detail": "Building main content area…",   "code": "<main>…</main>"}),
    (3.0,  {"step": "component",   "detail": "Building sidebar navigation…",  "code": "<nav>…</nav>"}),
    (2.5,  {"step": "styling",     "detail": "Applying design tokens…"}),
    (2.0,  {"step": "styling",     "detail": "Adding responsive breakpoints…"}),
    (2.0,  {"step": "refinement",  "detail": "Polishing interactions…"}),
    (1.5,  {"step": "refinement",  "detail": "Accessibility pass…"}),
    (0.5,  {"step": "complete",    "detail": "UI generation finished."}),
]


@dataclass
class Run:
    id: str
    objective: str
    agent_type: str
    status: str = "running"  # "running" | "complete"
    current_step: str = "starting"
    current_detail: str = "Initializing…"
    progress: int = 0  # 0..total steps
    total_steps: int = len(_SIMULATION_STEPS)
    events: list[dict] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    # Subscribers waiting for new events (live SSE connections).
    subscribers: list[asyncio.Queue] = field(default_factory=list)


# In-memory run store (spike-grade).
runs: dict[str, Run] = {}


def _hydrate_from_disk():
    """Populate runs from existing artifacts in OUT_DIR (survives restarts)."""
    if not OUT_DIR.is_dir():
        return
    for run_dir in OUT_DIR.iterdir():
        if not run_dir.is_dir():
            continue
        run_id = run_dir.name
        if run_id in runs:
            continue

        # Extract objective from SKILL.md heading: "# Generated UI: <objective>"
        skill_path = run_dir / "SKILL.md"
        objective = run_id  # fallback
        if skill_path.is_file():
            first_line = skill_path.read_text().split("\n", 1)[0]
            if first_line.startswith("# Generated UI: "):
                objective = first_line.removeprefix("# Generated UI: ")

        # Collect all files relative to the run dir.
        artifacts = [
            str(p.relative_to(run_dir))
            for p in sorted(run_dir.rglob("*"))
            if p.is_file()
        ]

        runs[run_id] = Run(
            id=run_id,
            objective=objective,
            agent_type="ui",
            status="complete",
            current_step="complete",
            current_detail="UI generation finished.",
            progress=len(_SIMULATION_STEPS),
            artifacts=artifacts,
        )


_hydrate_from_disk()


class StartRunRequest(BaseModel):
    objective: str
    type: str = "ui"


class StartRunResponse(BaseModel):
    id: str


async def _simulate_run(run: Run):
    """Background task that walks through simulation steps."""
    for i, (delay, data) in enumerate(_SIMULATION_STEPS):
        await asyncio.sleep(delay)
        run.current_step = data["step"]
        run.current_detail = data["detail"]
        run.progress = i + 1

        event = {"type": "progress", **data}
        run.events.append(event)
        for q in run.subscribers:
            await q.put(event)

    # Generate artifacts on completion.
    files = generate_artifacts(run.id, run.objective, OUT_DIR)
    run.artifacts = files

    run.status = "complete"
    done_event = {"type": "done", "id": run.id, "artifacts": files}
    run.events.append(done_event)
    for q in run.subscribers:
        await q.put(done_event)


@app.post("/agent/runs/start")
async def start_run(request: StartRunRequest) -> StartRunResponse:
    """Create a new agent run and return its ID."""
    if request.type != "ui":
        raise HTTPException(status_code=400, detail=f"Unknown agent type: {request.type}")

    run_id = uuid.uuid4().hex[:12]
    run = Run(id=run_id, objective=request.objective, agent_type=request.type)
    runs[run_id] = run
    asyncio.create_task(_simulate_run(run))
    return StartRunResponse(id=run_id)


@app.get("/agent/runs/status")
async def list_runs():
    """Return current status of all runs (for polling)."""
    return [
        {
            "id": r.id,
            "objective": r.objective,
            "status": r.status,
            "current_step": r.current_step,
            "current_detail": r.current_detail,
            "progress": r.progress,
            "total_steps": r.total_steps,
            "artifacts": r.artifacts,
        }
        for r in runs.values()
    ]


async def _stream_run(run: Run):
    """Yield SSE events — replay history, then stream live."""
    yield f"event: start\ndata: {json.dumps({'id': run.id, 'objective': run.objective})}\n\n"

    # Replay events that already happened.
    for event in list(run.events):
        etype = event["type"]
        yield f"event: {etype}\ndata: {json.dumps(event)}\n\n"

    if run.status == "complete":
        return

    # Subscribe for live events.
    queue: asyncio.Queue = asyncio.Queue()
    run.subscribers.append(queue)
    try:
        while True:
            event = await queue.get()
            etype = event["type"]
            yield f"event: {etype}\ndata: {json.dumps(event)}\n\n"
            if etype == "done":
                return
    finally:
        run.subscribers.remove(queue)


@app.get("/agent/runs/{run_id}")
async def stream_run(run_id: str):
    """Stream SSE events for the given run (replay + live)."""
    run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return StreamingResponse(
        _stream_run(run),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Artifact bundle
# ---------------------------------------------------------------------------

BOUNDARY = "ark-bundle-boundary"


def _stream_bundle(run_id: str, files: list[str]):
    """Yield a multipart/mixed body with one part per artifact file."""
    run_dir = OUT_DIR / run_id
    for rel_path in files:
        path = run_dir / rel_path
        if not path.is_file():
            continue
        content_type = mimetypes.guess_type(rel_path)[0] or "application/octet-stream"
        yield f"--{BOUNDARY}\r\n".encode()
        yield f"Content-Disposition: attachment; filename=\"{rel_path}\"\r\n".encode()
        yield f"Content-Type: {content_type}\r\n".encode()
        yield b"\r\n"
        yield path.read_bytes()
        yield b"\r\n"
    yield f"--{BOUNDARY}--\r\n".encode()


@app.get("/agent/runs/{run_id}/bundle")
async def get_bundle(run_id: str):
    """Return all artifacts for a run as a multipart/mixed bundle."""
    run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "complete":
        raise HTTPException(status_code=409, detail="Run not yet complete")
    if not run.artifacts:
        raise HTTPException(status_code=404, detail="No artifacts")
    return StreamingResponse(
        _stream_bundle(run_id, run.artifacts),
        media_type=f"multipart/mixed; boundary={BOUNDARY}",
    )
