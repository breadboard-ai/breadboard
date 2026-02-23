# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for conform_body.py.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from opal_backend_shared.conform_body import (
    conform_body,
    _maybe_blob,
)

UPSTREAM = "https://test.example.com"
TOKEN = "test-token"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def body_with_parts(parts: list[dict]) -> dict:
    """Build a minimal GeminiBody with a single content entry."""
    return {"contents": [{"parts": parts, "role": "user"}]}


def first_parts(result: dict) -> list[dict]:
    """Extract parts from the first content entry."""
    return result["contents"][0]["parts"]


def mock_upload_response(file_url: str = "files/abc", mime_type: str = "image/png"):
    """Create a mock httpx.Response for uploadGeminiFile."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = 200
    resp.raise_for_status = MagicMock()
    resp.json.return_value = {"fileUrl": file_url, "mimeType": mime_type}
    return resp


def mock_client(response=None):
    """Create a mock httpx.AsyncClient that returns the given response."""
    if response is None:
        response = mock_upload_response()
    client = AsyncMock(spec=httpx.AsyncClient)
    client.post = AsyncMock(return_value=response)
    return client


# ---------------------------------------------------------------------------
# _maybe_blob
# ---------------------------------------------------------------------------


class TestMaybeBlob:
    def test_valid_blob_url(self):
        url = "https://localhost:3000/board/blobs/12345678-1234-1234-1234-123456789abc"
        assert _maybe_blob(url) == "12345678-1234-1234-1234-123456789abc"

    def test_non_blob_url(self):
        assert _maybe_blob("https://example.com/foo") is None

    def test_drive_url(self):
        assert _maybe_blob("drive:/abc") is None


# ---------------------------------------------------------------------------
# Passthrough transforms (no HTTP)
# ---------------------------------------------------------------------------


class TestPassthroughTransforms:
    @pytest.mark.asyncio
    async def test_json_to_text(self):
        """json part → {text: json.dumps()}"""
        body = body_with_parts([{"json": {"key": "value", "n": 42}}])
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert len(parts) == 1
        assert parts[0] == {"text": json.dumps({"key": "value", "n": 42})}

    @pytest.mark.asyncio
    async def test_nlm_stored_data_passthrough(self):
        """NLM storedData → {text: url}"""
        nlm_url = "https://notebooklm.google.com/notebook/abc123"
        body = body_with_parts(
            [{"storedData": {"handle": nlm_url, "mimeType": "text/plain"}}]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert len(parts) == 1
        assert parts[0] == {"text": nlm_url}

    @pytest.mark.asyncio
    async def test_gemini_file_api_passthrough(self):
        """fileData already pointing to Gemini File API → passthrough"""
        part = {
            "fileData": {
                "fileUri": "https://generativelanguage.googleapis.com/v1beta//files/abc123",
                "mimeType": "image/png",
            }
        }
        body = body_with_parts([part])
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_youtube_video_passthrough(self):
        """fileData with video/mp4 → passthrough"""
        part = {
            "fileData": {
                "fileUri": "https://youtube.com/watch?v=xyz",
                "mimeType": "video/mp4",
            }
        }
        body = body_with_parts([part])
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_text_part_passthrough(self):
        """Plain text parts → passthrough"""
        part = {"text": "hello world"}
        body = body_with_parts([part])
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_inline_data_passthrough(self):
        """inlineData parts → passthrough"""
        part = {"inlineData": {"data": "base64==", "mimeType": "image/png"}}
        body = body_with_parts([part])
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_empty_contents(self):
        """Body with no contents → passthrough"""
        body: dict = {"contents": []}
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        assert result == body

    @pytest.mark.asyncio
    async def test_no_contents_key(self):
        """Body without contents key → passthrough"""
        body: dict = {"tools": []}
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        assert result == body


# ---------------------------------------------------------------------------
# Upload transforms (mocked httpx client)
# ---------------------------------------------------------------------------


class TestUploadTransforms:
    @pytest.mark.asyncio
    async def test_drive_stored_data_upload(self):
        """storedData with drive:/ handle → uploadGeminiFile → fileData"""
        client = mock_client(mock_upload_response("files/abc123", "image/jpeg"))

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/file-id-123", "mimeType": "image/jpeg"}}]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        parts = first_parts(result)
        assert len(parts) == 1
        assert "fileData" in parts[0]
        assert parts[0]["fileData"]["mimeType"] == "image/jpeg"
        assert "files/abc123" in parts[0]["fileData"]["fileUri"]

        # Verify upload was called with driveFileId
        client.post.assert_called_once()
        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["json"] == {
            "driveFileId": "file-id-123",
            "accessToken": TOKEN,
        }

    @pytest.mark.asyncio
    async def test_blob_stored_data_upload(self):
        """storedData with blob handle → uploadGeminiFile → fileData"""
        client = mock_client(mock_upload_response("files/blob-resolved", "audio/wav"))

        blob_url = "https://localhost:3000/board/blobs/12345678-1234-1234-1234-123456789abc"
        body = body_with_parts(
            [{"storedData": {"handle": blob_url, "mimeType": "audio/wav"}}]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        parts = first_parts(result)
        assert "fileData" in parts[0]
        assert parts[0]["fileData"]["mimeType"] == "audio/wav"

        # Verify the request sent the blobId
        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["json"] == {
            "blobId": "12345678-1234-1234-1234-123456789abc",
            "accessToken": TOKEN,
        }

    @pytest.mark.asyncio
    async def test_drive_file_data_upload(self):
        """fileData with drive:/ URI → uploadGeminiFile → fileData"""
        client = mock_client(mock_upload_response("files/drive-resolved", "image/png"))

        body = body_with_parts(
            [{"fileData": {"fileUri": "drive:/drive-file-id", "mimeType": "image/png"}}]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        parts = first_parts(result)
        assert "fileData" in parts[0]
        assert "drive-resolved" in parts[0]["fileData"]["fileUri"]

        # Verify the request sent driveFileId
        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["json"] == {
            "driveFileId": "drive-file-id",
            "accessToken": TOKEN,
        }

    @pytest.mark.asyncio
    async def test_drive_file_data_with_resource_key(self):
        """fileData with drive:/ URI + resourceKey → includes driveResourceKey"""
        client = mock_client(mock_upload_response("files/rk-resolved", "image/png"))

        body = body_with_parts(
            [
                {
                    "fileData": {
                        "fileUri": "drive:/rk-file",
                        "mimeType": "image/png",
                        "resourceKey": "rk-abc",
                    }
                }
            ]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )

        call_kwargs = client.post.call_args
        req_body = call_kwargs.kwargs["json"]
        assert req_body["driveFileId"] == "rk-file"
        assert req_body["driveResourceKey"] == "rk-abc"

    @pytest.mark.asyncio
    async def test_auth_header_and_body_token(self):
        """Upload requests include Authorization header and accessToken in body."""
        client = mock_client()

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/id", "mimeType": "image/png"}}]
        )
        await conform_body(
            body, access_token="my-secret-token", upstream_base=UPSTREAM, client=client
        )

        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer my-secret-token"
        assert call_kwargs.kwargs["json"]["accessToken"] == "my-secret-token"

    @pytest.mark.asyncio
    async def test_origin_header_sent(self):
        """Upload requests include Origin header when origin is provided."""
        client = mock_client()

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/id", "mimeType": "image/png"}}]
        )
        await conform_body(
            body,
            access_token=TOKEN,
            upstream_base=UPSTREAM,
            client=client,
            origin="http://localhost:3000",
        )

        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["headers"]["Origin"] == "http://localhost:3000"

    @pytest.mark.asyncio
    async def test_origin_header_omitted_when_empty(self):
        """Upload requests omit Origin header when origin is not provided."""
        client = mock_client()

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/id", "mimeType": "image/png"}}]
        )
        await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )

        call_kwargs = client.post.call_args
        assert "Origin" not in call_kwargs.kwargs["headers"]

    @pytest.mark.asyncio
    async def test_upload_error_raises(self):
        """Upload failure raises via raise_for_status."""
        resp = MagicMock(spec=httpx.Response)
        resp.status_code = 500
        resp.reason_phrase = "Internal Server Error"
        resp.text = "Something went wrong"
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=resp
        )
        client = mock_client(resp)

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/fail", "mimeType": "image/png"}}]
        )
        with pytest.raises(httpx.HTTPStatusError):
            await conform_body(
                body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
            )

    @pytest.mark.asyncio
    async def test_unknown_stored_data_raises(self):
        """Unknown storedData handle raises ValueError (matches TS err)."""
        body = body_with_parts(
            [{"storedData": {"handle": "ftp://weird", "mimeType": "image/png"}}]
        )
        with pytest.raises(ValueError, match="Unknown storedData handle"):
            await conform_body(
                body, access_token=TOKEN, upstream_base=UPSTREAM
            )

    @pytest.mark.asyncio
    async def test_unknown_file_data_raises(self):
        """Unknown fileData URI raises ValueError (matches TS err)."""
        body = body_with_parts(
            [{"fileData": {"fileUri": "ftp://weird", "mimeType": "image/png"}}]
        )
        with pytest.raises(ValueError, match="Unknown fileData URI"):
            await conform_body(
                body, access_token=TOKEN, upstream_base=UPSTREAM
            )

    @pytest.mark.asyncio
    async def test_drive_prefix_multi_slash(self):
        """drive:///file-id normalizes to file-id (matches TS regex)."""
        client = mock_client(mock_upload_response("files/multi", "image/png"))

        body = body_with_parts(
            [{"storedData": {"handle": "drive:///file-id-123", "mimeType": "image/png"}}]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        call_kwargs = client.post.call_args
        assert call_kwargs.kwargs["json"] == {
            "driveFileId": "file-id-123",
            "accessToken": TOKEN,
        }

    @pytest.mark.asyncio
    async def test_upload_url_constructed_correctly(self):
        """Upload POST goes to upstream_base + /v1beta1/uploadGeminiFile."""
        client = mock_client()

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/x", "mimeType": "image/png"}}]
        )
        await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )

        call_args = client.post.call_args
        url = call_args.args[0] if call_args.args else call_args.kwargs.get("url", "")
        assert url == f"{UPSTREAM}/v1beta1/uploadGeminiFile"


# ---------------------------------------------------------------------------
# Mixed content
# ---------------------------------------------------------------------------


class TestMixedContent:
    @pytest.mark.asyncio
    async def test_mixed_parts_in_one_content(self):
        """Multiple part types in a single content entry."""
        client = mock_client(mock_upload_response("files/resolved", "image/png"))

        body = body_with_parts(
            [
                {"text": "look at this"},
                {"json": {"key": "val"}},
                {"storedData": {"handle": "drive:/img", "mimeType": "image/png"}},
                {
                    "fileData": {
                        "fileUri": "https://generativelanguage.googleapis.com/v1beta//files/existing",
                        "mimeType": "audio/mp3",
                    }
                },
            ]
        )
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        parts = first_parts(result)
        assert len(parts) == 4
        # text passthrough
        assert parts[0] == {"text": "look at this"}
        # json → text
        assert parts[1] == {"text": json.dumps({"key": "val"})}
        # drive → fileData
        assert "fileData" in parts[2]
        # already resolved → passthrough
        assert parts[3]["fileData"]["fileUri"].endswith("/files/existing")

    @pytest.mark.asyncio
    async def test_multiple_contents(self):
        """Multiple content entries are all transformed."""
        client = mock_client(mock_upload_response("files/x", "image/png"))

        body = {
            "contents": [
                {"parts": [{"json": {"a": 1}}], "role": "user"},
                {
                    "parts": [
                        {"storedData": {"handle": "drive:/d", "mimeType": "image/png"}}
                    ],
                    "role": "model",
                },
            ]
        }
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM, client=client
        )
        assert len(result["contents"]) == 2
        # First: json → text
        assert result["contents"][0]["parts"][0]["text"] == json.dumps({"a": 1})
        # Second: drive → fileData
        assert "fileData" in result["contents"][1]["parts"][0]

    @pytest.mark.asyncio
    async def test_preserves_non_contents_keys(self):
        """Body keys other than contents are preserved."""
        body = {
            "contents": [{"parts": [{"text": "hi"}], "role": "user"}],
            "tools": [{"functionDeclarations": []}],
            "generationConfig": {"temperature": 0.5},
        }
        result = await conform_body(
            body, access_token=TOKEN, upstream_base=UPSTREAM
        )
        assert result["tools"] == body["tools"]
        assert result["generationConfig"] == body["generationConfig"]
