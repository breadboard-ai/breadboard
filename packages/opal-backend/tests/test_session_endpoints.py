# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Integration tests for session REST endpoints."""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from opal_backend.sessions.api import Subscribers
from opal_backend.local.session_router import create_session_router
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from opal_backend.sessions.store import SessionStatus


@pytest.fixture
def store():
    return InMemorySessionStore()


@pytest.fixture
def client(store):
    app = FastAPI()
    app.include_router(create_session_router(store, Subscribers()))
    return TestClient(app)


# ── POST /v1beta1/sessions/new ──


def test_create_session(client):
    resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "sessionId" in data


# ── GET /v1beta1/sessions/{id}/status ──


def test_get_status(client):
    # Create a session first.
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]

    resp = client.get(f"/v1beta1/sessions/{session_id}/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sessionId"] == session_id
    assert data["status"] == "running"
    assert data["eventCount"] == 0


def test_get_status_not_found(client):
    resp = client.get("/v1beta1/sessions/nonexistent/status")
    assert resp.status_code == 404


# ── GET /v1beta1/sessions/{id} (SSE stream) ──


def test_stream_events(client):
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]

    resp = client.get(f"/v1beta1/sessions/{session_id}")
    assert resp.status_code == 200
    # SSE responses contain event: and data: lines.
    body = resp.text
    assert "event: start" in body
    assert session_id in body
    assert "event: done" in body


def test_stream_events_not_found(client):
    resp = client.get("/v1beta1/sessions/nonexistent")
    assert resp.status_code == 404


# ── POST /v1beta1/sessions/{id}:resume ──


@pytest.mark.asyncio
async def test_resume_suspended_session(client, store):
    # Create and manually suspend.
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]
    await store.set_status(session_id, SessionStatus.SUSPENDED)

    resp = client.post(
        f"/v1beta1/sessions/{session_id}:resume",
        json={"response": {"input": {"role": "user", "parts": [{"text": "Yes"}]}}},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_resume_not_suspended(client):
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]

    resp = client.post(
        f"/v1beta1/sessions/{session_id}:resume",
        json={"response": {}},
    )
    assert resp.status_code == 409


def test_resume_not_found(client):
    resp = client.post(
        "/v1beta1/sessions/nonexistent:resume",
        json={"response": {}},
    )
    assert resp.status_code == 404


# ── POST /v1beta1/sessions/{id}:cancel ──


def test_cancel_running_session(client):
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]

    resp = client.post(f"/v1beta1/sessions/{session_id}:cancel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"

    # Verify status is actually cancelled.
    status_resp = client.get(f"/v1beta1/sessions/{session_id}/status")
    assert status_resp.json()["status"] == "cancelled"


def test_cancel_already_terminal(client):
    create_resp = client.post(
        "/v1beta1/sessions/new",
        json={"segments": [{"type": "text", "text": "Hello"}]},
    )
    session_id = create_resp.json()["sessionId"]

    # Cancel once.
    client.post(f"/v1beta1/sessions/{session_id}:cancel")

    # Cancel again — should 409.
    resp = client.post(f"/v1beta1/sessions/{session_id}:cancel")
    assert resp.status_code == 409


def test_cancel_not_found(client):
    resp = client.post("/v1beta1/sessions/nonexistent:cancel")
    assert resp.status_code == 404
