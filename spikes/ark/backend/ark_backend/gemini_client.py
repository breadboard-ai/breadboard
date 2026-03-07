"""Lightweight BackendClient for direct Gemini API access via API key.

The standard HttpBackendClient uses OAuth tokens and routes through the
One Platform proxy. For the ark spike, we talk directly to the Gemini API
using an API key — much simpler setup.

Only `stream_generate_content` is implemented; the other methods raise
NotImplementedError since the skilled agent doesn't use them.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

logger = logging.getLogger(__name__)

GENAI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class ApiKeyBackendClient:
    """BackendClient that authenticates via Gemini API key."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._httpx = httpx.AsyncClient(timeout=120.0)

    async def execute_step(self, body: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("execute_step not available in API key mode")

    async def upload_gemini_file(
        self, request: dict[str, str]
    ) -> dict[str, Any]:
        raise NotImplementedError(
            "upload_gemini_file not available in API key mode"
        )

    async def upload_blob_file(self, drive_file_id: str) -> str:
        raise NotImplementedError(
            "upload_blob_file not available in API key mode"
        )

    async def stream_generate_content(
        self,
        model: str,
        body: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream from Gemini using API key auth."""
        url = (
            f"{GENAI_API_BASE}/{model}:streamGenerateContent"
            f"?alt=sse&key={self._api_key}"
        )
        headers = {"Content-Type": "application/json"}

        async with self._httpx.stream(
            "POST", url, json=body, headers=headers
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise RuntimeError(
                    f"Gemini API error {response.status_code}: "
                    f"{error_text.decode()[:500]}"
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
