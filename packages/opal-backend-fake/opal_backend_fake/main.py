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
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from opal_backend_shared.pending_requests import PendingRequestMap
from opal_backend_shared.sse_sink import SSEAgentEventSink
from opal_backend_shared.local.api_surface import (
    StartRunResponse,
    create_api_router,
)
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
# Agent backend implementation
# ---------------------------------------------------------------------------

class FakeAgentBackend:
    """Canned-scenario implementation of the AgentBackend protocol."""

    async def start_run(self, scenario: str) -> StartRunResponse:
        if scenario not in SCENARIOS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown scenario: {scenario}. "
                       f"Available: {', '.join(SCENARIOS.keys())}",
            )

        run_id = str(uuid.uuid4())
        state = RunState(scenario)
        _runs[run_id] = state

        scenario_fn = SCENARIOS[scenario]
        state.task = asyncio.create_task(
            _run_scenario(run_id, scenario_fn, state.sink)
        )

        return StartRunResponse(run_id=run_id, scenario=scenario)

    async def event_stream(self, run_id: str) -> EventSourceResponse:
        state = _runs.get(run_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Run not found")

        async def generate():
            while True:
                line = await state.sink.queue.get()
                if line is None:
                    break
                yield {"data": line}

        return EventSourceResponse(generate())

    async def submit_input(
        self, run_id: str, request_id: str, response: Any
    ) -> dict:
        state = _runs.get(run_id)
        if state is None:
            raise HTTPException(status_code=404, detail="Run not found")

        resolved = state.pending.resolve(request_id, response)
        if not resolved:
            raise HTTPException(
                status_code=404,
                detail=f"No pending request with id: {request_id}",
            )

        return {"ok": True}

    async def abort_run(self, run_id: str) -> dict:
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
# Wire it up via the shared API surface
# ---------------------------------------------------------------------------

_agent = FakeAgentBackend()
router = create_api_router(agent=_agent)
app.include_router(router)


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
