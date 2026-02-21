# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the opal-backend-dev reverse proxy."""

from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from opal_backend_dev.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_root_endpoint(client):
    """Root returns server info."""
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Opal Dev Backend"
    assert "upstream" in data


class TestProxyEndpoints:
    """Tests for the v1beta1/* proxy pass-through."""

    def test_forwards_get_request(self, client, monkeypatch):
        """GET requests are forwarded to the upstream."""
        captured = {}

        async def mock_request(self, *, method, url, headers, content):
            captured["method"] = method
            captured["url"] = str(url)
            captured["headers"] = dict(headers)
            return httpx.Response(
                200,
                json={"countryCode": "US"},
                headers={"content-type": "application/json"},
            )

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        resp = client.get("/v1beta1/getLocation")

        assert resp.status_code == 200
        assert resp.json() == {"countryCode": "US"}
        assert captured["method"] == "GET"
        assert captured["url"].endswith("/v1beta1/getLocation")

    def test_forwards_post_request(self, client, monkeypatch):
        """POST requests with JSON body are forwarded."""
        captured = {}

        async def mock_request(self, *, method, url, headers, content):
            captured["method"] = method
            captured["body"] = content
            return httpx.Response(200, json={"ok": True})

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        body = {"prompt": "hello"}
        resp = client.post(
            "/v1beta1/executeStep",
            json=body,
        )

        assert resp.status_code == 200
        assert captured["method"] == "POST"
        assert json.loads(captured["body"]) == body

    def test_forwards_auth_header(self, client, monkeypatch):
        """Authorization header is passed through to upstream."""
        captured = {}

        async def mock_request(self, *, method, url, headers, content):
            captured["headers"] = dict(headers)
            return httpx.Response(200, json={})

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        client.get(
            "/v1beta1/getLocation",
            headers={"Authorization": "Bearer test-token-123"},
        )

        assert captured["headers"].get("authorization") == "Bearer test-token-123"

    def test_strips_hop_by_hop_headers(self, client, monkeypatch):
        """Host and transfer-encoding headers are stripped."""
        captured = {}

        async def mock_request(self, *, method, url, headers, content):
            captured["headers"] = dict(headers)
            return httpx.Response(200, json={})

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        client.get("/v1beta1/getLocation")

        assert "host" not in captured["headers"]
        assert "transfer-encoding" not in captured["headers"]

    def test_preserves_query_string(self, client, monkeypatch):
        """Query parameters are forwarded to the upstream URL."""
        captured = {}

        async def mock_request(self, *, method, url, headers, content):
            captured["url"] = str(url)
            return httpx.Response(200, json={})

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        client.get("/v1beta1/getLocation?alt=json&key=abc")

        assert "alt=json" in captured["url"]
        assert "key=abc" in captured["url"]

    def test_forwards_upstream_error_status(self, client, monkeypatch):
        """Upstream error responses are passed through as-is."""
        async def mock_request(self, *, method, url, headers, content):
            return httpx.Response(
                403,
                json={"error": {"code": 403, "message": "Forbidden"}},
            )

        monkeypatch.setattr(httpx.AsyncClient, "request", mock_request)
        resp = client.get("/v1beta1/checkAppAccess")

        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == 403
