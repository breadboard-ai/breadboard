"""Tests for the /echo endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from ark_backend.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_echo(client: AsyncClient):
    response = await client.post("/echo", json={"message": "hello"})
    assert response.status_code == 200
    assert response.json() == {"echo": "hello"}
