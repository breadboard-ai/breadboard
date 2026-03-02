# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
HTTP-based implementation of ``BackendClient``.

POSTs to One Platform and Gemini endpoints via ``httpx``. Used by the dev
backend and local testing. This module is NOT synced to google3 —
it lives in ``local/``.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from ..backend_client import (
    BackendClient,
    EXECUTE_STEP_ENDPOINT,
    UPLOAD_GEMINI_FILE_ENDPOINT,
    UPLOAD_BLOB_FILE_ENDPOINT,
)
from ..gemini_client import GeminiAPIError

__all__ = ["HttpBackendClient"]

logger = logging.getLogger(__name__)

GENAI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class HttpBackendClient:
    """Default HTTP-based backend client.

    POSTs to One Platform and Gemini endpoints via ``httpx``. Used by
    the dev backend and local testing.
    """

    def __init__(
        self,
        *,
        upstream_base: str,
        httpx_client: httpx.AsyncClient,
        access_token: str,
        origin: str = "",
    ) -> None:
        self._upstream_base = upstream_base
        self._httpx = httpx_client
        self._access_token = access_token
        self._origin = origin

    def _headers(self) -> dict[str, str]:
        """Build standard request headers."""
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._access_token}",
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

        response = await self._httpx.post(url, json=body, headers=headers)

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
            **request, "accessToken": self._access_token
        }

        response = await self._httpx.post(
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
        response = await self._httpx.post(
            url,
            json={
                "driveFileId": drive_file_id,
                "accessToken": self._access_token,
            },
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()

        blob_id = data.get("blobId", "")
        return f"/board/blobs/{blob_id}"

    async def stream_generate_content(
        self,
        model: str,
        body: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream from Gemini via httpx and parse SSE chunks.

        Builds the ``streamGenerateContent`` URL, sends an authenticated
        POST, and yields parsed JSON chunks from the SSE stream.
        """
        url = f"{GENAI_API_BASE}/{model}:streamGenerateContent?alt=sse"
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._access_token}",
        }

        async with self._httpx.stream(
            "POST", url, json=body, headers=headers
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise GeminiAPIError(
                    f"Gemini API error {response.status_code}: "
                    f"{error_text.decode()}"
                )

            async for line in response.aiter_lines():
                line = line.strip()
                if line.startswith("data: "):
                    json_str = line[len("data: "):]
                    try:
                        yield json.loads(json_str)
                    except json.JSONDecodeError:
                        logger.warning(
                            "Failed to parse SSE chunk: %s", json_str[:100]
                        )


def _decode_error(text: str) -> str:
    """Try to extract error message from JSON error response."""
    try:
        data = json.loads(text)
        return data.get("error", {}).get("message", "Unknown error")
    except Exception:
        return "Unknown error"
