# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Streaming Gemini API client for the agent loop.

Port of the streaming logic extracted from ``loop.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Streams from Gemini via the ``BackendClient`` protocol, with automatic
retry on empty responses. The actual HTTP transport is injected — this
module has no external dependencies.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

from .backend_client import BackendClient

logger = logging.getLogger(__name__)

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
    backend: BackendClient,
) -> AsyncIterator[GeminiChunk]:
    """Stream content from Gemini with automatic retry on empty responses.

    Mirrors the TypeScript ``streamGenerateContent`` function:
    1. Delegate to ``backend.stream_generate_content``
    2. Buffer the response and check for content
    3. Retry (up to MAX_RETRIES) if no content is found

    Args:
        model: Gemini model name (e.g. "gemini-3-flash-preview").
        body: The full request body (contents, tools, etc.).
        backend: BackendClient implementation (handles transport).

    Yields:
        Parsed JSON chunks from the Gemini streaming response.

    Raises:
        GeminiAPIError: If the API returns a non-200 status.
    """
    for attempt in range(STREAM_MAX_RETRIES):
        found_content = False
        buffer: list[GeminiChunk] = []

        async for chunk in backend.stream_generate_content(model, body):
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


def has_content(chunk: GeminiChunk) -> bool:
    """Check if a Gemini response chunk has meaningful content."""
    candidates = chunk.get("candidates", [])
    if not candidates:
        return False
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    return len(parts) > 0
