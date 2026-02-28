# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for conform_body.py.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from opal_backend.conform_body import (
    conform_body,
    _maybe_blob,
)

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


def mock_backend(
    file_url: str = "files/abc",
    mime_type: str = "image/png",
):
    """Create a mock BackendClient that returns upload responses."""
    backend = AsyncMock()
    backend.upload_gemini_file = AsyncMock(
        return_value={"fileUrl": file_url, "mimeType": mime_type}
    )
    backend.upload_blob_file = AsyncMock(return_value="/board/blobs/mock-blob")
    return backend


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
# Passthrough transforms (no backend calls)
# ---------------------------------------------------------------------------


class TestPassthroughTransforms:
    @pytest.mark.asyncio
    async def test_json_to_text(self):
        """json part → {text: json.dumps()}"""
        body = body_with_parts([{"json": {"key": "value", "n": 42}}])
        result = await conform_body(
            body, backend=mock_backend()
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
            body, backend=mock_backend()
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
            body, backend=mock_backend()
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
            body, backend=mock_backend()
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_text_part_passthrough(self):
        """Plain text parts → passthrough"""
        part = {"text": "hello world"}
        body = body_with_parts([part])
        result = await conform_body(
            body, backend=mock_backend()
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_inline_data_passthrough(self):
        """inlineData parts → passthrough"""
        part = {"inlineData": {"data": "base64==", "mimeType": "image/png"}}
        body = body_with_parts([part])
        result = await conform_body(
            body, backend=mock_backend()
        )
        parts = first_parts(result)
        assert parts[0] == part

    @pytest.mark.asyncio
    async def test_empty_contents(self):
        """Body with no contents → passthrough"""
        body: dict = {"contents": []}
        result = await conform_body(
            body, backend=mock_backend()
        )
        assert result == body

    @pytest.mark.asyncio
    async def test_no_contents_key(self):
        """Body without contents key → passthrough"""
        body: dict = {"tools": []}
        result = await conform_body(
            body, backend=mock_backend()
        )
        assert result == body


# ---------------------------------------------------------------------------
# Upload transforms (mocked backend)
# ---------------------------------------------------------------------------


class TestUploadTransforms:
    @pytest.mark.asyncio
    async def test_drive_stored_data_upload(self):
        """storedData with drive:/ handle → backend.upload_gemini_file → fileData"""
        backend = mock_backend("files/abc123", "image/jpeg")

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/file-id-123", "mimeType": "image/jpeg"}}]
        )
        result = await conform_body(
            body, backend=backend
        )
        parts = first_parts(result)
        assert len(parts) == 1
        assert "fileData" in parts[0]
        assert parts[0]["fileData"]["mimeType"] == "image/jpeg"
        assert "files/abc123" in parts[0]["fileData"]["fileUri"]

        # Verify upload was called with driveFileId
        backend.upload_gemini_file.assert_called_once_with(
            {"driveFileId": "file-id-123"}
        )

    @pytest.mark.asyncio
    async def test_blob_stored_data_upload(self):
        """storedData with blob handle → backend.upload_gemini_file → fileData"""
        backend = mock_backend("files/blob-resolved", "audio/wav")

        blob_url = "https://localhost:3000/board/blobs/12345678-1234-1234-1234-123456789abc"
        body = body_with_parts(
            [{"storedData": {"handle": blob_url, "mimeType": "audio/wav"}}]
        )
        result = await conform_body(
            body, backend=backend
        )
        parts = first_parts(result)
        assert "fileData" in parts[0]
        assert parts[0]["fileData"]["mimeType"] == "audio/wav"

        # Verify the request sent the blobId
        backend.upload_gemini_file.assert_called_once_with(
            {"blobId": "12345678-1234-1234-1234-123456789abc"}
        )

    @pytest.mark.asyncio
    async def test_drive_file_data_upload(self):
        """fileData with drive:/ URI → backend.upload_gemini_file → fileData"""
        backend = mock_backend("files/drive-resolved", "image/png")

        body = body_with_parts(
            [{"fileData": {"fileUri": "drive:/drive-file-id", "mimeType": "image/png"}}]
        )
        result = await conform_body(
            body, backend=backend
        )
        parts = first_parts(result)
        assert "fileData" in parts[0]
        assert "drive-resolved" in parts[0]["fileData"]["fileUri"]

        # Verify the request sent driveFileId
        backend.upload_gemini_file.assert_called_once_with(
            {"driveFileId": "drive-file-id"}
        )

    @pytest.mark.asyncio
    async def test_drive_file_data_with_resource_key(self):
        """fileData with drive:/ URI + resourceKey → includes driveResourceKey"""
        backend = mock_backend("files/rk-resolved", "image/png")

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
            body, backend=backend
        )

        backend.upload_gemini_file.assert_called_once_with(
            {"driveFileId": "rk-file", "driveResourceKey": "rk-abc"},
        )

    @pytest.mark.asyncio
    async def test_upload_error_raises(self):
        """Backend upload failure propagates."""
        backend = AsyncMock()
        backend.upload_gemini_file = AsyncMock(
            side_effect=ValueError("Upload failed")
        )

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/fail", "mimeType": "image/png"}}]
        )
        with pytest.raises(ValueError, match="Upload failed"):
            await conform_body(
                body, backend=backend
            )

    @pytest.mark.asyncio
    async def test_unknown_stored_data_raises(self):
        """Unknown storedData handle raises ValueError (matches TS err)."""
        body = body_with_parts(
            [{"storedData": {"handle": "ftp://weird", "mimeType": "image/png"}}]
        )
        with pytest.raises(ValueError, match="Unknown storedData handle"):
            await conform_body(
                body, backend=mock_backend()
            )

    @pytest.mark.asyncio
    async def test_unknown_file_data_raises(self):
        """Unknown fileData URI raises ValueError (matches TS err)."""
        body = body_with_parts(
            [{"fileData": {"fileUri": "ftp://weird", "mimeType": "image/png"}}]
        )
        with pytest.raises(ValueError, match="Unknown fileData URI"):
            await conform_body(
                body, backend=mock_backend()
            )

    @pytest.mark.asyncio
    async def test_drive_prefix_multi_slash(self):
        """drive:///file-id normalizes to file-id (matches TS regex)."""
        backend = mock_backend("files/multi", "image/png")

        body = body_with_parts(
            [{"storedData": {"handle": "drive:///file-id-123", "mimeType": "image/png"}}]
        )
        result = await conform_body(
            body, backend=backend
        )
        backend.upload_gemini_file.assert_called_once_with(
            {"driveFileId": "file-id-123"}
        )

    @pytest.mark.asyncio
    async def test_relative_file_url_resolved(self):
        """Backend returns relative fileUrl → resolved to absolute GENAI URL."""
        backend = mock_backend("files/relative-abc", "image/png")

        body = body_with_parts(
            [{"storedData": {"handle": "drive:/x", "mimeType": "image/png"}}]
        )
        result = await conform_body(
            body, backend=backend
        )
        parts = first_parts(result)
        file_uri = parts[0]["fileData"]["fileUri"]
        assert file_uri.startswith("https://generativelanguage.googleapis.com/v1beta/")
        assert "files/relative-abc" in file_uri


# ---------------------------------------------------------------------------
# Mixed content
# ---------------------------------------------------------------------------


class TestMixedContent:
    @pytest.mark.asyncio
    async def test_mixed_parts_in_one_content(self):
        """Multiple part types in a single content entry."""
        backend = mock_backend("files/resolved", "image/png")

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
            body, backend=backend
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
        backend = mock_backend("files/x", "image/png")

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
            body, backend=backend
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
            body, backend=mock_backend()
        )
        assert result["tools"] == body["tools"]
        assert result["generationConfig"] == body["generationConfig"]
