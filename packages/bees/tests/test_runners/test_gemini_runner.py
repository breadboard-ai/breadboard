# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for GeminiRunner and GeminiStream.

Verifies that:
1. GeminiStream satisfies the SessionStream protocol.
2. GeminiRunner satisfies the SessionRunner protocol.
3. GeminiStream correctly iterates events from a queue.
4. GeminiStream captures resume state on suspend.
5. GeminiStream returns None resume state on completion.
6. GeminiStream.send_context() pushes to the internal queue.
7. Resume state blob includes function_name when available.
8. Resume state blob round-trips through GeminiRunner.resume().
"""

from __future__ import annotations

import asyncio
import json
import unittest
from typing import Any
from unittest.mock import AsyncMock, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_queue(events: list[dict[str, Any] | None]) -> asyncio.Queue:
    """Create a pre-loaded asyncio.Queue from a list of events.

    The list should end with ``None`` (the sentinel).
    """
    queue: asyncio.Queue = asyncio.Queue()
    for event in events:
        queue.put_nowait(event)
    return queue


def _make_completed_task() -> asyncio.Task:
    """Create an already-completed asyncio.Task."""
    async def noop():
        pass
    loop = asyncio.get_event_loop()
    return loop.create_task(noop())


def _make_mock_interaction_store(
    interaction_id: str | None = None,
    state_dict: dict[str, Any] | None = None,
) -> MagicMock:
    """Create a mock InMemoryInteractionStore.

    If ``interaction_id`` and ``state_dict`` are provided, ``load()``
    returns a mock InteractionState with the given dict.
    """
    store = MagicMock()

    if interaction_id and state_dict:
        mock_state = MagicMock()
        mock_state.to_dict.return_value = state_dict
        store.load = AsyncMock(return_value=mock_state)
    else:
        store.load = AsyncMock(return_value=None)

    return store


def _make_mock_session_store(
    resume_id: str | None = None,
) -> MagicMock:
    """Create a mock InMemorySessionStore."""
    store = MagicMock()
    store.get_resume_id = AsyncMock(return_value=resume_id)
    return store


# ---------------------------------------------------------------------------
# Protocol conformance
# ---------------------------------------------------------------------------


class TestGeminiStreamConformance(unittest.TestCase):
    """GeminiStream satisfies the SessionStream protocol."""

    def test_satisfies_session_stream(self):
        """isinstance check passes for SessionStream."""
        from bees.protocols.session import SessionStream
        from bees.runners.gemini import GeminiStream

        task = _make_completed_task()
        stream = GeminiStream(
            queue=asyncio.Queue(),
            task=task,
            context_queue=asyncio.Queue(),
            session_id="test",
            session_store=MagicMock(),
            interaction_store=MagicMock(),
        )
        self.assertIsInstance(stream, SessionStream)


class TestGeminiRunnerConformance(unittest.TestCase):
    """GeminiRunner satisfies the SessionRunner protocol."""

    def test_satisfies_session_runner(self):
        """isinstance check passes for SessionRunner."""
        from bees.protocols.session import SessionRunner
        from bees.runners.gemini import GeminiRunner

        runner = GeminiRunner(backend=MagicMock())
        self.assertIsInstance(runner, SessionRunner)


# ---------------------------------------------------------------------------
# GeminiStream iteration
# ---------------------------------------------------------------------------


class TestGeminiStreamIteration(unittest.TestCase):
    """GeminiStream correctly iterates events from a queue."""

    def test_yields_events_in_order(self):
        """Events are yielded in queue order, stopping at None."""
        from bees.runners.gemini import GeminiStream

        events = [
            {"thought": {"text": "thinking..."}},
            {"functionCall": {"name": "test_fn", "args": {}}},
            {"complete": {"result": {"success": True}}},
        ]

        async def check():
            task = _make_completed_task()
            queue = _make_queue(events + [None])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            received = []
            async for event in stream:
                received.append(event)

            self.assertEqual(received, events)

        asyncio.get_event_loop().run_until_complete(check())

    def test_empty_stream(self):
        """A stream with only None yields no events."""
        from bees.runners.gemini import GeminiStream

        async def check():
            task = _make_completed_task()
            queue = _make_queue([None])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            received = []
            async for event in stream:
                received.append(event)

            self.assertEqual(received, [])

        asyncio.get_event_loop().run_until_complete(check())

    def test_double_iteration_raises(self):
        """Iterating an exhausted stream yields nothing."""
        from bees.runners.gemini import GeminiStream

        async def check():
            task = _make_completed_task()
            queue = _make_queue([{"thought": {"text": "hi"}}, None])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            # First iteration drains events.
            async for _ in stream:
                pass

            # Second iteration yields nothing.
            received = []
            async for event in stream:
                received.append(event)
            self.assertEqual(received, [])

        asyncio.get_event_loop().run_until_complete(check())


# ---------------------------------------------------------------------------
# Resume state capture
# ---------------------------------------------------------------------------


class TestGeminiStreamResumeState(unittest.TestCase):
    """GeminiStream captures resume state correctly."""

    def test_completed_session_returns_none(self):
        """A completed session (no suspend) has no resume state."""
        from bees.runners.gemini import GeminiStream

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                {"complete": {"result": {"success": True}}},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            async for _ in stream:
                pass

            self.assertIsNone(stream.resume_state())

        asyncio.get_event_loop().run_until_complete(check())

    def test_suspended_session_captures_state(self):
        """A suspended session captures resume state as JSON bytes."""
        from bees.runners.gemini import GeminiStream

        interaction_id = "i-test-123"
        state_dict = {
            "function_call_part": {
                "functionCall": {"name": "request_user_input", "args": {}},
            },
        }

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                {"thought": {"text": "need input"}},
                {"waitForInput": {
                    "interactionId": interaction_id,
                    "prompt": "What next?",
                }},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="s-test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(
                    interaction_id=interaction_id,
                    state_dict=state_dict,
                ),
            )

            async for _ in stream:
                pass

            blob = stream.resume_state()
            self.assertIsNotNone(blob)

            data = json.loads(blob)
            self.assertEqual(data["session_id"], "s-test")
            self.assertEqual(data["interaction_id"], interaction_id)
            self.assertEqual(data["interaction_state"], state_dict)
            self.assertEqual(data["function_name"], "request_user_input")

        asyncio.get_event_loop().run_until_complete(check())

    def test_paused_session_captures_state(self):
        """A paused session captures resume state."""
        from bees.runners.gemini import GeminiStream

        interaction_id = "i-paused-456"
        state_dict = {"some": "state"}

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                {"paused": {
                    "message": "Rate limit exceeded",
                    "interactionId": interaction_id,
                }},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="s-paused",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(
                    interaction_id=interaction_id,
                    state_dict=state_dict,
                ),
            )

            async for _ in stream:
                pass

            blob = stream.resume_state()
            self.assertIsNotNone(blob)

            data = json.loads(blob)
            self.assertEqual(data["session_id"], "s-paused")
            self.assertEqual(data["interaction_id"], interaction_id)

        asyncio.get_event_loop().run_until_complete(check())

    def test_function_name_omitted_when_absent(self):
        """If InteractionState has no function_call_part, function_name
        is not included in the blob."""
        from bees.runners.gemini import GeminiStream

        interaction_id = "i-no-fn"
        state_dict = {"other": "data"}  # No function_call_part.

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                {"waitForInput": {
                    "interactionId": interaction_id,
                    "prompt": "?",
                }},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="s-test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(
                    interaction_id=interaction_id,
                    state_dict=state_dict,
                ),
            )

            async for _ in stream:
                pass

            blob = stream.resume_state()
            data = json.loads(blob)
            self.assertNotIn("function_name", data)

        asyncio.get_event_loop().run_until_complete(check())

    def test_fallback_to_session_store_resume_id(self):
        """If the suspend event lacks interactionId, falls back to
        session store's resume_id."""
        from bees.runners.gemini import GeminiStream

        state_dict = {"fallback": True}

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                # Suspend event without interactionId.
                {"waitForInput": {"prompt": "?"}},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="s-fallback",
                session_store=_make_mock_session_store(
                    resume_id="i-from-store",
                ),
                interaction_store=_make_mock_interaction_store(
                    interaction_id="i-from-store",
                    state_dict=state_dict,
                ),
            )

            async for _ in stream:
                pass

            blob = stream.resume_state()
            data = json.loads(blob)
            self.assertEqual(data["interaction_id"], "i-from-store")

        asyncio.get_event_loop().run_until_complete(check())


# ---------------------------------------------------------------------------
# Back-channel methods
# ---------------------------------------------------------------------------


class TestGeminiStreamBackChannel(unittest.TestCase):
    """Back-channel methods work correctly."""

    def test_send_context_pushes_to_queue(self):
        """send_context() puts parts on the internal context queue."""
        from bees.runners.gemini import GeminiStream

        async def check():
            ctx_queue: asyncio.Queue = asyncio.Queue()
            task = _make_completed_task()
            stream = GeminiStream(
                queue=_make_queue([None]),
                task=task,
                context_queue=ctx_queue,
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            parts = [{"text": "update from child"}]
            await stream.send_context(parts)

            self.assertFalse(ctx_queue.empty())
            self.assertEqual(ctx_queue.get_nowait(), parts)

        asyncio.get_event_loop().run_until_complete(check())

    def test_send_tool_response_is_noop(self):
        """send_tool_response() does not raise."""
        from bees.runners.gemini import GeminiStream

        async def check():
            task = _make_completed_task()
            stream = GeminiStream(
                queue=_make_queue([None]),
                task=task,
                context_queue=asyncio.Queue(),
                session_id="test",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(),
            )

            # Should not raise.
            await stream.send_tool_response([{"result": "ok"}])

        asyncio.get_event_loop().run_until_complete(check())


# ---------------------------------------------------------------------------
# Resume state round-trip
# ---------------------------------------------------------------------------


class TestResumeStateBlobFormat(unittest.TestCase):
    """Resume state blob can be deserialized for runner.resume()."""

    def test_blob_is_valid_json(self):
        """The resume state blob is valid JSON with expected keys."""
        from bees.runners.gemini import GeminiStream

        interaction_id = "i-rt"
        state_dict = {
            "function_call_part": {
                "functionCall": {"name": "test_fn", "args": {}},
            },
        }

        async def check():
            task = _make_completed_task()
            queue = _make_queue([
                {"waitForChoice": {
                    "interactionId": interaction_id,
                    "choices": [],
                }},
                None,
            ])
            stream = GeminiStream(
                queue=queue,
                task=task,
                context_queue=asyncio.Queue(),
                session_id="s-rt",
                session_store=_make_mock_session_store(),
                interaction_store=_make_mock_interaction_store(
                    interaction_id=interaction_id,
                    state_dict=state_dict,
                ),
            )

            async for _ in stream:
                pass

            blob = stream.resume_state()
            self.assertIsNotNone(blob)

            # Must be valid JSON bytes.
            data = json.loads(blob)
            self.assertIn("session_id", data)
            self.assertIn("interaction_id", data)
            self.assertIn("interaction_state", data)
            self.assertEqual(data["function_name"], "test_fn")

        asyncio.get_event_loop().run_until_complete(check())


if __name__ == "__main__":
    unittest.main()
