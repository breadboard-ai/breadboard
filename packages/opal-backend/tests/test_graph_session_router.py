# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for graph session router — integration tests using FastAPI TestClient.

Phase 3 🎯: curl starts a graph run, receives SSE events for each node.
"""

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from opal_backend.graph_runner import GraphRunner
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_router import create_graph_session_router
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


def _create_app():
    """Create a FastAPI app with graph session router wired up."""
    store = InMemoryGraphSessionStore()
    bus = InMemoryEventBus()
    runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
    scheduler = LocalTaskScheduler(run_fn=runner.run_node)
    runner._scheduler = scheduler

    router = create_graph_session_router(
        store=store, event_bus=bus, runner=runner, scheduler=scheduler,
    )

    app = FastAPI()
    app.include_router(router)
    return app, store, bus


def _simple_graph() -> dict:
    """A two-node inline graph (generate → output)."""
    return {
        "nodes": [
            {"id": "gen", "type": "generate"},
            {"id": "out", "type": "output"},
        ],
        "edges": [
            {
                "from": "gen", "to": "out",
                "out": "context", "in": "result",
            },
        ],
    }


def _three_node_graph() -> dict:
    """generate → generate → output."""
    return {
        "nodes": [
            {"id": "gen1", "type": "generate"},
            {"id": "gen2", "type": "generate"},
            {"id": "out", "type": "output"},
        ],
        "edges": [
            {"from": "gen1", "to": "gen2", "out": "context", "in": "input"},
            {"from": "gen2", "to": "out", "out": "context", "in": "result"},
        ],
    }


class TestCreateGraphSession:
    def test_creates_session(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessionId" in data

    def test_missing_graph_returns_400(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.post(
            "/v1beta1/graphSessions/new", json={},
        )
        assert resp.status_code == 400
        assert "Missing" in resp.json()["error"]

    def test_empty_graph_returns_400(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": {"nodes": [], "edges": []}},
        )
        assert resp.status_code == 400


class TestStreamGraphEvents:
    def test_sse_stream_has_events(self):
        app, store, bus = _create_app()
        client = TestClient(app)

        # Create session.
        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        session_id = resp.json()["sessionId"]

        # Stream events (graph should complete synchronously during POST).
        with client.stream(
            "GET", f"/v1beta1/graphSessions/{session_id}",
        ) as sse_resp:
            assert sse_resp.status_code == 200
            raw = sse_resp.read().decode()

        # Parse SSE data events.
        events = _parse_sse_events(raw)
        types = [e.get("type") for e in events if "type" in e]
        assert "graphStart" in types
        assert "nodeStart" in types
        assert "nodeEnd" in types
        assert "graphComplete" in types

    def test_three_node_sse_stream(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _three_node_graph()},
        )
        session_id = resp.json()["sessionId"]

        with client.stream(
            "GET", f"/v1beta1/graphSessions/{session_id}",
        ) as sse_resp:
            raw = sse_resp.read().decode()

        events = _parse_sse_events(raw)
        node_starts = [
            e for e in events if e.get("type") == "nodeStart"
        ]
        assert len(node_starts) == 3

    def test_stream_not_found(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.get("/v1beta1/graphSessions/missing")
        assert resp.status_code == 404

    def test_replay_with_after_parameter(self):
        app, store, bus = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        session_id = resp.json()["sessionId"]

        # Get all events first.
        with client.stream(
            "GET", f"/v1beta1/graphSessions/{session_id}",
        ) as sse_resp:
            all_raw = sse_resp.read().decode()
        all_events = _parse_sse_events(all_raw)

        # Now request with after=2 to skip some.
        with client.stream(
            "GET", f"/v1beta1/graphSessions/{session_id}?after=2",
        ) as sse_resp:
            partial_raw = sse_resp.read().decode()
        partial_events = _parse_sse_events(partial_raw)

        assert len(partial_events) < len(all_events)


class TestStatusEndpoint:
    def test_status_completed(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        session_id = resp.json()["sessionId"]

        resp = client.get(f"/v1beta1/graphSessions/{session_id}/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["sessionId"] == session_id
        assert data["status"] == "completed"

    def test_status_not_found(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.get("/v1beta1/graphSessions/missing/status")
        assert resp.status_code == 404


class TestCancelEndpoint:
    def test_cancel_session(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        session_id = resp.json()["sessionId"]

        resp = client.post(f"/v1beta1/graphSessions/{session_id}:cancel")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"

    def test_cancel_not_found(self):
        app, *_ = _create_app()
        client = TestClient(app)
        resp = client.post("/v1beta1/graphSessions/missing:cancel")
        assert resp.status_code == 404


def _input_output_graph() -> dict:
    """An input → output graph that will suspend at input."""
    return {
        "nodes": [
            {"id": "inp", "type": "input", "configuration": {
                "prompt": "Enter something",
            }},
            {"id": "out", "type": "output"},
        ],
        "edges": [
            {"from": "inp", "to": "out", "out": "data", "in": "result"},
        ],
    }


class TestResumeEndpoint:
    def test_resume_completes_suspended_graph(self):
        app, store, bus = _create_app()
        client = TestClient(app)

        # Create — will suspend at input.
        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _input_output_graph()},
        )
        session_id = resp.json()["sessionId"]

        # Verify suspended.
        resp = client.get(f"/v1beta1/graphSessions/{session_id}/status")
        assert resp.json()["status"] == "suspended"

        # Get interaction ID from stored events.
        state = store._sessions[session_id]
        input_req = next(
            e for e in state.events if e.get("type") == "inputRequired"
        )
        interaction_id = input_req["interactionId"]

        # Resume.
        resp = client.post(
            f"/v1beta1/graphSessions/{session_id}:resume",
            json={
                "interactionId": interaction_id,
                "response": {"text": "Hello!"},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

        # Verify completed.
        resp = client.get(f"/v1beta1/graphSessions/{session_id}/status")
        assert resp.json()["status"] == "completed"

    def test_resume_missing_interaction_id(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _input_output_graph()},
        )
        session_id = resp.json()["sessionId"]

        resp = client.post(
            f"/v1beta1/graphSessions/{session_id}:resume",
            json={"response": {}},
        )
        assert resp.status_code == 400

    def test_resume_invalid_interaction_id(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _input_output_graph()},
        )
        session_id = resp.json()["sessionId"]

        resp = client.post(
            f"/v1beta1/graphSessions/{session_id}:resume",
            json={"interactionId": "bogus", "response": {}},
        )
        assert resp.status_code == 404

    def test_resume_not_found_session(self):
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/missing:resume",
            json={"interactionId": "x", "response": {}},
        )
        assert resp.status_code == 404


# ── helpers ──


def _parse_sse_events(raw: str) -> list[dict]:
    """Parse SSE text into a list of JSON event dicts."""
    events = []
    for line in raw.split("\n"):
        line = line.strip()
        if line.startswith("data:"):
            data_str = line[5:].strip()
            if data_str and data_str != "{}":
                try:
                    events.append(json.loads(data_str))
                except json.JSONDecodeError:
                    pass
    return events

