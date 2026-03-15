# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Backend client protocol for One Platform operations.

No direct TypeScript counterpart — this protocol was created for the Python
backend's sync boundary. The TypeScript implementation calls One Platform inline.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path.

Consolidates all backend API calls — both One Platform operations
(executeStep, uploadGeminiFile, uploadBlobFile) and Gemini streaming
(streamGenerateContent). This allows google3 to inject a direct backend
client that uses RPC bindings instead of HTTP.

This module has NO external dependencies — it uses only Python stdlib +
typing. The protocol defines the contract; implementations live elsewhere
(``local/backend_client_impl.py`` for HTTP, google3 for direct calls).
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Protocol, runtime_checkable

__all__ = ["BackendClient"]

# Endpoint paths (matching the TS fetch-allowlist).
EXECUTE_STEP_ENDPOINT = "/v1beta1/executeStep"
UPLOAD_GEMINI_FILE_ENDPOINT = "/v1beta1/uploadGeminiFile"
UPLOAD_BLOB_FILE_ENDPOINT = "/v1beta1/uploadBlobFile"


@runtime_checkable
class BackendClient(Protocol):
    """Protocol for backend operations (One Platform + Gemini).

    Implementations:
    - ``HttpBackendClient`` (``local/backend_client_impl.py``) — POSTs
      to One Platform and Gemini via HTTP.
    - google3 ``DirectBackendClient`` — calls backend handlers directly
      using RPC bindings.

    Credentials are a transport concern: each implementation carries its
    own auth mechanism (``HttpBackendClient`` uses an access token;
    google3 uses service accounts).
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

    def stream_generate_content(
        self,
        model: str,
        body: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream content generation from Gemini.

        Yields parsed JSON chunks from the Gemini ``streamGenerateContent``
        API. Transport details (URL construction, auth headers, SSE parsing)
        are handled by the implementation.

        Args:
            model: Gemini model name (e.g. ``"gemini-3-flash-preview"``).
            body: The full Gemini request body (contents, tools, etc.).

        Yields:
            Parsed JSON response chunks.

        Raises:
            GeminiAPIError: If the API returns a non-200 status.
        """
        ...

    async def create_cached_content(
        self,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a Gemini cached content resource.

        Sends the payload to the ``cachedContents`` API and returns the
        raw response. Transport details (URL construction, auth headers)
        are handled by the implementation.

        Args:
            body: The full ``cachedContents`` request body (model,
                systemInstruction, tools, contents, ttl, etc.).

        Returns:
            The raw Gemini API response dict (containing ``name``, etc.).

        Raises:
            GeminiAPIError: If the API returns a non-200 status.
        """
        ...

    async def update_cached_content(
        self,
        name: str,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        """Update a Gemini cached content resource (e.g. extend TTL).

        Sends a PATCH to the ``cachedContents/{name}`` API.

        Args:
            name: The cached content resource name
                (e.g. ``"cachedContents/abc123"``).
            body: The update body (e.g. ``{"ttl": "1800s"}``).

        Returns:
            The raw Gemini API response dict.

        Raises:
            GeminiAPIError: If the API returns a non-200 status.
        """
        ...
