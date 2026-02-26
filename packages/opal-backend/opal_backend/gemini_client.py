# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Streaming Gemini API client for the agent loop.

Calls the Gemini REST API via the HttpClient protocol, yielding response
chunks as async iterables. The actual HTTP transport is injected — this
module has no external dependencies.

The access token must be provided by the caller — this module
does not manage authentication.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

from .http_client import HttpClient

logger = logging.getLogger(__name__)

GENAI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
STREAM_RETRY_DELAY_S = 0.7
STREAM_MAX_RETRIES = 5

# Types (mirrors GeminiBody / GeminiAPIOutputs from gemini.ts)
GeminiBody = dict[str, Any]
GeminiChunk = dict[str, Any]


class GeminiAPIError(Exception):
    """Raised when the Gemini API returns a non-200 response."""

    pass


async def stream_generate_content(
    model: str,
    body: GeminiBody,
    *,
    access_token: str,
    client: HttpClient,
) -> AsyncIterator[GeminiChunk]:
    """Stream content from Gemini with automatic retry on empty responses.

    Mirrors the TypeScript ``streamGenerateContent`` function:
    1. POST to ``/{model}:streamGenerateContent?alt=sse``
    2. Parse the SSE stream line-by-line
    3. Retry (up to MAX_RETRIES) if no content is found in the response

    Args:
        model: Gemini model name (e.g. "gemini-3-flash-preview").
        body: The full request body (contents, tools, etc.).
        access_token: OAuth2 access token forwarded from the user's request.
        client: HttpClient implementation for making HTTP calls.

    Yields:
        Parsed JSON chunks from the Gemini streaming response.

    Raises:
        GeminiAPIError: If the API returns a non-200 status.
    """
    url = f"{GENAI_API_BASE}/{model}:streamGenerateContent?alt=sse"

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    for attempt in range(STREAM_MAX_RETRIES):
        found_content = False
        buffer: list[GeminiChunk] = []

        async with client.stream_post(
            url, json=body, headers=headers
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise GeminiAPIError(
                    f"Gemini API error {response.status_code}: "
                    f"{error_text.decode()}"
                )

            async for chunk in _parse_sse_stream(response):
                if has_content(chunk):
                    found_content = True
                buffer.append(chunk)

        if found_content:
            for chunk in buffer:
                yield chunk
            return

        # No content found — retry
        if attempt < STREAM_MAX_RETRIES - 1:
            logger.warning(
                "Empty Gemini response (attempt %d/%d), retrying...",
                attempt + 1,
                STREAM_MAX_RETRIES,
            )
            await asyncio.sleep(STREAM_RETRY_DELAY_S)
        else:
            # Exhausted retries — yield whatever we got
            for chunk in buffer:
                yield chunk


async def _parse_sse_stream(
    response: Any,
) -> AsyncIterator[GeminiChunk]:
    """Parse an SSE stream from Gemini into JSON chunks.

    Gemini's ``alt=sse`` format sends lines like:
        data: {"candidates": [...]}

    Each ``data:`` line contains a complete JSON object.
    """
    async for line in response.aiter_lines():
        line = line.strip()
        if line.startswith("data: "):
            json_str = line[len("data: "):]
            try:
                yield json.loads(json_str)
            except json.JSONDecodeError:
                logger.warning("Failed to parse SSE chunk: %s", json_str[:100])


def has_content(chunk: GeminiChunk) -> bool:
    """Check if a Gemini response chunk has meaningful content."""
    candidates = chunk.get("candidates", [])
    if not candidates:
        return False
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    return len(parts) > 0
