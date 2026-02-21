# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
FastAPI application implementing the Opal agent event protocol
with canned scenarios for integration testing.

Protocol:
    POST /api/agent/run → SSE stream (Resumable Stream Protocol)

    Body (start): {"kind": "fake", "objective": {"scenario": "<name>"}}
    Body (resume): {"interactionId": "...", "response": {...}}
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from opal_backend_shared.pending_requests import PendingRequestMap
from opal_backend_shared.sse_sink import SSEAgentEventSink
from opal_backend_shared.local.api_surface import create_api_router
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
        "endpoint": "POST /api/agent/run → SSE stream",
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
    """Canned-scenario implementation of the AgentBackend protocol.

    Single POST /api/agent/run → SSE stream.
    Scenario name is extracted from the objective.
    """

    async def run(self, request: Request) -> EventSourceResponse:
        body = await request.json()

        # Extract scenario name from the request body.
        # Start request: {"kind": "fake", "objective": {"scenario": "echo"}}
        # For backwards compat, also check top-level "scenario" key.
        objective = body.get("objective", {})
        if isinstance(objective, dict):
            scenario = objective.get("scenario", "")
        else:
            scenario = ""

        # Fallback: top-level scenario key.
        if not scenario:
            scenario = body.get("scenario", "echo")

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

        async def generate():
            while True:
                line = await state.sink.queue.get()
                if line is None:
                    break
                yield {"data": line}

        return EventSourceResponse(generate())


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
