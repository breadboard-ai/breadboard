# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Client for the One Platform ``/v1beta1/executeStep`` endpoint.

This is the shared substrate for all media generators (image, video, audio,
music). Each generator builds an ``ExecuteStepRequest`` and calls
``execute_step`` to dispatch it.

Port of ``step-executor.ts``.

The API contract:
    POST /v1beta1/executeStep
    Body:    {planStep: {...}, execution_inputs: {...}}
    Response: {executionOutputs: {...}, errorMessage?: string}
"""

from __future__ import annotations

import base64
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Type aliases
Chunk = dict[str, Any]  # {mimetype, data, substreamName?}
ContentMap = dict[str, Any]  # {content_name: {chunks: [...]}}
LLMContentPart = dict[str, Any]

EXECUTE_STEP_ENDPOINT = "/v1beta1/executeStep"
UPLOAD_BLOB_FILE_ENDPOINT = "/v1beta1/uploadBlobFile"

GCS_PATH_PREFIX = "text/gcs-path/"

# Blob handle: <origin>/board/blobs/<uuid>
_BLOB_UUID_RE = re.compile(
    r"^https?://.+/board/blobs/"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


# ---------------------------------------------------------------------------
# executeStep client
# ---------------------------------------------------------------------------


async def execute_step(
    body: dict[str, Any],
    *,
    access_token: str,
    upstream_base: str,
    origin: str = "",
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """POST to /v1beta1/executeStep and return parsed output.

    Args:
        body: The full ExecuteStepRequest (planStep + execution_inputs).
        access_token: OAuth2 access token.
        upstream_base: Base URL for One Platform.
        origin: Origin header value.
        client: Optional httpx client to reuse.

    Returns:
        Parsed ExecutionOutput: ``{chunks: [...], requestedModel?, executedModel?}``

    Raises:
        ValueError: On API error or missing output.
    """
    url = f"{upstream_base.rstrip('/')}{EXECUTE_STEP_ENDPOINT}"

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=120.0)

    try:
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }
        if origin:
            headers["Origin"] = origin

        response = await client.post(url, json=body, headers=headers)

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

        output_key = body.get("planStep", {}).get("output", "")
        outputs = data.get("executionOutputs", {})
        chunks = outputs.get(output_key, {}).get("chunks")

        return parse_execution_output(chunks)

    finally:
        if own_client:
            await client.aclose()


# ---------------------------------------------------------------------------
# Output parsing
# ---------------------------------------------------------------------------


def parse_execution_output(
    chunks: list[Chunk] | None,
    origin: str = "",
) -> dict[str, Any]:
    """Parse executeStep output chunks into LLMContent parts.

    Handles three chunk encodings:
    - Inline data: ``{mimetype: "image/png", data: "<base64>"}``
    - StoredData: ``{mimetype: "image/png/storedData", data: "<handle>"}``
    - GCS path: ``{mimetype: "text/gcs-path/image/png", data: "<base64-path>"}``
      → converted to storedData via ``{origin}/board/blobs/{blobId}``

    Args:
        chunks: Output chunks from executeStep.
        origin: Base URL for constructing blob handles (e.g. "http://localhost:3000").

    Returns:
        ``{chunks: [LLMContent, ...], requestedModel?, executedModel?}``

    Raises:
        ValueError: If no data chunks found.
    """
    if not chunks:
        raise ValueError("Unable to find data in the output")

    requested_model: str | None = None
    executed_model: str | None = None
    result_chunks: list[dict[str, Any]] = []

    for chunk in chunks:
        substream = chunk.get("substreamName")
        if substream == "requested-model":
            requested_model = chunk.get("data")
            continue
        elif substream == "executed-model":
            executed_model = chunk.get("data")
            continue

        result_chunks.append(_chunk_to_llm_content(chunk, origin))

    if not result_chunks:
        raise ValueError("Unable to find data in the output")

    result: dict[str, Any] = {"chunks": result_chunks}
    if requested_model:
        result["requestedModel"] = requested_model
    if executed_model:
        result["executedModel"] = executed_model
    return result


def _chunk_to_llm_content(chunk: Chunk, origin: str = "") -> dict[str, Any]:
    """Convert a single output chunk to LLMContent."""
    mimetype = chunk.get("mimetype", "")
    data = chunk.get("data", "")

    # StoredData: mimetype ends with /storedData
    if mimetype.endswith("/storedData"):
        actual_mime = mimetype.replace("/storedData", "")
        # The data is a raw GCS path like "labs-opal-dev-blobs/{uuid}".
        # Extract the blob UUID and construct a /board/blobs/{uuid} handle
        # that the frontend can resolve. This mirrors the TS code which uses
        # window.location.href to build the full URL.
        blob_id = data.rsplit("/", 1)[-1] if "/" in data else data
        handle = f"/board/blobs/{blob_id}"
        return {
            "parts": [
                {"storedData": {"handle": handle, "mimeType": actual_mime}}
            ],
            "role": "user",
        }

    # GCS path: mimetype starts with text/gcs-path/
    if mimetype.startswith(GCS_PATH_PREFIX):
        gcs_path = base64.b64decode(data).decode("utf-8")
        actual_mime = mimetype[len(GCS_PATH_PREFIX):]
        # Extract the blob UUID from the full GCS path
        # e.g. "labs-opal-dev-blobs/f5cd36e3-..." → "f5cd36e3-..."
        # Mirrors TS: gcsPath.split("/").at(-1)
        blob_id = gcs_path.rsplit("/", 1)[-1]
        handle = f"/board/blobs/{blob_id}"
        return {
            "parts": [
                {"storedData": {"handle": handle, "mimeType": actual_mime}}
            ],
            "role": "user",
        }

    # HTML text
    if mimetype == "text/html":
        decoded = base64.b64decode(data).decode("utf-8")
        return {
            "parts": [{"inlineData": {"mimeType": mimetype, "data": decoded}}],
            "role": "user",
        }

    # Default: inline data (images, etc.)
    return {
        "parts": [{"inlineData": {"mimeType": mimetype, "data": data}}],
        "role": "user",
    }


# ---------------------------------------------------------------------------
# Input data resolution — convert FS parts to executeStep chunks
# ---------------------------------------------------------------------------


async def resolve_part_to_chunk(
    part: LLMContentPart,
    *,
    access_token: str,
    upstream_base: str,
    origin: str = "",
    client: httpx.AsyncClient | None = None,
) -> Chunk:
    """Resolve an agent FS part to an executeStep-compatible chunk.

    Port of the TS ``isStoredData`` → ``driveFileToBlob`` → ``toGcsAwareChunk``
    and ``toInlineData`` pattern from ``data-transforms.ts`` and
    ``image-utils.ts``.

    Handles:
    - ``inlineData`` → direct chunk ``{mimetype, data}``
    - ``storedData`` with blob handle → GCS path chunk
    - ``storedData`` with drive:/ handle → uploadBlobFile → GCS path chunk
    - ``fileData`` → not yet supported (raise)

    Args:
        part: A single LLMContent part from the agent file system.

    Returns:
        An executeStep-compatible chunk ``{mimetype, data}``.
    """
    # inlineData → direct chunk
    if "inlineData" in part:
        inline = part["inlineData"]
        return {
            "mimetype": inline.get("mimeType", ""),
            "data": inline.get("data", ""),
        }

    # storedData → resolve to GCS path chunk
    if "storedData" in part:
        stored = part["storedData"]
        handle = stored.get("handle", "")

        # Already a blob handle → extract blobId → GCS path chunk
        if _is_blob_handle(handle):
            return _to_gcs_chunk(handle)

        # Drive handle → uploadBlobFile → GCS path chunk
        if handle.startswith("drive:"):
            drive_file_id = re.sub(r"^drive:/+", "", handle)
            blob_handle = await _upload_blob_file(
                drive_file_id,
                access_token=access_token,
                upstream_base=upstream_base,
                origin=origin,
                client=client,
            )
            return _to_gcs_chunk(blob_handle)

        raise ValueError(f'Unknown storedData handle for executeStep: "{handle}"')

    # fileData → not expected in this path
    if "fileData" in part:
        raise ValueError(
            "fileData parts are not supported in executeStep inputs"
        )

    raise ValueError(f"Unknown part type: {list(part.keys())}")


def _is_blob_handle(handle: str) -> bool:
    """Check if a handle is a blob store URL."""
    return bool(_BLOB_UUID_RE.match(handle))


def _to_gcs_chunk(blob_handle: str) -> Chunk:
    """Convert a blob handle to a GCS path chunk.

    Port of ``toGcsAwareChunk`` from data-transforms.ts.
    """
    blob_id = blob_handle.rsplit("/", 1)[-1]
    encoded = base64.b64encode(blob_id.encode("utf-8")).decode("ascii")
    return {"data": encoded, "mimetype": "text/gcs-path"}


async def _upload_blob_file(
    drive_file_id: str,
    *,
    access_token: str,
    upstream_base: str,
    origin: str = "",
    client: httpx.AsyncClient | None = None,
) -> str:
    """Upload a Drive file to blob store via /v1beta1/uploadBlobFile.

    Port of ``driveFileToBlob`` from data-transforms.ts (D2B transform).

    Note: ``uploadBlobFile`` is a **unified server** endpoint, not an
    upstream One Platform API. The TS frontend calls it via ``callBackend``
    which routes through the local server. We must use ``origin`` (the
    unified server URL) as the base, not ``upstream_base``.

    Returns:
        The blob handle path (``/board/blobs/{blobId}``).
    """
    url = f"{upstream_base.rstrip('/')}{UPLOAD_BLOB_FILE_ENDPOINT}"

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=120.0)

    try:
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }
        if origin:
            headers["Origin"] = origin

        # OP requires the access token in the JSON body (in addition to the
        # Authorization header).  Same pattern as _upload_gemini_file —
        # see shouldAddAccessTokenToJsonBody in fetch-allowlist.ts.
        response = await client.post(
            url,
            json={"driveFileId": drive_file_id, "accessToken": access_token},
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()

        blob_id = data.get("blobId", "")
        return f"/board/blobs/{blob_id}"

    finally:
        if own_client:
            await client.aclose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def encode_base64(text: str) -> str:
    """Base64-encode a UTF-8 string (for executeStep text inputs)."""
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _decode_error(text: str) -> str:
    """Try to extract error message from JSON error response."""
    try:
        import json
        data = json.loads(text)
        return data.get("error", {}).get("message", "Unknown error")
    except Exception:
        return "Unknown error"
