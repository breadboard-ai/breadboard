# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Backend client protocol for One Platform operations.

Separates "One Platform backend calls" (executeStep, uploadGeminiFile,
uploadBlobFile) from "Gemini HTTP calls" (streaming content generation).
This allows google3 to inject a direct backend client that bypasses HTTP.

This module has NO external dependencies — it uses only Python stdlib +
typing. The protocol defines the contract; implementations live elsewhere
(``local/backend_client_impl.py`` for HTTP, google3 for direct calls).
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

__all__ = ["BackendClient"]

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
    - ``HttpBackendClient`` (``local/backend_client_impl.py``) — POSTs
      to One Platform via HTTP.
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
