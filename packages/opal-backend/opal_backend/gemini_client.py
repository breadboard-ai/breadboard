# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Streaming Gemini API client for the agent loop.

Port of the streaming logic extracted from ``loop.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Streams from Gemini via the ``BackendClient`` protocol, with automatic
retry on failures. The actual HTTP transport is injected — this module has
no external dependencies.

**Python-only improvement over TS port**: Unified transient-error retry
with exponential backoff and full jitter. The TypeScript version retries
only on empty responses with a fixed delay. This module additionally
retries on transient API errors (429 rate-limited, 503 resource exhausted)
using the Full Jitter algorithm. This was added to support fault-tolerant
bees sessions where Gemini rate-limiting is common during parallel ticket
execution.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, AsyncIterator

from .backend_client import BackendClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------

STREAM_MAX_RETRIES = 5

# Exponential backoff parameters (Full Jitter algorithm).
# Reference: AWS Architecture Blog, "Exponential Backoff And Jitter"
# https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
BACKOFF_BASE_S = 1.0
BACKOFF_MAX_S = 60.0

# HTTP status codes considered transient (safe to retry).
TRANSIENT_STATUS_CODES = frozenset({429, 503})


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

# Mirrors GeminiBody / GeminiAPIOutputs from gemini.ts
GeminiBody = dict[str, Any]
GeminiChunk = dict[str, Any]


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class GeminiAPIError(Exception):
    """Raised when the Gemini API returns a non-200 response.

    Carries the HTTP ``status_code`` so callers can distinguish
    transient failures (429, 503) from permanent ones (400, 403).
    """

    def __init__(self, message: str, *, status_code: int = 0) -> None:
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_transient(self) -> bool:
        """Whether this error is transient and safe to retry."""
        return self.status_code in TRANSIENT_STATUS_CODES


# ---------------------------------------------------------------------------
# Backoff
# ---------------------------------------------------------------------------


def _backoff_delay(attempt: int) -> float:
    """Compute a retry delay using exponential backoff with full jitter.

    Full Jitter algorithm::

        delay = random_between(0, min(cap, base * 2^attempt))

    This spreads retries uniformly across the backoff window, reducing
    thundering-herd effects when multiple agents hit rate limits
    simultaneously.

    Reference: AWS Architecture Blog, "Exponential Backoff And Jitter"
    https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    """
    exp_delay = min(BACKOFF_MAX_S, BACKOFF_BASE_S * (2 ** attempt))
    return random.uniform(0, exp_delay)


# ---------------------------------------------------------------------------
# Streaming with retry
# ---------------------------------------------------------------------------


async def stream_generate_content(
    model: str,
    body: GeminiBody,
    *,
    backend: BackendClient,
) -> AsyncIterator[GeminiChunk]:
    """Stream content from Gemini with automatic retry on failures.

    Retries on two classes of transient failure:

    1. **Empty responses** — the API returned 200 but no content parts.
       (Original behavior, ported from TypeScript.)
    2. **Transient API errors** — 429 (rate-limited) or 503 (resource
       exhausted). Python-only improvement over the TS port, added for
       fault-tolerant bees sessions.

    Both use exponential backoff with full jitter. The retry budget is
    shared across both failure modes.

    Args:
        model: Gemini model name (e.g. "gemini-3-flash-preview").
        body: The full request body (contents, tools, etc.).
        backend: BackendClient implementation (handles transport).

    Yields:
        Parsed JSON chunks from the Gemini streaming response.

    Raises:
        GeminiAPIError: If retries are exhausted or the error is
            non-transient.
    """
    for attempt in range(STREAM_MAX_RETRIES):
        try:
            found_content = False
            # Buffer chunks until we see real content.  Once content is
            # detected, flush the buffer and stream directly so that
            # consumers receive updates in real time instead of
            # all-at-once after the full response completes.
            buffer: list[GeminiChunk] = []

            async for chunk in backend.stream_generate_content(model, body):
                if has_content(chunk):
                    found_content = True

                if found_content:
                    # Flush any pre-content chunks we buffered earlier.
                    if buffer:
                        for b in buffer:
                            yield b
                        buffer.clear()
                    yield chunk
                else:
                    buffer.append(chunk)

            if found_content:
                return

            # Empty response — retry with backoff.
            if attempt < STREAM_MAX_RETRIES - 1:
                delay = _backoff_delay(attempt)
                logger.warning(
                    "Empty Gemini response (attempt %d/%d), "
                    "retrying in %.1fs…",
                    attempt + 1, STREAM_MAX_RETRIES, delay,
                )
                await asyncio.sleep(delay)
            else:
                # Exhausted retries — yield whatever we got.
                for chunk in buffer:
                    yield chunk

        except GeminiAPIError as e:
            if not e.is_transient or attempt >= STREAM_MAX_RETRIES - 1:
                raise

            delay = _backoff_delay(attempt)
            logger.warning(
                "Transient Gemini API error %d (attempt %d/%d), "
                "retrying in %.1fs: %s",
                e.status_code, attempt + 1, STREAM_MAX_RETRIES,
                delay, e,
            )
            await asyncio.sleep(delay)


def has_content(chunk: GeminiChunk) -> bool:
    """Check if a Gemini response chunk has meaningful content."""
    candidates = chunk.get("candidates", [])
    if not candidates:
        return False
    content = candidates[0].get("content", {})
    parts = content.get("parts", [])
    return len(parts) > 0
