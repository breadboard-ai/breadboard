# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for singleton_cache.py — cache hit/miss, TTL expiry,
throttled TTL extension, and Gemini API failure handling.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import pytest

from opal_backend.singleton_cache import (
    _cache,
    _cache_key,
    _CacheEntry,
    _maybe_extend_ttl,
    get_singleton_prefix_cache,
    CACHE_TTL_SECONDS,
    EXTEND_THRESHOLD_SECONDS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_client(
    *,
    create_response: dict | None = None,
    create_error: Exception | None = None,
    update_response: dict | None = None,
    update_error: Exception | None = None,
) -> AsyncMock:
    """Build a mock BackendClient with configurable responses."""
    client = AsyncMock()

    if create_error:
        client.create_cached_content.side_effect = create_error
    else:
        client.create_cached_content.return_value = create_response or {
            "name": "cachedContents/test-abc123",
        }

    if update_error:
        client.update_cached_content.side_effect = update_error
    else:
        client.update_cached_content.return_value = update_response or {}

    return client


@pytest.fixture(autouse=True)
def _clear_cache():
    """Clear the in-memory cache before each test."""
    _cache.clear()
    yield
    _cache.clear()


# ---------------------------------------------------------------------------
# get_singleton_prefix_cache: cache miss
# ---------------------------------------------------------------------------


class TestCacheMiss:
    """Tests for the cache-miss path (creating new cached content)."""

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_creates_cached_content_on_miss(self, mock_build):
        """Cache miss calls create_cached_content with the built payload."""
        mock_build.return_value = {"model": "models/test", "tools": []}
        client = _make_client(create_response={"name": "cachedContents/new"})

        result = await get_singleton_prefix_cache(client=client)

        client.create_cached_content.assert_awaited_once_with(
            {"model": "models/test", "tools": []}
        )
        assert result == {"cachedContent": {"name": "cachedContents/new"}}

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_stores_entry_in_cache_on_miss(self, mock_build):
        """Successful creation stores the entry in the in-memory cache."""
        mock_build.return_value = {}
        client = _make_client(create_response={"name": "cachedContents/stored"})

        await get_singleton_prefix_cache(client=client)

        key = _cache_key(False, False, False)
        assert key in _cache
        assert _cache[key].name == "cachedContents/stored"

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_passes_flags_to_build_prefix_payload(self, mock_build):
        """The three boolean flags are forwarded to build_prefix_payload."""
        mock_build.return_value = {}
        client = _make_client()

        await get_singleton_prefix_cache(
            use_memory=True,
            use_notebooklm=True,
            use_google_drive=True,
            client=client,
        )

        mock_build.assert_called_once_with(
            use_memory=True,
            use_notebooklm=True,
            use_google_drive=True,
        )

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_returns_error_on_create_failure(self, mock_build):
        """API error during creation returns errorMessage, not an exception."""
        mock_build.return_value = {}
        client = _make_client(
            create_error=Exception("Gemini API error 500: Internal error")
        )

        result = await get_singleton_prefix_cache(client=client)

        assert "errorMessage" in result
        assert "500" in result["errorMessage"]

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_does_not_cache_on_create_failure(self, mock_build):
        """Failed creation must not leave a stale entry in the cache."""
        mock_build.return_value = {}
        client = _make_client(create_error=Exception("boom"))

        await get_singleton_prefix_cache(client=client)

        assert len(_cache) == 0


# ---------------------------------------------------------------------------
# get_singleton_prefix_cache: cache hit
# ---------------------------------------------------------------------------


class TestCacheHit:
    """Tests for the cache-hit path (returning existing cached content)."""

    @pytest.mark.asyncio
    async def test_returns_cached_name_on_hit(self):
        """Cache hit returns the stored name without calling the API."""
        key = _cache_key(False, False, False)
        _cache[key] = _CacheEntry(name="cachedContents/existing", created_at=time.time())

        client = _make_client()
        result = await get_singleton_prefix_cache(client=client)

        assert result == {"cachedContent": {"name": "cachedContents/existing"}}
        client.create_cached_content.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_different_flag_combos_cache_separately(self):
        """Different flag combinations produce independent cache entries."""
        key_mem = _cache_key(True, False, False)
        _cache[key_mem] = _CacheEntry(
            name="cachedContents/with-memory", created_at=time.time()
        )

        client = _make_client()

        # Hit for memory=True
        result_mem = await get_singleton_prefix_cache(
            use_memory=True, client=client
        )
        assert result_mem == {"cachedContent": {"name": "cachedContents/with-memory"}}

        # Miss for default flags (no memory)
        with patch("opal_backend.singleton_cache.build_prefix_payload", return_value={}):
            result_default = await get_singleton_prefix_cache(client=client)

        assert result_default == {
            "cachedContent": {"name": "cachedContents/test-abc123"}
        }
        client.create_cached_content.assert_awaited_once()


# ---------------------------------------------------------------------------
# TTL expiry
# ---------------------------------------------------------------------------


class TestTTLExpiry:
    """Tests for in-memory TTL expiry behavior."""

    @pytest.mark.asyncio
    @patch("opal_backend.singleton_cache.build_prefix_payload")
    async def test_expired_entry_triggers_cache_miss(self, mock_build):
        """An entry older than CACHE_TTL_SECONDS is treated as a miss."""
        mock_build.return_value = {}
        key = _cache_key(False, False, False)
        _cache[key] = _CacheEntry(
            name="cachedContents/old",
            created_at=time.time() - CACHE_TTL_SECONDS - 1,
        )

        client = _make_client(create_response={"name": "cachedContents/fresh"})
        result = await get_singleton_prefix_cache(client=client)

        # Should have created a new one, not returned the expired entry.
        client.create_cached_content.assert_awaited_once()
        assert result == {"cachedContent": {"name": "cachedContents/fresh"}}

    @pytest.mark.asyncio
    async def test_almost_expired_entry_still_hits(self):
        """An entry 1 second before TTL is still valid."""
        key = _cache_key(False, False, False)
        _cache[key] = _CacheEntry(
            name="cachedContents/almost-expired",
            created_at=time.time() - CACHE_TTL_SECONDS + 1,
        )

        client = _make_client()
        result = await get_singleton_prefix_cache(client=client)

        assert result == {"cachedContent": {"name": "cachedContents/almost-expired"}}
        client.create_cached_content.assert_not_awaited()


# ---------------------------------------------------------------------------
# Throttled TTL extension (_maybe_extend_ttl)
# ---------------------------------------------------------------------------


class TestTTLExtension:
    """Tests for the throttled Gemini-side TTL extension."""

    @pytest.mark.asyncio
    async def test_skips_extension_when_recently_extended(self):
        """No PATCH when entry was extended less than EXTEND_THRESHOLD ago."""
        entry = _CacheEntry(
            name="cachedContents/fresh",
            created_at=time.time(),
            last_extended_at=time.time(),
        )
        client = _make_client()

        await _maybe_extend_ttl(entry, client)

        client.update_cached_content.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_extends_when_stale(self):
        """PATCHes TTL when entry is older than EXTEND_THRESHOLD."""
        stale_time = time.time() - EXTEND_THRESHOLD_SECONDS - 1
        entry = _CacheEntry(
            name="cachedContents/stale",
            created_at=stale_time,
            last_extended_at=stale_time,
        )
        client = _make_client()

        await _maybe_extend_ttl(entry, client)

        client.update_cached_content.assert_awaited_once_with(
            "cachedContents/stale",
            {"ttl": f"{CACHE_TTL_SECONDS}s"},
        )

    @pytest.mark.asyncio
    async def test_updates_last_extended_at_on_success(self):
        """Successful extension updates the last_extended_at timestamp."""
        stale_time = time.time() - EXTEND_THRESHOLD_SECONDS - 1
        entry = _CacheEntry(
            name="cachedContents/stale",
            created_at=stale_time,
            last_extended_at=stale_time,
        )
        client = _make_client()

        before = time.time()
        await _maybe_extend_ttl(entry, client)

        assert entry.last_extended_at >= before

    @pytest.mark.asyncio
    async def test_extension_failure_is_non_fatal(self):
        """PATCH failure logs a warning but does not raise."""
        stale_time = time.time() - EXTEND_THRESHOLD_SECONDS - 1
        entry = _CacheEntry(
            name="cachedContents/stale",
            created_at=stale_time,
            last_extended_at=stale_time,
        )
        client = _make_client(update_error=Exception("PATCH failed"))

        # Should not raise.
        await _maybe_extend_ttl(entry, client)

        # last_extended_at should NOT be updated on failure.
        assert entry.last_extended_at == stale_time

    @pytest.mark.asyncio
    async def test_throttle_prevents_consecutive_extensions(self):
        """After one successful extension, the next call within the
        threshold is skipped — ensuring at most 1 PATCH per window."""
        stale_time = time.time() - EXTEND_THRESHOLD_SECONDS - 1
        entry = _CacheEntry(
            name="cachedContents/stale",
            created_at=stale_time,
            last_extended_at=stale_time,
        )
        client = _make_client()

        # First call: should PATCH.
        await _maybe_extend_ttl(entry, client)
        assert client.update_cached_content.await_count == 1

        # Second call immediately after: should skip.
        await _maybe_extend_ttl(entry, client)
        assert client.update_cached_content.await_count == 1


# ---------------------------------------------------------------------------
# Cache key
# ---------------------------------------------------------------------------


class TestCacheKey:
    """Tests for _cache_key correctness."""

    def test_same_flags_produce_same_key(self):
        assert _cache_key(True, False, True) == _cache_key(True, False, True)

    def test_different_flags_produce_different_keys(self):
        assert _cache_key(True, False, False) != _cache_key(False, True, False)

    def test_all_combinations_are_distinct(self):
        keys = set()
        for m in (True, False):
            for n in (True, False):
                for g in (True, False):
                    keys.add(_cache_key(m, n, g))
        assert len(keys) == 8
