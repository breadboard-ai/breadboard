# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for DevAgentBackend access token extraction in dev/main.py.

Verifies the wire contract: accessToken in the request body takes
precedence over the Authorization header, and is stripped from the
body before envelope parsing.

These tests mock run_agent/resume_agent to avoid running the full
agent loop — we only care about how the token is extracted and
threaded into HttpBackendClient/HttpDriveOperationsClient.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from opal_backend.dev.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _empty_event_stream(*args, **kwargs):
    """Mock run/resume that yields a single finish event then stops."""
    from opal_backend.events import FinishEvent
    yield FinishEvent()


def _start_body(**extra):
    """Build a minimal start request body."""
    return {
        "start": {
            "segments": [{"textSegment": {"text": "hello"}}],
            "graph": {"url": "drive:/test", "title": "Test"},
        },
        **extra,
    }


class TestAccessTokenExtraction:
    """Test that DevAgentBackend.run() correctly extracts accessToken."""

    @pytest.mark.asyncio
    @patch("opal_backend.dev.main.run_agent", side_effect=_empty_event_stream)
    async def test_access_token_from_body(
        self, mock_run, client: AsyncClient
    ):
        """accessToken in body is used (no Authorization header)."""
        resp = await client.post(
            "/v1beta1/streamRunAgent",
            json=_start_body(accessToken="body-token-123"),
        )
        assert resp.status_code == 200

        # Verify the BackendClient was constructed with the body token.
        _, kwargs = mock_run.call_args
        assert kwargs["backend"]._access_token == "body-token-123"

    @pytest.mark.asyncio
    @patch("opal_backend.dev.main.run_agent", side_effect=_empty_event_stream)
    async def test_access_token_from_header_fallback(
        self, mock_run, client: AsyncClient
    ):
        """When no body accessToken, falls back to Authorization header."""
        resp = await client.post(
            "/v1beta1/streamRunAgent",
            json=_start_body(),
            headers={"Authorization": "Bearer header-token-456"},
        )
        assert resp.status_code == 200

        _, kwargs = mock_run.call_args
        assert kwargs["backend"]._access_token == "header-token-456"

    @pytest.mark.asyncio
    @patch("opal_backend.dev.main.run_agent", side_effect=_empty_event_stream)
    async def test_body_token_takes_precedence(
        self, mock_run, client: AsyncClient
    ):
        """Body accessToken takes precedence over Authorization header."""
        resp = await client.post(
            "/v1beta1/streamRunAgent",
            json=_start_body(accessToken="body-wins"),
            headers={"Authorization": "Bearer header-loses"},
        )
        assert resp.status_code == 200

        _, kwargs = mock_run.call_args
        assert kwargs["backend"]._access_token == "body-wins"

    @pytest.mark.asyncio
    @patch("opal_backend.dev.main.run_agent", side_effect=_empty_event_stream)
    async def test_drive_client_gets_same_token(
        self, mock_run, client: AsyncClient
    ):
        """DriveOperationsClient gets the same token as BackendClient."""
        resp = await client.post(
            "/v1beta1/streamRunAgent",
            json=_start_body(accessToken="shared-token"),
        )
        assert resp.status_code == 200

        _, kwargs = mock_run.call_args
        assert kwargs["backend"]._access_token == "shared-token"
        assert kwargs["drive"]._access_token == "shared-token"

    @pytest.mark.asyncio
    @patch("opal_backend.dev.main.run_agent", side_effect=_empty_event_stream)
    async def test_access_token_stripped_from_body(
        self, mock_run, client: AsyncClient
    ):
        """accessToken is stripped (popped) before envelope parsing.

        Verify that run_agent receives the parsed segments, not
        the raw body with accessToken still in it.
        """
        resp = await client.post(
            "/v1beta1/streamRunAgent",
            json=_start_body(accessToken="stripped-token"),
        )
        assert resp.status_code == 200

        _, kwargs = mock_run.call_args
        # The segments should be correctly parsed from the envelope.
        assert kwargs["segments"] is not None
        assert len(kwargs["segments"]) == 1
