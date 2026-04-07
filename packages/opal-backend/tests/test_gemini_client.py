# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for gemini_client.py — streaming and retry behavior.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from opal_backend.gemini_client import (
    GeminiAPIError,
    _backoff_delay,
    stream_generate_content,
)


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


def _make_backend(attempts: list[list[dict] | Exception]) -> MagicMock:
    """Create a mock BackendClient that yields different chunks per attempt.

    ``attempts`` is a list. Each entry is either:
    - a list of chunks to yield, or
    - an Exception to raise.
    """
    attempt_iter = iter(attempts)

    async def _stream(_model, _body):
        entry = next(attempt_iter)
        if isinstance(entry, Exception):
            raise entry
        async for chunk in _fake_stream(entry):
            yield chunk

    backend = MagicMock()
    backend.stream_generate_content = _stream
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


class TestTransientErrorRetry:
    """Tests for transient API error (429/503) retry behavior."""

    @pytest.mark.asyncio
    async def test_retries_on_503(self):
        """A 503 Resource Exhausted triggers retry; next attempt succeeds."""
        error_503 = GeminiAPIError(
            "Gemini API error 503: Resource exhausted",
            status_code=503,
        )
        good = [_content_chunk("recovered")]
        backend = _make_backend([error_503, good])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == good

    @pytest.mark.asyncio
    async def test_retries_on_429(self):
        """A 429 Rate Limited triggers retry; next attempt succeeds."""
        error_429 = GeminiAPIError(
            "Gemini API error 429: Rate limited",
            status_code=429,
        )
        good = [_content_chunk("ok")]
        backend = _make_backend([error_429, good])

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert result == good

    @pytest.mark.asyncio
    async def test_no_retry_on_400(self):
        """A 400 Bad Request is permanent — no retry, raises immediately."""
        error_400 = GeminiAPIError(
            "Gemini API error 400: Bad request",
            status_code=400,
        )
        backend = _make_backend([error_400])

        with pytest.raises(GeminiAPIError) as exc_info:
            async for _ in stream_generate_content("model", {}, backend=backend):
                pass

        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_exhaust_retries_raises(self):
        """When all retries are transient errors, the last one propagates."""
        errors = [
            GeminiAPIError(f"attempt {i}", status_code=503)
            for i in range(5)
        ]
        backend = _make_backend(errors)

        with pytest.raises(GeminiAPIError) as exc_info:
            async for _ in stream_generate_content("model", {}, backend=backend):
                pass

        assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_mixed_empty_and_transient_share_budget(self):
        """Empty responses and transient errors share the retry budget."""
        # 2 empty, then 2 transient, then success on attempt 5
        attempts: list[list[dict] | Exception] = [
            [_empty_chunk()],
            [_empty_chunk()],
            GeminiAPIError("503", status_code=503),
            GeminiAPIError("503", status_code=503),
            [_content_chunk("finally")],
        ]
        backend = _make_backend(attempts)

        result = []
        async for chunk in stream_generate_content("model", {}, backend=backend):
            result.append(chunk)

        assert len(result) == 1
        text = result[0]["candidates"][0]["content"]["parts"][0]["text"]
        assert text == "finally"


class TestGeminiAPIError:
    """Tests for GeminiAPIError classification."""

    def test_is_transient_503(self):
        e = GeminiAPIError("msg", status_code=503)
        assert e.is_transient is True

    def test_is_transient_429(self):
        e = GeminiAPIError("msg", status_code=429)
        assert e.is_transient is True

    def test_not_transient_400(self):
        e = GeminiAPIError("msg", status_code=400)
        assert e.is_transient is False

    def test_not_transient_default(self):
        e = GeminiAPIError("msg")
        assert e.is_transient is False


class TestBackoffDelay:
    """Tests for the exponential backoff with full jitter."""

    def test_attempt_zero_bounded(self):
        """Attempt 0: delay in [0, 1.0] (base * 2^0 = 1.0)."""
        for _ in range(100):
            d = _backoff_delay(0)
            assert 0 <= d <= 1.0

    def test_attempt_three_bounded(self):
        """Attempt 3: delay in [0, 8.0] (base * 2^3 = 8.0)."""
        for _ in range(100):
            d = _backoff_delay(3)
            assert 0 <= d <= 8.0

    def test_capped_at_max(self):
        """Very high attempts are capped at BACKOFF_MAX_S (60)."""
        for _ in range(100):
            d = _backoff_delay(100)
            assert 0 <= d <= 60.0

    def test_jitter_provides_spread(self):
        """Full jitter produces varying delays (not constant)."""
        delays = {_backoff_delay(3) for _ in range(50)}
        # With 50 samples from [0, 8.0], we expect multiple distinct values.
        assert len(delays) > 10

