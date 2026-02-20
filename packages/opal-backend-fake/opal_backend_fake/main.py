# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
FastAPI application implementing the Opal agent event SSE protocol
with canned scenarios for integration testing.

Endpoints:
    POST /api/agent/run           — Start a canned scenario
    GET  /api/agent/{runId}/events — SSE stream of AgentEvent NDJSON
    POST /api/agent/{runId}/input  — Resume a suspended request
    POST /api/agent/{runId}/abort  — Abort a run
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from opal_backend_shared.pending_requests import PendingRequestMap
from opal_backend_shared.sse_sink import SSEAgentEventSink
from .scenarios import SCENARIOS

app = FastAPI(
    title="Opal Fake Backend",
    description="Canned-scenario server for integration testing",
    version="0.1.0",
)

# Allow the visual-editor dev server to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    """Landing page with available scenarios and endpoints."""
    return {
        "name": "Opal Fake Backend",
        "endpoints": {
            "POST /api/agent/run": "Start a scenario",
            "GET /api/agent/{runId}/events": "SSE event stream",
            "POST /api/agent/{runId}/input": "Resume a suspend",
            "POST /api/agent/{runId}/abort": "Abort a run",
        },
        "scenarios": list(SCENARIOS.keys()),
    }


# ---------------------------------------------------------------------------
# In-memory run state
# ---------------------------------------------------------------------------

class RunState:
    """All state for a single agent run."""

    def __init__(self, scenario_name: str) -> None:
        self.scenario_name = scenario_name
        self.pending = PendingRequestMap()
        self.sink = SSEAgentEventSink(self.pending)
        self.task: asyncio.Task | None = None
        self.aborted = False


# Active runs, keyed by runId
_runs: dict[str, RunState] = {}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class StartRunRequest(BaseModel):
    scenario: str = "echo"


class StartRunResponse(BaseModel):
    run_id: str
    scenario: str


class InputRequest(BaseModel):
    request_id: str
    response: dict | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/agent/run")
async def start_run(req: StartRunRequest) -> StartRunResponse:
    """Start a new agent run with the specified scenario."""
    if req.scenario not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario: {req.scenario}. "
                   f"Available: {', '.join(SCENARIOS.keys())}",
        )

    run_id = str(uuid.uuid4())
    state = RunState(req.scenario)
    _runs[run_id] = state

    # Launch the scenario in a background task.
    # It writes events to state.sink.queue, which the SSE endpoint reads.
    scenario_fn = SCENARIOS[req.scenario]
    state.task = asyncio.create_task(
        _run_scenario(run_id, scenario_fn, state.sink)
    )

    return StartRunResponse(run_id=run_id, scenario=req.scenario)


@app.get("/api/agent/{run_id}/events")
async def event_stream(run_id: str) -> EventSourceResponse:
    """SSE stream of AgentEvent NDJSON for the given run."""
    state = _runs.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generate():
        while True:
            line = await state.sink.queue.get()
            if line is None:
                # Stream complete
                break
            yield {"data": line}

    return EventSourceResponse(generate())


@app.post("/api/agent/{run_id}/input")
async def submit_input(run_id: str, req: InputRequest) -> dict:
    """Resume a suspended request with the client's response."""
    state = _runs.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")

    resolved = state.pending.resolve(req.request_id, req.response)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"No pending request with id: {req.request_id}",
        )

    return {"ok": True}


@app.post("/api/agent/{run_id}/abort")
async def abort_run(run_id: str) -> dict:
    """Abort a running scenario."""
    state = _runs.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")

    state.aborted = True
    state.pending.abort_all()
    if state.task and not state.task.done():
        state.task.cancel()
    await state.sink.close()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _run_scenario(
    run_id: str,
    scenario_fn,
    sink: SSEAgentEventSink,
) -> None:
    """Run a scenario and clean up on completion or error."""
    try:
        await scenario_fn(sink)
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        from opal_backend_shared.events import ErrorEvent
        await sink.emit(ErrorEvent(message=str(exc)))
        await sink.close()
    finally:
        # Keep run state around briefly for the client to read any
        # remaining events, then clean up.
        await asyncio.sleep(_CLEANUP_DELAY)
        _runs.pop(run_id, None)


# Cleanup delay — 60s for production, overridden to 0 in tests.
_CLEANUP_DELAY = 60
