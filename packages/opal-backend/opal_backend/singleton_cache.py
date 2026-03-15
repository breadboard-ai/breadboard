# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Singleton prefix cache for agent runs.

Caches Gemini ``cachedContents`` resources keyed by the combination of
boolean flags that determine which function groups are active. Because
the system instruction + tool declarations are fully determined by these
flags, multiple clients with the same flag combination can share a single
cached content resource.

Uses ``BackendClient.create_cached_content()`` for the Gemini API call,
so the same logic works in both dev (GEMINI_KEY + httpx) and prod (RPC
bindings).
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .backend_client import BackendClient
from .prefix_payload import build_prefix_payload, CACHE_TTL_SECONDS

__all__ = ["get_singleton_prefix_cache"]

logger = logging.getLogger(__name__)

# Only extend the TTL when the entry is older than this threshold.
# Set to ⅔ of the TTL so we refresh well before expiry, but at most
# once per EXTEND_THRESHOLD window regardless of request volume.
EXTEND_THRESHOLD_SECONDS = CACHE_TTL_SECONDS * 2 // 3


@dataclass
class _CacheEntry:
    """A cached content name with its creation timestamp."""

    name: str
    created_at: float
    last_extended_at: float = field(default_factory=time.time)


# In-memory cache: (useMemory, useNotebookLM, useGoogleDrive) → _CacheEntry.
# OK to be per-process — each process maintains its own set of handles.
_cache: dict[tuple[bool, bool, bool], _CacheEntry] = {}


def _cache_key(
    use_memory: bool, use_notebooklm: bool, use_google_drive: bool
) -> tuple[bool, bool, bool]:
    return (use_memory, use_notebooklm, use_google_drive)


async def _maybe_extend_ttl(entry: _CacheEntry, client: BackendClient) -> None:
    """Extend the Gemini-side TTL if the entry is getting stale.

    Throttled: only PATCHes when more than EXTEND_THRESHOLD_SECONDS have
    elapsed since the last extension. Fire-and-forget — failures are
    logged but don't affect the caller.
    """
    now = time.time()
    if now - entry.last_extended_at < EXTEND_THRESHOLD_SECONDS:
        return  # Plenty of TTL left, skip.

    try:
        await client.update_cached_content(
            entry.name, {"ttl": f"{CACHE_TTL_SECONDS}s"}
        )
        entry.last_extended_at = now
        logger.info("Extended TTL for %s", entry.name)
    except Exception as exc:
        # Non-fatal — the cache may expire, but the client-side
        # fallback in loop.ts handles that gracefully.
        logger.warning("Failed to extend TTL for %s: %s", entry.name, exc)


async def get_singleton_prefix_cache(
    *,
    use_memory: bool = False,
    use_notebooklm: bool = False,
    use_google_drive: bool = False,
    client: BackendClient,
) -> dict[str, Any]:
    """Get or create a singleton cached content resource.

    Returns ``{"cachedContent": {"name": "..."}}`` on success, or
    ``{"errorMessage": "..."}`` on failure.
    """
    key = _cache_key(use_memory, use_notebooklm, use_google_drive)
    now = time.time()

    # Check cache — expire entries older than TTL.
    entry = _cache.get(key)
    if entry and (now - entry.created_at) < CACHE_TTL_SECONDS:
        logger.info("Singleton cache hit: %s → %s", key, entry.name)

        # Extend Gemini-side TTL in the background (throttled).
        asyncio.ensure_future(_maybe_extend_ttl(entry, client))

        return {"cachedContent": {"name": entry.name}}

    # Cache miss or expired — create a new cached content resource.
    payload = build_prefix_payload(
        use_memory=use_memory,
        use_notebooklm=use_notebooklm,
        use_google_drive=use_google_drive,
    )

    logger.info("Singleton cache miss for %s — creating new cached content", key)

    try:
        resp_body = await client.create_cached_content(payload)
    except Exception as exc:
        logger.error("Failed to create cached content: %s", exc)
        return {"errorMessage": str(exc)}

    cached_name = resp_body.get("name", "")

    # Store in cache.
    _cache[key] = _CacheEntry(name=cached_name, created_at=now)
    logger.info("Singleton cache created: %s → %s", key, cached_name)

    return {"cachedContent": resp_body}
