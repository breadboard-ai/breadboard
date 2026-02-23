# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Data part transforms for Gemini API compatibility.

Walks ``body["contents"]`` and resolves Breadboard-specific data parts
(``storedData``, ``fileData``, ``json``) into formats that Gemini can
consume. Port of the TypeScript ``conformBody`` function.

Transform table:
  json part            → {text: json.dumps()}
  storedData NLM URL   → {text: url}
  storedData drive:/*   → fileData via /v1beta1/uploadGeminiFile
  storedData blob UUID  → fileData via /v1beta1/uploadGeminiFile
  fileData drive:/*     → fileData via /v1beta1/uploadGeminiFile
  fileData already OK   → passthrough
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Type aliases (same as loop.py)
GeminiBody = dict[str, Any]
LLMContentPart = dict[str, Any]

GENAI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/"
GENAI_FILES_PREFIX = f"{GENAI_API_BASE}/files/"
DRIVE_URL_PREFIX = "drive:"
NOTEBOOKLM_URL_PREFIX = "https://notebooklm.google.com/notebook/"

# Matches the TS regex: /^drive:\/+/  (strip "drive:" + all leading slashes)
_DRIVE_PREFIX_RE = re.compile(r"^drive:/+")
UPLOAD_GEMINI_FILE_ENDPOINT = "/v1beta1/uploadGeminiFile"

# Blob handle: <origin>/board/blobs/<uuid>
_BLOB_UUID_RE = re.compile(
    r"^https?://.+/board/blobs/"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


async def conform_body(
    body: GeminiBody,
    *,
    access_token: str,
    upstream_base: str,
    client: httpx.AsyncClient | None = None,
    origin: str = "",
) -> GeminiBody:
    """Transform Breadboard-specific parts to Gemini-native formats.

    Args:
        body: The full Gemini request body (contents, tools, etc.).
        access_token: OAuth2 access token for upload endpoints.
        upstream_base: Base URL for One Platform (e.g.
            ``https://appcatalyst.pa.googleapis.com``).
        client: Optional httpx.AsyncClient to reuse.

    Returns:
        A new body dict with transformed contents.
    """
    contents = body.get("contents", [])
    if not contents:
        return body

    transformed_contents = []
    for content in contents:
        parts = content.get("parts")
        if not parts:
            transformed_contents.append(content)
            continue

        new_parts = []
        for part in parts:
            transformed = await _transform_part(
                part,
                access_token=access_token,
                upstream_base=upstream_base,
                client=client,
                origin=origin,
            )
            new_parts.append(transformed)

        transformed_contents.append({**content, "parts": new_parts})

    return {**body, "contents": transformed_contents}


async def _transform_part(
    part: LLMContentPart,
    *,
    access_token: str,
    upstream_base: str,
    client: httpx.AsyncClient | None = None,
    origin: str = "",
) -> LLMContentPart:
    """Transform a single content part."""

    # 1. json → text
    if "json" in part:
        return {"text": json.dumps(part["json"])}

    # 2. storedData
    if "storedData" in part:
        stored = part["storedData"]
        handle = stored.get("handle", "")
        mime_type = stored.get("mimeType", "")

        # NLM URLs → text passthrough
        if handle.startswith(NOTEBOOKLM_URL_PREFIX):
            return {"text": handle}

        # Drive handle → uploadGeminiFile
        if handle.startswith(DRIVE_URL_PREFIX):
            drive_file_id = _DRIVE_PREFIX_RE.sub("", handle)
            return await _upload_gemini_file(
                {"driveFileId": drive_file_id},
                access_token=access_token,
                upstream_base=upstream_base,
                client=client,
                origin=origin,
            )

        # Blob handle → uploadGeminiFile
        blob_id = _maybe_blob(handle)
        if blob_id:
            return await _upload_gemini_file(
                {"blobId": blob_id},
                access_token=access_token,
                upstream_base=upstream_base,
                client=client,
                origin=origin,
            )

        # Unknown storedData — error (matches TS err("Unknown part"))
        raise ValueError(f'Unknown storedData handle: "{handle}"')

    # 3. fileData
    if "fileData" in part:
        file_data = part["fileData"]
        file_uri = file_data.get("fileUri", "")
        mime_type = file_data.get("mimeType", "")

        # Already a Gemini File API URL → passthrough
        if file_uri.startswith(GENAI_FILES_PREFIX):
            return part

        # YouTube video → passthrough
        if mime_type == "video/mp4":
            return part

        # Drive URI → uploadGeminiFile
        if file_uri.startswith(DRIVE_URL_PREFIX):
            drive_file_id = _DRIVE_PREFIX_RE.sub("", file_uri)
            request: dict[str, str] = {"driveFileId": drive_file_id}
            resource_key = file_data.get("resourceKey")
            if resource_key:
                request["driveResourceKey"] = resource_key
            return await _upload_gemini_file(
                request,
                access_token=access_token,
                upstream_base=upstream_base,
                client=client,
                origin=origin,
            )

        # Unknown fileData — error (matches TS err("Unknown part"))
        raise ValueError(f'Unknown fileData URI: "{file_uri}"')

    # All other parts (text, inlineData, etc.) → passthrough
    return part


async def _upload_gemini_file(
    request: dict[str, str],
    *,
    access_token: str,
    upstream_base: str,
    client: httpx.AsyncClient | None = None,
    origin: str = "",
) -> LLMContentPart:
    """Upload a file to Gemini File API via One Platform.

    Calls ``/v1beta1/uploadGeminiFile`` which returns
    ``{fileUrl, mimeType}``.

    Returns:
        A ``fileData`` part with the resolved Gemini File API URL.

    Raises:
        httpx.HTTPStatusError: If the upload fails.
    """
    url = f"{upstream_base.rstrip('/')}{UPLOAD_GEMINI_FILE_ENDPOINT}"

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=120.0)

    try:
        # OP requires the access token in the JSON body (in addition to the
        # Authorization header).  The TS client does this via
        # shouldAddAccessTokenToJsonBody in fetch-allowlist.ts.
        augmented_request = {**request, "accessToken": access_token}

        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        }
        if origin:
            headers["Origin"] = origin

        response = await client.post(
            url,
            json=augmented_request,
            headers=headers,
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
        data = response.json()

        file_url = data.get("fileUrl", "")
        mime_type = data.get("mimeType", "")

        # Build absolute URL if relative
        if file_url and not file_url.startswith("http"):
            file_url = f"{GENAI_API_BASE}{file_url.lstrip('/')}"

        return {
            "fileData": {
                "fileUri": file_url,
                "mimeType": mime_type,
            }
        }
    finally:
        if own_client:
            await client.aclose()


def _maybe_blob(handle: str) -> str | None:
    """Extract blob UUID from a blob store URL, or None."""
    if _BLOB_UUID_RE.match(handle):
        return handle.rsplit("/", 1)[-1]
    return None
