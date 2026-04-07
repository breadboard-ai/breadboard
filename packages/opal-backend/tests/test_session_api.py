# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Unit tests for session API (new_session, start_session, Subscribers)."""

import asyncio

import pytest

from opal_backend.events import (
    CompleteEvent,
    ErrorEvent,
    StartEvent,
    ThoughtEvent,
    AgentResult,
)
from opal_backend.sessions.api import (
    Subscribers,
    new_session,
    start_session,
    _contexts,
)
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from opal_backend.sessions.store import SessionStatus


@pytest.fixture
def store():
    return InMemorySessionStore()


@pytest.fixture
def subscribers():
    return Subscribers()


# ── Subscribers ──


@pytest.mark.asyncio
async def test_subscribe_and_publish():
    subs = Subscribers()
    q = subs.subscribe("sess-1")

    await subs.publish("sess-1", {"type": "start"})
    item = await asyncio.wait_for(q.get(), timeout=1.0)
    assert item == {"type": "start"}


@pytest.mark.asyncio
async def test_unsubscribe():
    subs = Subscribers()
    q = subs.subscribe("sess-1")
    subs.unsubscribe("sess-1", q)

    # Should not raise even with no subscribers.
    await subs.publish("sess-1", {"type": "start"})


@pytest.mark.asyncio
async def test_close_sends_sentinel():
    subs = Subscribers()
    q = subs.subscribe("sess-1")

    await subs.close("sess-1")
    item = await asyncio.wait_for(q.get(), timeout=1.0)
    assert item is None


@pytest.mark.asyncio
async def test_multiple_subscribers():
    subs = Subscribers()
    q1 = subs.subscribe("sess-1")
    q2 = subs.subscribe("sess-1")

    await subs.publish("sess-1", {"type": "event"})

    assert await asyncio.wait_for(q1.get(), timeout=1.0) == {"type": "event"}
    assert await asyncio.wait_for(q2.get(), timeout=1.0) == {"type": "event"}


# ── new_session ──


@pytest.mark.asyncio
async def test_new_session_creates_in_store(store):
    sid = await new_session(
        session_id="sess-test",
        segments=[{"type": "text", "text": "hi"}],
        store=store,
        backend=None,  # type: ignore — not used in creation
        interaction_store=None,  # type: ignore
    )
    assert sid == "sess-test"
    assert await store.get_status("sess-test") == SessionStatus.RUNNING


@pytest.mark.asyncio
async def test_new_session_stashes_context(store):
    await new_session(
        session_id="sess-ctx",
        segments=[{"type": "text", "text": "hi"}],
        store=store,
        backend=None,  # type: ignore
        interaction_store=None,  # type: ignore
        flags={"debug": True},
    )
    ctx = _contexts.get("sess-ctx")
    assert ctx is not None
    assert ctx.segments == [{"type": "text", "text": "hi"}]
    assert ctx.flags == {"debug": True}
    # Clean up.
    _contexts.pop("sess-ctx", None)


# ── start_session ──


@pytest.mark.asyncio
async def test_start_session_no_context(store, subscribers):
    """start_session with missing context sets FAILED status."""
    await store.create("sess-missing")
    await start_session(
        session_id="sess-missing",
        store=store,
        subscribers=subscribers,
    )
    assert await store.get_status("sess-missing") == SessionStatus.FAILED


@pytest.mark.asyncio
async def test_start_session_tees_events(store, subscribers, monkeypatch):
    """Events from run() appear in the store and subscriber queue."""
    # Mock run() to yield a known sequence.
    async def fake_run(**kwargs):
        yield StartEvent(objective="test")
        yield ThoughtEvent(text="thinking...")
        yield CompleteEvent(result=AgentResult(success=True))

    monkeypatch.setattr(
        "opal_backend.sessions.api.run_agent", fake_run,
    )

    # Set up context manually (simulates new_session).
    from opal_backend.sessions.api import _SessionContext
    _contexts["sess-tee"] = _SessionContext(
        segments=[{"type": "text", "text": "hi"}],
        backend=None,  # type: ignore
        interaction_store=None,  # type: ignore
    )
    await store.create("sess-tee")

    # Subscribe before starting.
    q = subscribers.subscribe("sess-tee")

    await start_session(
        session_id="sess-tee",
        store=store,
        subscribers=subscribers,
    )

    # Events should be in the store.
    events = await store.get_events("sess-tee")
    assert len(events) == 3
    assert "start" in events[0]
    assert "thought" in events[1]
    assert "complete" in events[2]

    # Status should be COMPLETED.
    assert await store.get_status("sess-tee") == SessionStatus.COMPLETED

    # Subscriber queue should have all events + sentinel.
    received = []
    while not q.empty():
        received.append(await q.get())
    assert len(received) == 4  # 3 events + None sentinel
    assert received[-1] is None


@pytest.mark.asyncio
async def test_start_session_failed_status(store, subscribers, monkeypatch):
    """CompleteEvent with success=False sets FAILED status."""
    async def fake_run(**kwargs):
        yield CompleteEvent(result=AgentResult(success=False))

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    from opal_backend.sessions.api import _SessionContext
    _contexts["sess-fail"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-fail")

    await start_session(
        session_id="sess-fail", store=store, subscribers=subscribers,
    )

    assert await store.get_status("sess-fail") == SessionStatus.FAILED


@pytest.mark.asyncio
async def test_start_session_exception_sets_failed(store, subscribers, monkeypatch):
    """Exception during run() sets FAILED status and stores error event."""
    async def fake_run(**kwargs):
        yield StartEvent(objective="test")
        raise RuntimeError("boom")

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    from opal_backend.sessions.api import _SessionContext
    _contexts["sess-err"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-err")

    await start_session(
        session_id="sess-err", store=store, subscribers=subscribers,
    )

    assert await store.get_status("sess-err") == SessionStatus.FAILED

    # Error event should be in the store.
    events = await store.get_events("sess-err")
    assert any("error" in e for e in events)


# ── suspend / resume ──


@pytest.mark.asyncio
async def test_start_session_suspend_stashes_resume_id(
    store, subscribers, monkeypatch,
):
    """Suspend event → SUSPENDED status, interaction_id stashed."""
    from opal_backend.events import WaitForInputEvent
    from opal_backend.sessions.api import _SessionContext

    async def fake_run(**kwargs):
        yield StartEvent(objective="test")
        evt = WaitForInputEvent(
            request_id="req-1",
            prompt={"parts": [{"text": "What is your name?"}]},
        )
        evt.interaction_id = "iid-abc"
        yield evt

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    _contexts["sess-sus"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-sus")

    await start_session(
        session_id="sess-sus", store=store, subscribers=subscribers,
    )

    assert await store.get_status("sess-sus") == SessionStatus.SUSPENDED

    # Context should be re-stashed for resume.
    assert "sess-sus" in _contexts
    _contexts.pop("sess-sus", None)


@pytest.mark.asyncio
async def test_resume_session_lifecycle(store, subscribers, monkeypatch):
    """Full lifecycle: start (suspend) → resume → complete."""
    from opal_backend.events import WaitForInputEvent
    from opal_backend.sessions.api import _SessionContext, resume_session

    # Phase 1: start_session suspends.
    async def fake_run(**kwargs):
        yield StartEvent(objective="test")
        evt = WaitForInputEvent(request_id="req-1")
        evt.interaction_id = "iid-resume"
        yield evt

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    _contexts["sess-resume"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-resume")

    await start_session(
        session_id="sess-resume", store=store, subscribers=subscribers,
    )

    assert await store.get_status("sess-resume") == SessionStatus.SUSPENDED

    # Phase 2: resume_session completes.
    async def fake_resume(**kwargs):
        yield ThoughtEvent(text="writing limerick")
        yield CompleteEvent(result=AgentResult(success=True))

    monkeypatch.setattr("opal_backend.sessions.api.resume_agent", fake_resume)

    await store.set_status("sess-resume", SessionStatus.RUNNING)
    await resume_session(
        session_id="sess-resume",
        response={"input": {"role": "user", "parts": [{"text": "Dimitri"}]}},
        store=store,
        subscribers=subscribers,
    )

    assert await store.get_status("sess-resume") == SessionStatus.COMPLETED
    events = await store.get_events("sess-resume")
    # start + waitForInput + thought + complete = 4
    assert len(events) == 4


@pytest.mark.asyncio
async def test_resume_session_no_context(store, subscribers):
    """resume_session with missing context sets FAILED."""
    from opal_backend.sessions.api import resume_session

    await store.create("sess-no-ctx")
    await store.set_resume_id("sess-no-ctx", "iid-orphan")

    await resume_session(
        session_id="sess-no-ctx",
        response={},
        store=store,
        subscribers=subscribers,
    )
    assert await store.get_status("sess-no-ctx") == SessionStatus.FAILED


# ── model override ──


@pytest.mark.asyncio
async def test_new_session_stashes_model(store):
    """new_session stashes the model override in the context."""
    await new_session(
        session_id="sess-model",
        segments=[{"type": "text", "text": "hi"}],
        store=store,
        backend=None,  # type: ignore
        interaction_store=None,  # type: ignore
        model="gemini-2.5-pro",
    )
    ctx = _contexts.get("sess-model")
    assert ctx is not None
    assert ctx.model == "gemini-2.5-pro"
    _contexts.pop("sess-model", None)


@pytest.mark.asyncio
async def test_start_session_passes_model_to_run(store, subscribers, monkeypatch):
    """start_session forwards model from context to run_agent."""
    captured_kwargs = {}

    async def fake_run(**kwargs):
        captured_kwargs.update(kwargs)
        yield CompleteEvent(result=AgentResult(success=True))

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    from opal_backend.sessions.api import _SessionContext
    _contexts["sess-model-run"] = _SessionContext(
        segments=[{"type": "text", "text": "hi"}],
        backend=None,  # type: ignore
        interaction_store=None,  # type: ignore
        model="gemini-2.5-pro",
    )
    await store.create("sess-model-run")

    await start_session(
        session_id="sess-model-run",
        store=store,
        subscribers=subscribers,
    )

    assert captured_kwargs.get("model") == "gemini-2.5-pro"


# ── pause ──


@pytest.mark.asyncio
async def test_start_session_paused_status(store, subscribers, monkeypatch):
    """PausedEvent → PAUSED status, context re-stashed for resume."""
    from opal_backend.events import PausedEvent
    from opal_backend.sessions.api import _SessionContext

    async def fake_run(**kwargs):
        yield PausedEvent(
            message="503 Service Unavailable",
            status_code=503,
            interaction_id="iid-pause-1",
        )

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    _contexts["sess-pause"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-pause")

    await start_session(
        session_id="sess-pause", store=store, subscribers=subscribers,
    )

    assert await store.get_status("sess-pause") == SessionStatus.PAUSED

    # Context should be re-stashed for later resume.
    assert "sess-pause" in _contexts
    _contexts.pop("sess-pause", None)


@pytest.mark.asyncio
async def test_paused_event_stores_resume_id(store, subscribers, monkeypatch):
    """PausedEvent interaction_id is stashed via set_resume_id."""
    from opal_backend.events import PausedEvent
    from opal_backend.sessions.api import _SessionContext

    async def fake_run(**kwargs):
        yield PausedEvent(
            message="503 Service Unavailable",
            status_code=503,
            interaction_id="iid-pause-resume",
        )

    monkeypatch.setattr("opal_backend.sessions.api.run_agent", fake_run)

    _contexts["sess-pause-rid"] = _SessionContext(
        segments=[], backend=None, interaction_store=None,  # type: ignore
    )
    await store.create("sess-pause-rid")

    await start_session(
        session_id="sess-pause-rid", store=store, subscribers=subscribers,
    )

    # Resume ID should match the PausedEvent's interaction_id.
    resume_id = await store.get_resume_id("sess-pause-rid")
    assert resume_id == "iid-pause-resume"
    _contexts.pop("sess-pause-rid", None)

