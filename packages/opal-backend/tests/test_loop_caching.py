# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the Loop's prefix caching behavior.

Verifies that:
- When singleton_cached_content_name is set, the Gemini body uses
  cachedContent and omits systemInstruction/tools/toolConfig
- When it's None, the body inlines everything
- When a cached request fails before producing content, the loop
  drops the cache and retries with a full uncached body
"""

from __future__ import annotations

from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest

from opal_backend.loop import AgentRunArgs, Loop, LoopController
from opal_backend.function_definition import FunctionGroup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_function_group(
    *,
    instruction: str = "Be helpful.",
    declarations: list[dict] | None = None,
    definitions: list[tuple] | None = None,
) -> FunctionGroup:
    """Build a minimal FunctionGroup for testing."""
    return FunctionGroup(
        instruction=instruction,
        declarations=declarations or [{"name": "test_fn", "parameters": {}}],
        definitions=definitions or [],
    )


def _make_chunk(*, text: str = "hello", function_call: dict | None = None) -> dict:
    """Build a minimal Gemini response chunk."""
    parts: list[dict] = []
    if text:
        parts.append({"text": text})
    if function_call:
        parts.append({"functionCall": function_call})
    return {
        "candidates": [{
            "content": {
                "parts": parts,
                "role": "model",
            }
        }],
    }


def _terminating_function_group(controller: LoopController) -> FunctionGroup:
    """A function group whose handler terminates the loop."""
    async def handler(args: dict, status_cb: Any) -> dict:
        controller.terminate({
            "success": True,
            "outcomes": None,
        })
        return {"done": True}

    defn = MagicMock()
    defn.handler = handler
    defn.precondition = None
    defn.icon = None
    defn.title = None

    return FunctionGroup(
        instruction="System instruction.",
        declarations=[{"name": "declare_success", "parameters": {}}],
        definitions=[("declare_success", defn)],
    )


class FakeBackend:
    """A fake BackendClient that records calls and yields canned chunks."""

    def __init__(
        self,
        chunks: list[list[dict]] | None = None,
        fail_on_first: bool = False,
    ):
        self._chunks = chunks or [[]]
        self._call_index = 0
        self.calls: list[dict] = []
        self._fail_on_first = fail_on_first

    async def stream_generate_content(
        self, model: str, body: dict[str, Any]
    ) -> AsyncIterator[dict[str, Any]]:
        self.calls.append(body)
        idx = self._call_index
        self._call_index += 1

        if self._fail_on_first and idx == 0:
            raise Exception("Cached content expired")

        chunks = self._chunks[min(idx, len(self._chunks) - 1)]
        for chunk in chunks:
            yield chunk

    async def execute_step(self, body: dict) -> dict:
        return {}

    async def upload_gemini_file(self, request: dict) -> dict:
        return {}

    async def upload_blob_file(self, drive_file_id: str) -> str:
        return ""

    async def create_cached_content(self, body: dict) -> dict:
        return {"name": "cachedContents/test"}

    async def update_cached_content(self, name: str, body: dict) -> dict:
        return {}


# ---------------------------------------------------------------------------
# Cached body shape
# ---------------------------------------------------------------------------


class TestCachedBodyShape:
    """When singleton_cached_content_name is set, the Gemini body must
    include cachedContent and must NOT include systemInstruction,
    tools, or toolConfig."""

    @pytest.mark.asyncio
    async def test_cached_body_has_cached_content_field(self):
        """Body includes cachedContent when name is provided."""
        controller = LoopController()
        group = _terminating_function_group(controller)

        fc_chunk = _make_chunk(function_call={
            "name": "declare_success",
            "args": {},
        })
        backend = FakeBackend(chunks=[[fc_chunk]])
        loop = Loop(backend=backend, controller=controller)

        args = AgentRunArgs(
            objective={"parts": [{"text": "test"}], "role": "user"},
            function_groups=[group],
            singleton_cached_content_name="cachedContents/abc123",
        )
        await loop.run(args)

        assert len(backend.calls) >= 1
        body = backend.calls[0]
        assert body.get("cachedContent") == "cachedContents/abc123"
        assert "systemInstruction" not in body
        assert "tools" not in body
        assert "toolConfig" not in body

    @pytest.mark.asyncio
    async def test_uncached_body_has_system_instruction_and_tools(self):
        """Body inlines SI/tools/toolConfig when no cache name."""
        controller = LoopController()
        group = _terminating_function_group(controller)

        fc_chunk = _make_chunk(function_call={
            "name": "declare_success",
            "args": {},
        })
        backend = FakeBackend(chunks=[[fc_chunk]])
        loop = Loop(backend=backend, controller=controller)

        args = AgentRunArgs(
            objective={"parts": [{"text": "test"}], "role": "user"},
            function_groups=[group],
            # No singleton_cached_content_name
        )
        await loop.run(args)

        assert len(backend.calls) >= 1
        body = backend.calls[0]
        assert "cachedContent" not in body
        assert "systemInstruction" in body
        assert "tools" in body
        assert "toolConfig" in body


# ---------------------------------------------------------------------------
# Expired cache fallback
# ---------------------------------------------------------------------------


class TestExpiredCacheFallback:
    """When stream_generate_content fails before producing content,
    the loop should drop the cache and retry with a full uncached body."""

    @pytest.mark.asyncio
    async def test_retries_without_cache_on_failure(self):
        """First call with cache fails → retry without cache succeeds."""
        controller = LoopController()
        group = _terminating_function_group(controller)

        fc_chunk = _make_chunk(function_call={
            "name": "declare_success",
            "args": {},
        })
        # First call fails (cached), second succeeds (uncached).
        backend = FakeBackend(
            chunks=[[], [fc_chunk]],
            fail_on_first=True,
        )
        loop = Loop(backend=backend, controller=controller)

        args = AgentRunArgs(
            objective={"parts": [{"text": "test"}], "role": "user"},
            function_groups=[group],
            singleton_cached_content_name="cachedContents/expired",
        )
        result = await loop.run(args)

        # Should have made 2 calls: first cached (failed), then uncached.
        assert len(backend.calls) == 2

        # First call should have used cachedContent.
        assert backend.calls[0].get("cachedContent") == "cachedContents/expired"

        # Second call should NOT have cachedContent.
        assert "cachedContent" not in backend.calls[1]
        assert "systemInstruction" in backend.calls[1]
        assert "tools" in backend.calls[1]

        # Result should be success.
        assert result.get("success") is True


# ---------------------------------------------------------------------------
# Contents slicing
# ---------------------------------------------------------------------------


class TestContentsSlicing:
    """When using cached content, only uncached contents should be sent."""

    @pytest.mark.asyncio
    async def test_sends_all_contents_with_cache(self):
        """With cache, contents start from cached_content_count (0)."""
        controller = LoopController()
        group = _terminating_function_group(controller)

        fc_chunk = _make_chunk(function_call={
            "name": "declare_success",
            "args": {},
        })
        backend = FakeBackend(chunks=[[fc_chunk]])
        loop = Loop(backend=backend, controller=controller)

        objective = {"parts": [{"text": "test"}], "role": "user"}
        args = AgentRunArgs(
            objective=objective,
            function_groups=[group],
            singleton_cached_content_name="cachedContents/abc",
        )
        await loop.run(args)

        # With cache and cached_content_count=0, all contents are sent
        # (the cache only covers the static envelope).
        body = backend.calls[0]
        assert len(body["contents"]) == 1
        assert body["contents"][0] == objective
