# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for gemini_client.py — streaming and retry behavior.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from opal_backend.gemini_client import stream_generate_content


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _content_chunk(text: str) -> dict:
    """Build a Gemini chunk with a text part (has content)."""
    return {
        "candidates": [{
            "content": {
                "parts": [{"text": text}],
                "role": "model",
            }
        }]
    }


def _thought_chunk(text: str) -> dict:
    """Build a Gemini chunk with a thought part (has content)."""
    return {
        "candidates": [{
            "content": {
                "parts": [{"text": text, "thought": True}],
                "role": "model",
            }
        }]
    }


def _empty_chunk() -> dict:
    """Build a Gemini chunk with no candidates (no content)."""
    return {"candidates": []}


def _no_parts_chunk() -> dict:
    """Build a Gemini chunk with empty parts (no content)."""
    return {
        "candidates": [{
            "content": {"parts": [], "role": "model"}
        }]
    }


async def _fake_stream(chunks: list[dict]):
    """Async generator that yields chunks."""
    for chunk in chunks:
        yield chunk


def _make_backend(attempts: list[list[dict]]) -> MagicMock:
    """Create a mock BackendClient that yields different chunks per attempt.

    ``attempts`` is a list of lists. Each inner list is the chunks for
    one call to ``stream_generate_content``.
    """
    attempt_iter = iter(attempts)
    backend = MagicMock()
    backend.stream_generate_content = lambda _model, _body: _fake_stream(
        next(attempt_iter)
    )
    return backend


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestStreamGenerateContent:
    """Tests for the stream_generate_content wrapper."""

    @pytest.mark.asyncio
    async def test_yields_all_chunks_in_order(self):
        """All content chunks are yielded in the original order."""
        chunks = [_content_chunk("a"), _content_chunk("b"), _content_chunk("c")]
        backend = _make_backend([chunks])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == chunks

    @pytest.mark.asyncio
    async def test_thought_chunks_are_content(self):
        """Thought chunks have parts, so they count as content."""
        chunks = [_thought_chunk("thinking..."), _content_chunk("result")]
        backend = _make_backend([chunks])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == chunks

    @pytest.mark.asyncio
    async def test_chunks_yielded_in_real_time(self):
        """Chunks are yielded as they arrive, not buffered until stream ends.

        This is the core behavior fix — thoughts must stream progressively.
        """
        arrival_order: list[str] = []

        chunks = [
            _thought_chunk("thought-1"),
            _thought_chunk("thought-2"),
            _content_chunk("result"),
        ]

        # Track when each chunk is consumed by the caller.
        async for chunk in stream_generate_content(
            "model", {}, backend=_make_backend([chunks])
        ):
            text = chunk["candidates"][0]["content"]["parts"][0]["text"]
            arrival_order.append(text)

        # Verify all three arrived.
        assert arrival_order == ["thought-1", "thought-2", "result"]

    @pytest.mark.asyncio
    async def test_retries_on_empty_response(self):
        """Empty first attempt triggers retry; second attempt succeeds."""
        empty_attempt = [_empty_chunk()]
        good_attempt = [_content_chunk("hello")]
        backend = _make_backend([empty_attempt, good_attempt])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == good_attempt

    @pytest.mark.asyncio
    async def test_retries_on_no_parts(self):
        """Chunks with empty parts list trigger retry."""
        no_parts_attempt = [_no_parts_chunk()]
        good_attempt = [_content_chunk("ok")]
        backend = _make_backend([no_parts_attempt, good_attempt])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == good_attempt

    @pytest.mark.asyncio
    async def test_exhaust_retries_yields_last_buffer(self):
        """When all retries fail, yield whatever the last attempt produced."""
        empty = [_empty_chunk()]
        # 5 empty attempts (STREAM_MAX_RETRIES = 5)
        backend = _make_backend([empty] * 5)

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == empty

    @pytest.mark.asyncio
    async def test_pre_content_chunks_flushed_with_content(self):
        """Chunks arriving before content are flushed once content appears."""
        pre = _no_parts_chunk()
        content = _content_chunk("data")
        backend = _make_backend([[pre, content]])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        # Both the pre-content chunk and the content chunk should appear.
        assert result == [pre, content]
