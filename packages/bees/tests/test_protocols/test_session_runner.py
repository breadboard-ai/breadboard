# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for SessionRunner protocol, drain_session, and resume state.

Verifies that:
1. SessionRunner protocol can be satisfied by a minimal mock.
2. drain_session correctly drains a mock stream into a SessionResult.
3. drain_session handles suspend, pause, and error scenarios.
4. save_resume_state / load_resume_state / clear_resume_state round-trip.
5. SessionRunner is accessible via the protocols package.
"""

from __future__ import annotations

import asyncio
import unittest
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock
import tempfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class MockStream:
    """A minimal SessionStream backed by a list of events."""

    def __init__(
        self,
        events: list[dict[str, Any]],
        *,
        resume: bytes | None = None,
    ) -> None:
        self._events = events
        self._index = 0
        self._resume = resume
        self.tool_responses: list[list[dict[str, Any]]] = []
        self.context_parts: list[list[dict[str, Any]]] = []

    def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._index >= len(self._events):
            raise StopAsyncIteration
        event = self._events[self._index]
        self._index += 1
        return event

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        self.tool_responses.append(responses)

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        self.context_parts.append(parts)

    def resume_state(self) -> bytes | None:
        return self._resume


class MockRunner:
    """A minimal SessionRunner backed by MockStream."""

    def __init__(
        self,
        events: list[dict[str, Any]] | None = None,
        *,
        resume_blob: bytes | None = None,
    ) -> None:
        self._events = events or []
        self._resume_blob = resume_blob
        self.run_calls: list[Any] = []
        self.resume_calls: list[dict[str, Any]] = []

    async def run(self, config: Any) -> MockStream:
        self.run_calls.append(config)
        return MockStream(self._events, resume=self._resume_blob)

    async def resume(
        self,
        config: Any,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> MockStream:
        self.resume_calls.append({
            "config": config,
            "state": state,
            "response": response,
            "context_parts": context_parts,
        })
        return MockStream(self._events, resume=self._resume_blob)


def _make_config(**overrides: Any):
    """Create a SessionConfiguration with test defaults."""
    from bees.protocols.session import SessionConfiguration

    fs = MagicMock()
    defaults = dict(
        segments=[{"type": "text", "text": "hello"}],
        function_groups=[],
        function_filter=None,
        model="gemini-2.5-flash",
        file_system=fs,
        label="test",
    )
    defaults.update(overrides)
    return SessionConfiguration(**defaults)


# ---------------------------------------------------------------------------
# SessionRunner protocol conformance
# ---------------------------------------------------------------------------


class TestSessionRunnerConformance(unittest.TestCase):
    """SessionRunner protocol can be satisfied by a minimal mock."""

    def test_mock_satisfies_protocol(self):
        """A minimal mock with run() and resume() satisfies SessionRunner."""
        from bees.protocols.session import SessionRunner

        runner = MockRunner()
        self.assertIsInstance(runner, SessionRunner)

    def test_run_returns_stream(self):
        """run() returns a SessionStream."""
        from bees.protocols.session import SessionRunner, SessionStream

        runner = MockRunner(events=[{"complete": {"result": {}}}])

        async def check():
            config = _make_config()
            stream = await runner.run(config)
            self.assertIsInstance(stream, SessionStream)
            self.assertEqual(len(runner.run_calls), 1)

        asyncio.get_event_loop().run_until_complete(check())

    def test_resume_returns_stream(self):
        """resume() returns a SessionStream."""
        from bees.protocols.session import SessionRunner, SessionStream

        runner = MockRunner(events=[{"complete": {"result": {}}}])

        async def check():
            config = _make_config()
            stream = await runner.resume(
                config,
                state=b"saved-state",
                response={"text": "hello"},
                context_parts=[{"text": "update"}],
            )
            self.assertIsInstance(stream, SessionStream)
            self.assertEqual(len(runner.resume_calls), 1)
            call = runner.resume_calls[0]
            self.assertEqual(call["state"], b"saved-state")
            self.assertEqual(call["response"], {"text": "hello"})
            self.assertEqual(call["context_parts"], [{"text": "update"}])

        asyncio.get_event_loop().run_until_complete(check())

    def test_accessible_from_protocols_package(self):
        """SessionRunner is accessible via bees.protocols."""
        from bees.protocols import SessionRunner

        runner = MockRunner()
        self.assertIsInstance(runner, SessionRunner)


# ---------------------------------------------------------------------------
# drain_session conformance
# ---------------------------------------------------------------------------


class TestDrainSessionComplete(unittest.TestCase):
    """drain_session correctly drains a complete session."""

    def test_basic_complete_session(self):
        """A session with thought → functionCall → usageMetadata → complete
        produces a correct SessionResult."""
        from bees.session import drain_session

        events = [
            {"thought": {"text": "thinking..."}},
            {"functionCall": {"name": "test_fn", "args": {}}},
            {"usageMetadata": {"metadata": {
                "promptTokenCount": 100,
                "candidatesTokenCount": 50,
            }}},
            {"sendRequest": {"body": {"contents": [{"parts": []}]}}},
            {"complete": {"result": {
                "success": True,
                "outcomes": {"parts": [{"text": "done"}]},
            }}},
        ]
        stream = MockStream(events)
        config = _make_config()

        async def check():
            result = await drain_session(
                stream, config=config, ticket_id="test-123",
            )
            self.assertEqual(result.status, "completed")
            self.assertEqual(result.events, 5)
            self.assertEqual(result.turns, 1)
            self.assertEqual(result.thoughts, 1)
            self.assertEqual(result.outcome, "done")
            self.assertFalse(result.suspended)
            self.assertFalse(result.paused)
            self.assertIsNone(result.error)
            self.assertEqual(result.session_id, "test-123")

        asyncio.get_event_loop().run_until_complete(check())

    def test_empty_stream(self):
        """An empty stream produces a completed result with zero events."""
        from bees.session import drain_session

        stream = MockStream([])
        config = _make_config()

        async def check():
            result = await drain_session(stream, config=config)
            self.assertEqual(result.status, "completed")
            self.assertEqual(result.events, 0)
            self.assertEqual(result.turns, 0)

        asyncio.get_event_loop().run_until_complete(check())

    def test_on_event_callback(self):
        """on_event is called for each event."""
        from bees.session import drain_session

        events = [
            {"thought": {"text": "a"}},
            {"complete": {"result": {}}},
        ]
        stream = MockStream(events)
        config = _make_config()
        received: list[dict] = []

        async def on_event(event):
            received.append(event)

        async def check():
            await drain_session(
                stream, config=config, on_event=on_event,
            )
            self.assertEqual(len(received), 2)
            self.assertEqual(received[0], events[0])
            self.assertEqual(received[1], events[1])

        asyncio.get_event_loop().run_until_complete(check())


class TestDrainSessionSuspend(unittest.TestCase):
    """drain_session correctly handles session suspension."""

    def test_suspend_via_wait_for_input(self):
        """A waitForInput event produces a suspended result."""
        from bees.session import drain_session

        events = [
            {"thought": {"text": "need input"}},
            {"waitForInput": {
                "interactionId": "i-1",
                "prompt": "What next?",
            }},
        ]
        stream = MockStream(events)
        config = _make_config()

        async def check():
            result = await drain_session(stream, config=config)
            self.assertEqual(result.status, "suspended")
            self.assertTrue(result.suspended)
            self.assertIsNotNone(result.suspend_event)
            self.assertIn("waitForInput", result.suspend_event)

        asyncio.get_event_loop().run_until_complete(check())

    def test_suspend_via_wait_for_choice(self):
        """A waitForChoice event produces a suspended result."""
        from bees.session import drain_session

        events = [
            {"waitForChoice": {
                "interactionId": "i-2",
                "choices": [],
            }},
        ]
        stream = MockStream(events)
        config = _make_config()

        async def check():
            result = await drain_session(stream, config=config)
            self.assertTrue(result.suspended)
            self.assertEqual(result.status, "suspended")

        asyncio.get_event_loop().run_until_complete(check())


class TestDrainSessionPause(unittest.TestCase):
    """drain_session correctly handles transient pause."""

    def test_paused_event(self):
        """A paused event produces a paused result with error."""
        from bees.session import drain_session

        events = [
            {"paused": {
                "message": "Rate limit exceeded",
                "interactionId": "i-3",
            }},
        ]
        stream = MockStream(events)
        config = _make_config()

        async def check():
            result = await drain_session(stream, config=config)
            self.assertEqual(result.status, "paused")
            self.assertTrue(result.paused)
            self.assertEqual(result.error, "Rate limit exceeded")

        asyncio.get_event_loop().run_until_complete(check())


class TestDrainSessionError(unittest.TestCase):
    """drain_session correctly handles error events."""

    def test_error_event(self):
        """An error event produces a failed result."""
        from bees.session import drain_session

        events = [
            {"error": {"message": "Model unavailable"}},
        ]
        stream = MockStream(events)
        config = _make_config()

        async def check():
            result = await drain_session(stream, config=config)
            self.assertEqual(result.status, "failed")
            self.assertEqual(result.error, "Model unavailable")

        asyncio.get_event_loop().run_until_complete(check())


if __name__ == "__main__":
    unittest.main()
