# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Unit tests for InMemorySessionStore."""

import pytest

from opal_backend.interaction_store import InteractionState
from opal_backend.agent_file_system import FileSystemSnapshot
from opal_backend.task_tree_manager import TaskTreeSnapshot
from opal_backend.sessions.store import SessionStatus
from opal_backend.sessions.in_memory_store import InMemorySessionStore


@pytest.fixture
def store():
    return InMemorySessionStore()


def _make_interaction_state():
    """Create a minimal InteractionState for testing."""
    return InteractionState(
        contents=[{"role": "user", "parts": [{"text": "hello"}]}],
        function_call_part={"functionCall": {"name": "test", "args": {}}},
        file_system=FileSystemSnapshot(files={}, routes={}, file_count=0),
        task_tree=TaskTreeSnapshot(tree={}),
    )


# ── Lifecycle ──


@pytest.mark.asyncio
async def test_create_and_get_status(store):
    await store.create("sess-1")
    assert await store.get_status("sess-1") == SessionStatus.RUNNING


@pytest.mark.asyncio
async def test_get_status_not_found(store):
    assert await store.get_status("nonexistent") is None


@pytest.mark.asyncio
async def test_set_status(store):
    await store.create("sess-1")
    await store.set_status("sess-1", SessionStatus.SUSPENDED)
    assert await store.get_status("sess-1") == SessionStatus.SUSPENDED


@pytest.mark.asyncio
async def test_status_transitions(store):
    """Full lifecycle: running → suspended → running → completed."""
    await store.create("sess-1")
    assert await store.get_status("sess-1") == SessionStatus.RUNNING

    await store.set_status("sess-1", SessionStatus.SUSPENDED)
    assert await store.get_status("sess-1") == SessionStatus.SUSPENDED

    await store.set_status("sess-1", SessionStatus.RUNNING)
    assert await store.get_status("sess-1") == SessionStatus.RUNNING

    await store.set_status("sess-1", SessionStatus.COMPLETED)
    assert await store.get_status("sess-1") == SessionStatus.COMPLETED


# ── Event Log ──


@pytest.mark.asyncio
async def test_append_and_get_events(store):
    await store.create("sess-1")
    idx0 = await store.append_event("sess-1", {"type": "start"})
    idx1 = await store.append_event("sess-1", {"type": "thought"})
    idx2 = await store.append_event("sess-1", {"type": "complete"})

    assert idx0 == 0
    assert idx1 == 1
    assert idx2 == 2

    events = await store.get_events("sess-1")
    assert len(events) == 3
    assert events[0]["type"] == "start"
    assert events[2]["type"] == "complete"


@pytest.mark.asyncio
async def test_get_events_after(store):
    await store.create("sess-1")
    await store.append_event("sess-1", {"type": "a"})
    await store.append_event("sess-1", {"type": "b"})
    await store.append_event("sess-1", {"type": "c"})

    events = await store.get_events("sess-1", after=0)
    assert len(events) == 2
    assert events[0]["type"] == "b"

    events = await store.get_events("sess-1", after=2)
    assert len(events) == 0


@pytest.mark.asyncio
async def test_append_event_not_found(store):
    with pytest.raises(KeyError):
        await store.append_event("nonexistent", {"type": "x"})


@pytest.mark.asyncio
async def test_get_events_not_found(store):
    events = await store.get_events("nonexistent")
    assert events == []


# ── Interaction State ──


@pytest.mark.asyncio
async def test_save_and_load_interaction(store):
    await store.create("sess-1")
    state = _make_interaction_state()

    await store.save_interaction("sess-1", state)
    loaded = await store.load_interaction("sess-1")

    assert loaded is not None
    assert loaded.contents == state.contents
    assert loaded.function_call_part == state.function_call_part


@pytest.mark.asyncio
async def test_load_interaction_clears(store):
    """Loading interaction state is single-use — second load returns None."""
    await store.create("sess-1")
    await store.save_interaction("sess-1", _make_interaction_state())

    first = await store.load_interaction("sess-1")
    assert first is not None

    second = await store.load_interaction("sess-1")
    assert second is None


@pytest.mark.asyncio
async def test_save_interaction_overwrites(store):
    """Saving overwrites any prior snapshot."""
    await store.create("sess-1")
    state1 = _make_interaction_state()
    state2 = _make_interaction_state()
    state2.contents = [{"role": "user", "parts": [{"text": "updated"}]}]

    await store.save_interaction("sess-1", state1)
    await store.save_interaction("sess-1", state2)

    loaded = await store.load_interaction("sess-1")
    assert loaded is not None
    assert loaded.contents[0]["parts"][0]["text"] == "updated"


@pytest.mark.asyncio
async def test_load_interaction_not_found(store):
    assert await store.load_interaction("nonexistent") is None
