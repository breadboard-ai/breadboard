# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Unit tests for PendingRequestMap."""

import asyncio

import pytest

from mock_agent_server.pending_requests import PendingRequestMap


@pytest.mark.asyncio
async def test_wait_and_resolve():
    """wait() blocks until resolve() is called with the same requestId."""
    pending = PendingRequestMap()

    async def resolver():
        await asyncio.sleep(0.05)
        assert pending.has("req-1")
        resolved = pending.resolve("req-1", {"input": "hello"})
        assert resolved

    task = asyncio.create_task(resolver())
    result = await pending.wait("req-1")
    await task

    assert result == {"input": "hello"}
    assert not pending.has("req-1")


@pytest.mark.asyncio
async def test_resolve_unknown_returns_false():
    """resolve() returns False for an unknown requestId."""
    pending = PendingRequestMap()
    assert not pending.resolve("nonexistent", {})


@pytest.mark.asyncio
async def test_abort_all_wakes_waiters():
    """abort_all() unblocks all pending waits with None."""
    pending = PendingRequestMap()

    async def waiter(req_id: str) -> object:
        return await pending.wait(req_id)

    t1 = asyncio.create_task(waiter("a"))
    t2 = asyncio.create_task(waiter("b"))
    await asyncio.sleep(0.05)

    assert pending.has("a")
    assert pending.has("b")

    pending.abort_all()
    r1, r2 = await asyncio.gather(t1, t2)

    assert r1 is None
    assert r2 is None
    assert not pending.has("a")
    assert not pending.has("b")


@pytest.mark.asyncio
async def test_multiple_sequential_waits():
    """The same requestId can be reused after it's resolved."""
    pending = PendingRequestMap()

    async def resolve_later(req_id: str, value: str):
        await asyncio.sleep(0.05)
        pending.resolve(req_id, value)

    asyncio.create_task(resolve_later("x", "first"))
    r1 = await pending.wait("x")
    assert r1 == "first"

    asyncio.create_task(resolve_later("x", "second"))
    r2 = await pending.wait("x")
    assert r2 == "second"
