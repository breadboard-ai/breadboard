# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for Drive graph loading (graphId-based session creation).

Covers:
- ``get_file_media`` in ``HttpDriveOperationsClient`` (mock httpx)
- ``create_graph_session`` with ``graphId`` (mock Drive client)
- Error cases: graphId without accessToken, Drive errors
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from opal_backend.graph_runner import GraphRunner
from opal_backend.local.drive_operations_client_impl import (
    GOOGLE_DRIVE_FILES_API,
    HttpDriveOperationsClient,
)
from opal_backend.local.event_bus_impl import InMemoryEventBus
from opal_backend.local.graph_session_router import create_graph_session_router
from opal_backend.local.graph_session_store_impl import InMemoryGraphSessionStore
from opal_backend.local.task_scheduler_impl import LocalTaskScheduler


# =============================================================================
# Helpers
# =============================================================================

ACCESS_TOKEN = "test-token-456"


def _make_drive_client(handler) -> HttpDriveOperationsClient:
    """Build a Drive client backed by a mock httpx transport."""
    transport = httpx.MockTransport(handler)
    httpx_client = httpx.AsyncClient(transport=transport)
    return HttpDriveOperationsClient(
        httpx_client=httpx_client,
        access_token=ACCESS_TOKEN,
    )


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


def _create_app(drive_client_factory=None):
    """Create a FastAPI app with graph session router wired up."""
    store = InMemoryGraphSessionStore()
    bus = InMemoryEventBus()
    runner = GraphRunner(store=store, event_bus=bus, scheduler=None)
    scheduler = LocalTaskScheduler(run_fn=runner.run_node)
    runner._scheduler = scheduler

    router = create_graph_session_router(
        store=store,
        event_bus=bus,
        runner=runner,
        scheduler=scheduler,
        drive_client_factory=drive_client_factory,
    )

    app = FastAPI()
    app.include_router(router)
    return app, store, bus


# =============================================================================
# HttpDriveOperationsClient.get_file_media
# =============================================================================


class TestGetFileMedia:
    @pytest.mark.asyncio
    async def test_downloads_file_content(self):
        """get_file_media sends GET with ?alt=media and returns raw bytes."""
        graph_json = json.dumps(_simple_graph()).encode()
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(
                status_code=200,
                content=graph_json,
            )

        client = _make_drive_client(handler)
        result = await client.get_file_media("file-abc")

        assert result == graph_json
        assert len(captured) == 1
        assert captured[0].method == "GET"
        url = str(captured[0].url)
        assert f"{GOOGLE_DRIVE_FILES_API}/file-abc" in url
        assert "alt=media" in url
        assert captured[0].headers["authorization"] == f"Bearer {ACCESS_TOKEN}"

    @pytest.mark.asyncio
    async def test_raises_on_error_status(self):
        """get_file_media raises ValueError on non-200 response."""

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code=404)

        client = _make_drive_client(handler)
        with pytest.raises(ValueError, match="Drive API error"):
            await client.get_file_media("nonexistent")

    @pytest.mark.asyncio
    async def test_url_encodes_file_id(self):
        """get_file_media URL-encodes special characters in file_id."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(status_code=200, content=b"{}")

        client = _make_drive_client(handler)
        await client.get_file_media("id/with/slashes")

        url = str(captured[0].url)
        # Slashes in the ID should be percent-encoded.
        assert "id%2Fwith%2Fslashes" in url


# =============================================================================
# Router: graphId-based session creation
# =============================================================================


class TestGraphIdSessionCreation:
    def test_creates_session_from_graph_id(self):
        """graphId + accessToken loads graph from Drive and starts session."""
        graph_bytes = json.dumps(_simple_graph()).encode()

        mock_drive = AsyncMock()
        mock_drive.get_file_media = AsyncMock(return_value=graph_bytes)

        app, *_ = _create_app(
            drive_client_factory=lambda token: mock_drive,
        )
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "drive-file-123", "accessToken": "my-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessionId" in data

        # Verify the Drive client was called with the correct file ID.
        mock_drive.get_file_media.assert_awaited_once_with("drive-file-123")

    def test_graph_id_without_access_token_returns_400(self):
        """graphId without accessToken is an error."""
        app, *_ = _create_app(
            drive_client_factory=lambda token: AsyncMock(),
        )
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "drive-file-123"},
        )
        assert resp.status_code == 400
        assert "accessToken" in resp.json()["error"]

    def test_graph_id_without_factory_returns_500(self):
        """graphId without drive_client_factory configured is a server error."""
        app, *_ = _create_app(drive_client_factory=None)
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "drive-file-123", "accessToken": "token"},
        )
        assert resp.status_code == 500
        assert "not configured" in resp.json()["error"]

    def test_drive_error_returns_400(self):
        """Drive API error while loading graphId returns 400."""
        mock_drive = AsyncMock()
        mock_drive.get_file_media = AsyncMock(
            side_effect=ValueError("Drive API error: 404 Not Found"),
        )

        app, *_ = _create_app(
            drive_client_factory=lambda token: mock_drive,
        )
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "bad-id", "accessToken": "token"},
        )
        assert resp.status_code == 400
        assert "Failed to load graph from Drive" in resp.json()["error"]

    def test_invalid_json_from_drive_returns_400(self):
        """Non-JSON content from Drive returns 400."""
        mock_drive = AsyncMock()
        mock_drive.get_file_media = AsyncMock(
            return_value=b"this is not json",
        )

        app, *_ = _create_app(
            drive_client_factory=lambda token: mock_drive,
        )
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "bad-content", "accessToken": "token"},
        )
        assert resp.status_code == 400
        assert "Failed to load graph from Drive" in resp.json()["error"]

    def test_missing_both_graph_and_graph_id_returns_400(self):
        """Neither graph nor graphId returns 400."""
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"accessToken": "token"},
        )
        assert resp.status_code == 400
        assert "Missing" in resp.json()["error"]

    def test_inline_graph_still_works(self):
        """Existing inline graph path continues to work unchanged."""
        app, *_ = _create_app()
        client = TestClient(app)

        resp = client.post(
            "/v1beta1/graphSessions/new",
            json={"graph": _simple_graph()},
        )
        assert resp.status_code == 200
        assert "sessionId" in resp.json()

    def test_factory_receives_correct_token(self):
        """drive_client_factory is called with the request's accessToken."""
        graph_bytes = json.dumps(_simple_graph()).encode()
        captured_tokens: list[str] = []

        mock_drive = AsyncMock()
        mock_drive.get_file_media = AsyncMock(return_value=graph_bytes)

        def factory(token: str):
            captured_tokens.append(token)
            return mock_drive

        app, *_ = _create_app(drive_client_factory=factory)
        client = TestClient(app)

        client.post(
            "/v1beta1/graphSessions/new",
            json={"graphId": "file-id", "accessToken": "my-oauth-token"},
        )

        assert captured_tokens == ["my-oauth-token"]
