# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for step_executor.py — the shared executeStep client.
"""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from opal_backend_shared.step_executor import (
    execute_step,
    parse_execution_output,
    resolve_part_to_chunk,
    encode_base64,
    _to_gcs_chunk,
    _is_blob_handle,
)


# ---------------------------------------------------------------------------
# parse_execution_output
# ---------------------------------------------------------------------------


class TestParseExecutionOutput:
    def test_inline_data_chunk(self):
        """Inline data chunk → inlineData part."""
        chunks = [{"mimetype": "image/png", "data": "base64data"}]
        result = parse_execution_output(chunks)
        assert len(result["chunks"]) == 1
        part = result["chunks"][0]["parts"][0]
        assert part["inlineData"]["mimeType"] == "image/png"
        assert part["inlineData"]["data"] == "base64data"

    def test_stored_data_chunk(self):
        """StoredData chunk → storedData part with /board/blobs/ handle."""
        chunks = [{"mimetype": "video/mp4/storedData", "data": "labs-bucket/abc-123"}]
        result = parse_execution_output(chunks)
        part = result["chunks"][0]["parts"][0]
        assert part["storedData"]["handle"] == "/board/blobs/abc-123"
        assert part["storedData"]["mimeType"] == "video/mp4"

    def test_gcs_path_chunk(self):
        """GCS path chunk → storedData part with /board/blobs/ handle."""
        # Full GCS path: bucket/uuid
        gcs_path = "labs-opal-dev-blobs/abc-123-def"
        encoded = base64.b64encode(gcs_path.encode()).decode()
        chunks = [{"mimetype": "text/gcs-path/image/png", "data": encoded}]
        result = parse_execution_output(chunks)
        part = result["chunks"][0]["parts"][0]
        assert part["storedData"]["handle"] == "/board/blobs/abc-123-def"
        assert part["storedData"]["mimeType"] == "image/png"

    def test_html_chunk(self):
        """HTML chunk → decoded text."""
        html = "<h1>Hello</h1>"
        encoded = base64.b64encode(html.encode()).decode()
        chunks = [{"mimetype": "text/html", "data": encoded}]
        result = parse_execution_output(chunks)
        part = result["chunks"][0]["parts"][0]
        assert part["inlineData"]["data"] == html

    def test_model_metadata_extracted(self):
        """Substream metadata chunks are extracted."""
        chunks = [
            {"mimetype": "image/png", "data": "data1", "substreamName": "requested-model"},
            {"mimetype": "image/png", "data": "data2", "substreamName": "executed-model"},
            {"mimetype": "image/png", "data": "actual"},
        ]
        # The first two are metadata, the third is data
        # Note: substreamName with "requested-model" extracts data as model name
        result = parse_execution_output(chunks)
        assert result["requestedModel"] == "data1"
        assert result["executedModel"] == "data2"
        assert len(result["chunks"]) == 1

    def test_empty_chunks_raises(self):
        """Empty or None chunks → ValueError."""
        with pytest.raises(ValueError, match="Unable to find data"):
            parse_execution_output(None)
        with pytest.raises(ValueError, match="Unable to find data"):
            parse_execution_output([])

    def test_only_metadata_raises(self):
        """Only metadata chunks (no data) → ValueError."""
        chunks = [
            {"mimetype": "x", "data": "m", "substreamName": "requested-model"},
        ]
        with pytest.raises(ValueError, match="Unable to find data"):
            parse_execution_output(chunks)

    def test_mixed_chunks(self):
        """Multiple data chunks."""
        chunks = [
            {"mimetype": "image/png", "data": "img1"},
            {"mimetype": "image/jpeg", "data": "img2"},
        ]
        result = parse_execution_output(chunks)
        assert len(result["chunks"]) == 2


# ---------------------------------------------------------------------------
# resolve_part_to_chunk
# ---------------------------------------------------------------------------


class TestResolvePartToChunk:
    @pytest.mark.asyncio
    async def test_inline_data_passthrough(self):
        """inlineData parts pass through directly."""
        part = {"inlineData": {"mimeType": "image/png", "data": "base64img"}}
        chunk = await resolve_part_to_chunk(
            part, access_token="tok", upstream_base="http://example.com"
        )
        assert chunk["mimetype"] == "image/png"
        assert chunk["data"] == "base64img"

    @pytest.mark.asyncio
    async def test_stored_data_blob_handle(self):
        """storedData with blob handle → GCS path chunk."""
        handle = "http://localhost:3000/board/blobs/12345678-1234-1234-1234-123456789012"
        part = {"storedData": {"handle": handle, "mimeType": "image/png"}}
        chunk = await resolve_part_to_chunk(
            part, access_token="tok", upstream_base="http://example.com"
        )
        assert chunk["mimetype"] == "text/gcs-path"
        decoded = base64.b64decode(chunk["data"]).decode()
        assert decoded == "12345678-1234-1234-1234-123456789012"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.step_executor._upload_blob_file")
    async def test_stored_data_drive_handle(self, mock_upload):
        """storedData with drive:/ handle → uploadBlobFile → GCS chunk."""
        mock_upload.return_value = "/board/blobs/aaaabbbb-1111-2222-3333-444455556666"
        part = {"storedData": {"handle": "drive://file123", "mimeType": "image/png"}}
        chunk = await resolve_part_to_chunk(
            part, access_token="tok", upstream_base="http://example.com"
        )
        assert chunk["mimetype"] == "text/gcs-path"
        mock_upload.assert_called_once()

    @pytest.mark.asyncio
    async def test_unknown_stored_data_raises(self):
        """storedData with unknown handle → ValueError."""
        part = {"storedData": {"handle": "ftp://weird", "mimeType": "image/png"}}
        with pytest.raises(ValueError, match="Unknown storedData"):
            await resolve_part_to_chunk(
                part, access_token="tok", upstream_base="http://example.com"
            )

    @pytest.mark.asyncio
    async def test_file_data_raises(self):
        """fileData parts are not supported in executeStep."""
        part = {"fileData": {"fileUri": "http://example.com/file", "mimeType": "image/png"}}
        with pytest.raises(ValueError, match="fileData parts are not supported"):
            await resolve_part_to_chunk(
                part, access_token="tok", upstream_base="http://example.com"
            )

    @pytest.mark.asyncio
    async def test_unknown_part_raises(self):
        """Unknown part types → ValueError."""
        with pytest.raises(ValueError, match="Unknown part type"):
            await resolve_part_to_chunk(
                {"weirdKey": "value"}, access_token="tok", upstream_base="http://x"
            )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


class TestHelpers:
    def test_encode_base64(self):
        result = encode_base64("hello world")
        assert base64.b64decode(result).decode() == "hello world"

    def test_is_blob_handle_valid(self):
        assert _is_blob_handle(
            "http://localhost:3000/board/blobs/12345678-1234-1234-1234-123456789012"
        )

    def test_is_blob_handle_invalid(self):
        assert not _is_blob_handle("http://example.com/not-a-blob")
        assert not _is_blob_handle("drive://file123")

    def test_to_gcs_chunk(self):
        handle = "http://localhost:3000/board/blobs/myblob-id"
        chunk = _to_gcs_chunk(handle)
        assert chunk["mimetype"] == "text/gcs-path"
        decoded = base64.b64decode(chunk["data"]).decode()
        assert decoded == "myblob-id"


# ---------------------------------------------------------------------------
# execute_step (mock HTTP)
# ---------------------------------------------------------------------------


class TestExecuteStep:
    @pytest.mark.asyncio
    async def test_success(self):
        """Successful executeStep call."""
        mock_response = httpx.Response(
            200,
            json={
                "executionOutputs": {
                    "output": {
                        "chunks": [
                            {"mimetype": "image/png", "data": "imgdata"}
                        ]
                    }
                }
            },
        )
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        body = {
            "planStep": {"output": "output", "stepName": "test"},
            "execution_inputs": {},
        }
        result = await execute_step(
            body,
            access_token="tok",
            upstream_base="http://example.com",
            client=mock_client,
        )
        assert len(result["chunks"]) == 1

    @pytest.mark.asyncio
    async def test_error_message_in_response(self):
        """Response with errorMessage → ValueError."""
        mock_response = httpx.Response(
            200,
            json={"errorMessage": "Model quota exceeded"},
        )
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        body = {"planStep": {"output": "out"}, "execution_inputs": {}}
        with pytest.raises(ValueError, match="Model quota exceeded"):
            await execute_step(
                body,
                access_token="tok",
                upstream_base="http://example.com",
                client=mock_client,
            )

    @pytest.mark.asyncio
    async def test_http_error(self):
        """HTTP 500 → ValueError."""
        mock_response = httpx.Response(
            500,
            json={"error": {"message": "Internal error"}},
        )
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        body = {"planStep": {"output": "out"}, "execution_inputs": {}}
        with pytest.raises(ValueError, match="Internal error"):
            await execute_step(
                body,
                access_token="tok",
                upstream_base="http://example.com",
                client=mock_client,
            )

    @pytest.mark.asyncio
    async def test_sends_auth_and_origin(self):
        """Access token and Origin header are sent."""
        mock_response = httpx.Response(
            200,
            json={
                "executionOutputs": {
                    "out": {"chunks": [{"mimetype": "text/plain", "data": "ok"}]}
                }
            },
        )
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        body = {"planStep": {"output": "out"}, "execution_inputs": {}}
        await execute_step(
            body,
            access_token="mytoken",
            upstream_base="http://example.com",
            origin="http://localhost:3000",
            client=mock_client,
        )

        call_kwargs = mock_client.post.call_args
        headers = call_kwargs.kwargs.get("headers", {})
        assert headers["Authorization"] == "Bearer mytoken"
        assert headers["Origin"] == "http://localhost:3000"


# ---------------------------------------------------------------------------
# Regression tests — real-world scenarios from end-to-end testing
# ---------------------------------------------------------------------------


class TestRealWorldRegressions:
    """Tests that reproduce exact scenarios observed in production.

    These guard against the specific bugs we fixed during the 4.7b
    end-to-end testing of image generation.
    """

    def test_gcs_path_extracts_uuid_from_full_bucket_path(self):
        """Regression: executeStep returns GCS paths like
        'labs-opal-dev-blobs/{uuid}' as base64. The handler must extract
        just the UUID and construct '/board/blobs/{uuid}'.

        Real observed data:
            mimetype='text/gcs-path/image/jpeg'
            data=base64('labs-opal-dev-blobs/f5cd36e3-f6a5-469a-b702-29886735379f')
        """
        gcs_path = "labs-opal-dev-blobs/f5cd36e3-f6a5-469a-b702-29886735379f"
        encoded = base64.b64encode(gcs_path.encode()).decode()
        chunks = [{"mimetype": "text/gcs-path/image/jpeg", "data": encoded}]

        result = parse_execution_output(chunks)

        part = result["chunks"][0]["parts"][0]
        assert "storedData" in part
        assert part["storedData"]["handle"] == "/board/blobs/f5cd36e3-f6a5-469a-b702-29886735379f"
        assert part["storedData"]["mimeType"] == "image/jpeg"

    def test_stored_data_extracts_uuid_from_bucket_path(self):
        """Regression: storedData handles also contain the bucket prefix.

        Real observed data:
            mimetype='image/jpeg/storedData'
            data='labs-opal-dev-blobs/0006aced-6d51-41e6-98c9-09cc4984f549'
        """
        chunks = [{
            "mimetype": "image/jpeg/storedData",
            "data": "labs-opal-dev-blobs/0006aced-6d51-41e6-98c9-09cc4984f549",
        }]
        result = parse_execution_output(chunks)

        part = result["chunks"][0]["parts"][0]
        assert part["storedData"]["handle"] == "/board/blobs/0006aced-6d51-41e6-98c9-09cc4984f549"
        assert part["storedData"]["mimeType"] == "image/jpeg"

    def test_stored_data_without_slash_passes_through(self):
        """storedData handle with no '/' is used as-is (just prefixed)."""
        chunks = [{
            "mimetype": "image/png/storedData",
            "data": "simple-blob-id",
        }]
        result = parse_execution_output(chunks)

        part = result["chunks"][0]["parts"][0]
        assert part["storedData"]["handle"] == "/board/blobs/simple-blob-id"

    @pytest.mark.asyncio
    async def test_e2e_execute_step_with_gcs_output(self):
        """End-to-end: executeStep returns GCS path chunks → correct handles.

        This simulates the full flow: API returns GCS path chunks,
        execute_step parses them, and the resulting LLMContent has
        properly formed /board/blobs/ handles.
        """
        gcs_path = "labs-opal-dev-blobs/ef5dfcdd-0cf6-4d23-9519-241a05e2de59"
        encoded = base64.b64encode(gcs_path.encode()).decode()

        mock_response = httpx.Response(
            200,
            json={
                "executionOutputs": {
                    "generated_image": {
                        "chunks": [
                            {
                                "mimetype": "text/gcs-path/image/jpeg",
                                "data": encoded,
                            }
                        ]
                    }
                }
            },
        )
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        body = {
            "planStep": {
                "stepName": "AI Image Tool",
                "modelApi": "ai_image_tool",
                "output": "generated_image",
            },
            "execution_inputs": {},
        }

        result = await execute_step(
            body,
            access_token="tok",
            upstream_base="http://example.com",
            client=mock_client,
        )

        assert len(result["chunks"]) == 1
        part = result["chunks"][0]["parts"][0]
        assert part["storedData"]["handle"] == "/board/blobs/ef5dfcdd-0cf6-4d23-9519-241a05e2de59"
        assert part["storedData"]["mimeType"] == "image/jpeg"

    @pytest.mark.asyncio
    async def test_upload_blob_file_sends_access_token_in_body(self):
        """Regression: OP requires accessToken in the JSON body, not just
        the Authorization header. Without it, the endpoint returns 500.

        This mirrors the same pattern used by _upload_gemini_file in
        conform_body.py (see shouldAddAccessTokenToJsonBody in
        fetch-allowlist.ts).
        """
        from opal_backend_shared.step_executor import _upload_blob_file

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "blobId": "new-blob-id-123",
            "mimeType": "image/jpeg",
        }

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.aclose = AsyncMock()

        result = await _upload_blob_file(
            "drive-file-id-abc",
            access_token="my-secret-token",
            upstream_base="https://staging-appcatalyst.sandbox.googleapis.com",
            origin="http://localhost:3000",
            client=mock_client,
        )

        assert result == "/board/blobs/new-blob-id-123"

        # Verify accessToken is in the body
        call_kwargs = mock_client.post.call_args
        body = call_kwargs.kwargs.get("json", {})
        assert body["driveFileId"] == "drive-file-id-abc"
        assert body["accessToken"] == "my-secret-token", (
            "OP requires accessToken in JSON body (not just header)"
        )

        # Verify upstream URL (not origin)
        url = call_kwargs.args[0]
        assert url.startswith("https://staging-appcatalyst"), (
            "uploadBlobFile should call upstream, not unified server"
        )
