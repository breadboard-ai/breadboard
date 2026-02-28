# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Backend client protocol for One Platform operations.

Separates "One Platform backend calls" (executeStep, uploadGeminiFile,
uploadBlobFile) from "Gemini HTTP calls" (streaming content generation).
This allows google3 to inject a direct backend client that bypasses HTTP.

This module has NO external dependencies — it uses only Python stdlib +
typing. Both the protocol and the default HTTP implementation are synced.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol, runtime_checkable

from .http_client import HttpClient

export = ["BackendClient", "HttpBackendClient"]

logger = logging.getLogger(__name__)

# Endpoint paths (matching the TS fetch-allowlist).
EXECUTE_STEP_ENDPOINT = "/v1beta1/executeStep"
UPLOAD_GEMINI_FILE_ENDPOINT = "/v1beta1/uploadGeminiFile"
UPLOAD_BLOB_FILE_ENDPOINT = "/v1beta1/uploadBlobFile"


@runtime_checkable
class BackendClient(Protocol):
    """Protocol for One Platform backend operations.

    Three methods cover all the backend-specific HTTP calls that the
    agent loop makes to One Platform. Everything else (Gemini streaming)
    goes through ``HttpClient`` directly.

    Implementations:
    - ``HttpBackendClient`` (this file) — POSTs to One Platform via HTTP.
    - google3 ``DirectBackendClient`` — calls backend handlers directly.

    Credentials are a transport concern: each implementation carries its
    own auth mechanism (``HttpBackendClient`` reads from its
    ``HttpClient.access_token``; google3 uses service accounts).
    """

    async def execute_step(
        self, body: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute a plan step via the backend.

        Args:
            body: The full ExecuteStepRequest (planStep + execution_inputs).

        Returns:
            The raw API response dict (callers parse with
            ``parse_execution_output``).

        Raises:
            ValueError: On API error or missing output.
        """
        ...

    async def upload_gemini_file(
        self, request: dict[str, str]
    ) -> dict[str, Any]:
        """Upload a file to Gemini File API via the backend.

        Args:
            request: Upload request (e.g. ``{driveFileId: "..."}`` or
                ``{blobId: "..."}``).

        Returns:
            The raw API response dict with ``fileUrl`` and ``mimeType``.

        Raises:
            ValueError: If the upload fails.
        """
        ...

    async def upload_blob_file(
        self, drive_file_id: str
    ) -> str:
        """Upload a Drive file to blob store via the backend.

        Args:
            drive_file_id: The Google Drive file ID.

        Returns:
            The blob handle path (``/board/blobs/{blobId}``).

        Raises:
            ValueError: If the upload fails.
        """
        ...


class HttpBackendClient:
    """Default HTTP-based backend client.

    POSTs to One Platform endpoints via ``HttpClient``. Used by the dev
    backend and local testing. Credentials and origin are carried by the
    ``HttpClient`` (google3's ``DirectBackendClient`` won't need them).
    """

    def __init__(
        self,
        *,
        upstream_base: str,
        client: HttpClient,
        origin: str = "",
    ) -> None:
        self._upstream_base = upstream_base
        self._client = client
        self._origin = origin

    def _headers(self) -> dict[str, str]:
        """Build standard request headers."""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._client.access_token}",
        }
        if self._origin:
            headers["Origin"] = self._origin
        return headers

    async def execute_step(
        self, body: dict[str, Any]
    ) -> dict[str, Any]:
        """POST to /v1beta1/executeStep and return the raw response."""
        url = f"{self._upstream_base.rstrip('/')}{EXECUTE_STEP_ENDPOINT}"
        headers = self._headers()

        response = await self._client.post(url, json=body, headers=headers)

        if response.status_code >= 400:
            error_text = response.text[:500]
            logger.error(
                "executeStep failed: %d %s — %s",
                response.status_code,
                response.reason_phrase,
                error_text,
            )
            raise ValueError(
                f"executeStep request failed: {_decode_error(error_text)}"
            )

        data = response.json()

        if data.get("errorMessage"):
            raise ValueError(data["errorMessage"])

        return data

    async def upload_gemini_file(
        self, request: dict[str, str]
    ) -> dict[str, Any]:
        """POST to /v1beta1/uploadGeminiFile and return the raw response."""
        url = (
            f"{self._upstream_base.rstrip('/')}{UPLOAD_GEMINI_FILE_ENDPOINT}"
        )
        headers = self._headers()

        # OP requires the access token in the JSON body (in addition to the
        # Authorization header).  The TS client does this via
        # shouldAddAccessTokenToJsonBody in fetch-allowlist.ts.
        augmented_request = {
            **request, "accessToken": self._client.access_token
        }

        response = await self._client.post(
            url, json=augmented_request, headers=headers
        )
        if response.status_code >= 400:
            logger.error(
                "uploadGeminiFile failed: %d %s — request=%s response=%s",
                response.status_code,
                response.reason_phrase,
                augmented_request,
                response.text[:500],
            )
        response.raise_for_status()
        return response.json()

    async def upload_blob_file(
        self, drive_file_id: str
    ) -> str:
        """POST to /v1beta1/uploadBlobFile and return the blob handle."""
        url = (
            f"{self._upstream_base.rstrip('/')}{UPLOAD_BLOB_FILE_ENDPOINT}"
        )
        headers = self._headers()

        # OP requires the access token in the JSON body (same pattern as
        # upload_gemini_file — see shouldAddAccessTokenToJsonBody in
        # fetch-allowlist.ts).
        response = await self._client.post(
            url,
            json={
                "driveFileId": drive_file_id,
                "accessToken": self._client.access_token,
            },
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()

        blob_id = data.get("blobId", "")
        return f"/board/blobs/{blob_id}"


def _decode_error(text: str) -> str:
    """Try to extract error message from JSON error response."""
    try:
        import json

        data = json.loads(text)
        return data.get("error", {}).get("message", "Unknown error")
    except Exception:
        return "Unknown error"
