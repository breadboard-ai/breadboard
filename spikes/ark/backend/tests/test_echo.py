"""Tests for ark backend endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from ark_backend.main import app, runs


@pytest.fixture(autouse=True)
def clear_runs():
    runs.clear()


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_echo(client: AsyncClient):
    response = await client.post("/echo", json={"message": "hello"})
    assert response.status_code == 200
    assert response.json() == {"echo": "hello"}


@pytest.mark.asyncio
async def test_start_run(client: AsyncClient):
    response = await client.post(
        "/agent/runs/start",
        json={"objective": "build a dashboard", "type": "ui"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert len(data["id"]) == 12


@pytest.mark.asyncio
async def test_start_run_bad_type(client: AsyncClient):
    response = await client.post(
        "/agent/runs/start",
        json={"objective": "whatever", "type": "unknown"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_status_empty(client: AsyncClient):
    response = await client.get("/agent/runs/status")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_status_after_start(client: AsyncClient):
    await client.post(
        "/agent/runs/start",
        json={"objective": "test dashboard", "type": "ui"},
    )
    response = await client.get("/agent/runs/status")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["objective"] == "test dashboard"
    assert data[0]["status"] == "running"
    assert data[0]["total_steps"] > 0


@pytest.mark.asyncio
async def test_stream_run_not_found(client: AsyncClient):
    response = await client.get("/agent/runs/nonexistent")
    assert response.status_code == 404
