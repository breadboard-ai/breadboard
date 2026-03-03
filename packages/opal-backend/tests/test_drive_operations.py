# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for HttpDriveOperationsClient.

Verifies URL construction, headers, body serialization, and error
handling — all against mock httpx responses.
"""

from __future__ import annotations

import json

import httpx
import pytest

from opal_backend.local.drive_operations_client_impl import (
    HttpDriveOperationsClient,
    GOOGLE_DRIVE_FILES_API,
    GOOGLE_SHEETS_API,
)


# =============================================================================
# Helpers
# =============================================================================

ACCESS_TOKEN = "test-token-123"


def make_client(handler) -> HttpDriveOperationsClient:
    """Build a client backed by a mock httpx transport."""
    transport = httpx.MockTransport(handler)
    httpx_client = httpx.AsyncClient(transport=transport)
    return HttpDriveOperationsClient(
        httpx_client=httpx_client,
        access_token=ACCESS_TOKEN,
    )


def json_response(data: dict, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=data,
    )


def assert_bearer_token(request: httpx.Request):
    """Assert the request has the correct Bearer token."""
    assert request.headers["authorization"] == f"Bearer {ACCESS_TOKEN}"


# =============================================================================
# Drive file operations
# =============================================================================


class TestCreateFile:
    @pytest.mark.asyncio
    async def test_posts_to_drive_files_api(self):
        """create_file sends POST to /drive/v3/files with metadata body."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({"id": "file-123"})

        client = make_client(handler)
        result = await client.create_file({"name": "My File", "mimeType": "text/plain"})

        assert result == {"id": "file-123"}
        assert len(captured) == 1
        assert captured[0].method == "POST"
        assert str(captured[0].url) == GOOGLE_DRIVE_FILES_API
        assert_bearer_token(captured[0])
        body = json.loads(captured[0].content)
        assert body["name"] == "My File"


class TestGetFile:
    @pytest.mark.asyncio
    async def test_gets_file_metadata(self):
        """get_file sends GET to /drive/v3/files/{id}."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({"id": "abc", "name": "test.txt"})

        client = make_client(handler)
        result = await client.get_file("abc")

        assert result["id"] == "abc"
        assert captured[0].method == "GET"
        assert str(captured[0].url) == f"{GOOGLE_DRIVE_FILES_API}/abc"
        assert_bearer_token(captured[0])


class TestDeleteFile:
    @pytest.mark.asyncio
    async def test_deletes_file(self):
        """delete_file sends DELETE to /drive/v3/files/{id}."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(status_code=204)

        client = make_client(handler)
        await client.delete_file("del-id")

        assert captured[0].method == "DELETE"
        assert str(captured[0].url) == f"{GOOGLE_DRIVE_FILES_API}/del-id"


class TestQueryFiles:
    @pytest.mark.asyncio
    async def test_queries_with_url_encoded_query(self):
        """query_files sends GET with q= param and returns files list."""
        async def handler(request: httpx.Request) -> httpx.Response:
            return json_response({"files": [{"id": "f1"}, {"id": "f2"}]})

        client = make_client(handler)
        result = await client.query_files("name='test'")

        assert len(result) == 2
        assert result[0]["id"] == "f1"

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_files(self):
        """query_files returns [] when API returns no files key."""
        async def handler(request: httpx.Request) -> httpx.Response:
            return json_response({})

        client = make_client(handler)
        result = await client.query_files("mimeType='text/plain'")
        assert result == []


# =============================================================================
# Sheets operations
# =============================================================================


class TestGetSpreadsheetMetadata:
    @pytest.mark.asyncio
    async def test_gets_metadata_with_fields_param(self):
        """get_spreadsheet_metadata appends ?fields=sheets.properties."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({"sheets": [{"properties": {"title": "Sheet1"}}]})

        client = make_client(handler)
        result = await client.get_spreadsheet_metadata("ss-id")

        assert "sheets" in result
        url = str(captured[0].url)
        assert "fields=sheets.properties" in url
        assert f"{GOOGLE_SHEETS_API}/ss-id" in url


class TestGetSpreadsheetValues:
    @pytest.mark.asyncio
    async def test_gets_values_for_range(self):
        """get_spreadsheet_values returns the values array."""
        async def handler(request: httpx.Request) -> httpx.Response:
            return json_response({"values": [["A", "B"], ["1", "2"]]})

        client = make_client(handler)
        result = await client.get_spreadsheet_values("ss-id", "Sheet1!A1:B2")

        assert result == [["A", "B"], ["1", "2"]]

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_values(self):
        """get_spreadsheet_values returns [] when no values key."""
        async def handler(request: httpx.Request) -> httpx.Response:
            return json_response({})

        client = make_client(handler)
        result = await client.get_spreadsheet_values("ss-id", "Sheet1!A1")
        assert result == []


class TestSetSpreadsheetValues:
    @pytest.mark.asyncio
    async def test_puts_values_with_user_entered(self):
        """set_spreadsheet_values sends PUT with valueInputOption=USER_ENTERED."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({})

        client = make_client(handler)
        await client.set_spreadsheet_values("ss-id", "Sheet1!A1", [["x", "y"]])

        assert captured[0].method == "PUT"
        url = str(captured[0].url)
        assert "valueInputOption=USER_ENTERED" in url
        body = json.loads(captured[0].content)
        assert body["values"] == [["x", "y"]]


class TestAppendSpreadsheetValues:
    @pytest.mark.asyncio
    async def test_appends_with_post(self):
        """append_spreadsheet_values sends POST to :append endpoint."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({})

        client = make_client(handler)
        await client.append_spreadsheet_values("ss-id", "Sheet1!A1", [["new"]])

        assert captured[0].method == "POST"
        url = str(captured[0].url)
        assert ":append" in url
        assert "valueInputOption=USER_ENTERED" in url


class TestUpdateSpreadsheet:
    @pytest.mark.asyncio
    async def test_batch_update(self):
        """update_spreadsheet sends POST with {requests} to :batchUpdate."""
        captured: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return json_response({})

        client = make_client(handler)
        await client.update_spreadsheet(
            "ss-id", [{"addSheet": {"properties": {"title": "New"}}}]
        )

        assert captured[0].method == "POST"
        assert ":batchUpdate" in str(captured[0].url)
        body = json.loads(captured[0].content)
        assert "requests" in body


# =============================================================================
# Error handling
# =============================================================================


class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_raises_on_api_error_response(self):
        """_api raises ValueError when response contains {error: {message}}."""
        async def handler(request: httpx.Request) -> httpx.Response:
            return json_response(
                {"error": {"code": 404, "message": "File not found", "status": "NOT_FOUND"}},
                status=404,
            )

        client = make_client(handler)
        with pytest.raises(ValueError, match="File not found"):
            await client.get_file("nonexistent")
