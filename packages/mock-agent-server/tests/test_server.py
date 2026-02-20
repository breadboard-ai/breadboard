# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Integration tests for the mock agent server.

Tests each scenario end-to-end by driving the SSEAgentEventSink directly
(same approach the FastAPI endpoints use), which avoids httpx SSE streaming
issues in test. Also tests the HTTP endpoints for error cases.

All scenarios are called with delay=0 to skip inter-event sleeps.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from mock_agent_server import main as server_module
from mock_agent_server.main import app
from mock_agent_server.pending_requests import PendingRequestMap
from mock_agent_server.scenarios import (
    chat_scenario,
    consent_scenario,
    echo_scenario,
    graph_edit_scenario,
)
from mock_agent_server.sse_sink import SSEAgentEventSink

# Skip the 60s cleanup delay in tests.
server_module._CLEANUP_DELAY = 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def collect_sink_events(
    sink: SSEAgentEventSink,
    timeout: float = 10.0,
) -> list[dict]:
    """Drain all events from a sink queue, parsing JSON."""
    events: list[dict] = []
    try:
        async with asyncio.timeout(timeout):
            while True:
                line = await sink.queue.get()
                if line is None:
                    break
                events.append(json.loads(line))
    except TimeoutError:
        pass
    return events


# ---------------------------------------------------------------------------
# Echo scenario (no suspends)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_echo_scenario():
    """Echo scenario emits a complete event sequence with no suspends."""
    pending = PendingRequestMap()
    sink = SSEAgentEventSink(pending)

    task = asyncio.create_task(echo_scenario(sink, delay=0))
    events = await collect_sink_events(sink)
    await task

    types = [e["type"] for e in events]
    assert types[0] == "start"
    assert "thought" in types
    assert "functionCall" in types
    assert "functionCallUpdate" in types
    assert "functionResult" in types
    assert "content" in types
    assert types[-1] == "finish"


# ---------------------------------------------------------------------------
# Chat scenario (waitForInput suspend)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_chat_scenario():
    """Chat scenario suspends for user input and echoes it back."""
    pending = PendingRequestMap()
    sink = SSEAgentEventSink(pending)
    user_message = "Build me a chatbot"

    async def respond_to_suspends():
        """Watch the queue for suspend events and respond."""
        while True:
            line = await sink.queue.get()
            if line is None:
                collected.append(None)
                break
            event = json.loads(line)
            collected.append(event)
            if event.get("type") == "waitForInput":
                await asyncio.sleep(0.01)
                pending.resolve(event["requestId"], {
                    "input": {"parts": [{"text": user_message}]},
                })

    collected: list[dict | None] = []
    consumer = asyncio.create_task(respond_to_suspends())
    await asyncio.create_task(chat_scenario(sink, delay=0))
    await consumer

    events = [e for e in collected if e is not None]
    types = [e["type"] for e in events]

    assert "waitForInput" in types
    assert types[-1] == "finish"

    content_events = [e for e in events if e["type"] == "content"]
    assert len(content_events) > 0
    content_text = content_events[0]["content"]["parts"][0]["text"]
    assert user_message in content_text


# ---------------------------------------------------------------------------
# Graph-edit scenario (readGraph + applyEdits suspends)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_graph_edit_scenario():
    """Graph-edit scenario suspends for readGraph and applyEdits."""
    pending = PendingRequestMap()
    sink = SSEAgentEventSink(pending)

    mock_graph = {
        "graph": {
            "nodes": [
                {"id": "step-a", "type": "agent", "metadata": {"title": "Greet"}}
            ],
            "edges": [],
        }
    }

    async def respond_to_suspends():
        while True:
            line = await sink.queue.get()
            if line is None:
                collected.append(None)
                break
            event = json.loads(line)
            collected.append(event)
            if event.get("type") == "readGraph":
                await asyncio.sleep(0.01)
                pending.resolve(event["requestId"], mock_graph)
            elif event.get("type") == "applyEdits":
                await asyncio.sleep(0.01)
                pending.resolve(event["requestId"], {"success": True})

    collected: list[dict | None] = []
    consumer = asyncio.create_task(respond_to_suspends())
    await asyncio.create_task(graph_edit_scenario(sink, delay=0))
    await consumer

    events = [e for e in collected if e is not None]
    types = [e["type"] for e in events]

    assert "readGraph" in types
    assert "applyEdits" in types
    assert types[-1] == "finish"

    thought_events = [e for e in events if e["type"] == "thought"]
    assert any("1 node" in e["text"] for e in thought_events)


# ---------------------------------------------------------------------------
# Consent scenario (queryConsent suspend)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_consent_granted():
    """Consent scenario with consent granted."""
    pending = PendingRequestMap()
    sink = SSEAgentEventSink(pending)

    async def respond_to_suspends():
        while True:
            line = await sink.queue.get()
            if line is None:
                collected.append(None)
                break
            event = json.loads(line)
            collected.append(event)
            if event.get("type") == "queryConsent":
                await asyncio.sleep(0.01)
                pending.resolve(event["requestId"], True)

    collected: list[dict | None] = []
    consumer = asyncio.create_task(respond_to_suspends())
    await asyncio.create_task(consent_scenario(sink, delay=0))
    await consumer

    events = [e for e in collected if e is not None]
    types = [e["type"] for e in events]

    assert "queryConsent" in types
    assert types[-1] == "finish"

    content_events = [e for e in events if e["type"] == "content"]
    content_text = content_events[0]["content"]["parts"][0]["text"]
    assert "granting" in content_text.lower()


@pytest.mark.asyncio
async def test_consent_denied():
    """Consent scenario with consent denied."""
    pending = PendingRequestMap()
    sink = SSEAgentEventSink(pending)

    async def respond_to_suspends():
        while True:
            line = await sink.queue.get()
            if line is None:
                collected.append(None)
                break
            event = json.loads(line)
            collected.append(event)
            if event.get("type") == "queryConsent":
                await asyncio.sleep(0.01)
                pending.resolve(event["requestId"], False)

    collected: list[dict | None] = []
    consumer = asyncio.create_task(respond_to_suspends())
    await asyncio.create_task(consent_scenario(sink, delay=0))
    await consumer

    events = [e for e in collected if e is not None]
    content_events = [e for e in events if e["type"] == "content"]
    content_text = content_events[0]["content"]["parts"][0]["text"]
    assert "declined" in content_text.lower()


# ---------------------------------------------------------------------------
# HTTP endpoint error cases
# ---------------------------------------------------------------------------


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Root endpoint returns server info."""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "scenarios" in data
    assert "echo" in data["scenarios"]


@pytest.mark.asyncio
async def test_unknown_scenario_returns_400(client: AsyncClient):
    """Starting an unknown scenario returns 400."""
    resp = await client.post(
        "/api/agent/run",
        json={"scenario": "nonexistent"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_unknown_run_returns_404(client: AsyncClient):
    """Requesting input for an unknown runId returns 404."""
    resp = await client.post(
        "/api/agent/fake-id/input",
        json={"request_id": "x", "response": {}},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_start_run_returns_run_id(client: AsyncClient):
    """Starting a run returns a run_id and scenario name."""
    resp = await client.post(
        "/api/agent/run",
        json={"scenario": "echo"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "run_id" in data
    assert data["scenario"] == "echo"
