# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the run()/resume() entry points.

Mocks the Gemini streaming layer and verifies that run() and resume()
yield the correct event sequences, handle suspend/resume round-trips,
and propagate errors properly.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend.events import AgentEvent
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.loop import AgentResult, LoopController
from opal_backend.run import run, resume


# =============================================================================
# Helpers
# =============================================================================


def make_text_chunk(text: str, thought: bool = False) -> dict:
    """Create a Gemini response chunk with a text part."""
    part: dict = {"text": text}
    if thought:
        part["thought"] = True
    return {
        "candidates": [
            {
                "content": {
                    "parts": [part],
                    "role": "model",
                }
            }
        ]
    }


def make_function_call_chunk(name: str, args: dict | None = None) -> dict:
    """Create a Gemini response chunk with a function call."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "functionCall": {
                                "name": name,
                                "args": args or {},
                            }
                        }
                    ],
                    "role": "model",
                }
            }
        ]
    }


def make_objective() -> dict:
    """Create a minimal objective."""
    return {
        "parts": [{"text": "<objective>Say hello</objective>"}],
        "role": "user",
    }


def make_mock_client() -> MagicMock:
    """Create a mock HttpClient with access_token."""
    return MagicMock(access_token="test-token")


def make_mock_backend() -> MagicMock:
    """Create a mock BackendClient."""
    return MagicMock()


async def collect_events(event_iter) -> list[dict]:
    """Collect all events from an async iterator as dicts."""
    events = []
    async for event in event_iter:
        events.append(event.to_dict())
    return events


def event_type(e: dict) -> str:
    """Extract the event type from a proto-style oneof dict."""
    return next(iter(e))


# =============================================================================
# run() tests
# =============================================================================


class TestRun:
    """Tests for the run() async generator."""

    @pytest.mark.asyncio
    async def test_run_yields_complete_event(self):
        """A simple run with system_objective_fulfilled yields a complete event."""
        chunks = [
            make_text_chunk("Thinking...", thought=True),
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done", "href": "/"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                objective=make_objective(),
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
            ))

        types = [event_type(e) for e in events]
        assert "complete" in types

        # The complete event should indicate success.
        complete = next(e for e in events if event_type(e) == "complete")
        assert complete["complete"]["result"]["success"] is True

    @pytest.mark.asyncio
    async def test_run_yields_error_on_exception(self):
        """If the Gemini call raises, run() yields an error event."""
        async def exploding_stream(*args, **kwargs):
            raise RuntimeError("Boom")
            # Unreachable, but makes this a generator.
            yield  # noqa: F401 — unreachable yield for generator protocol

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=exploding_stream,
        ):
            events = await collect_events(run(
                objective=make_objective(),
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
            ))

        types = [event_type(e) for e in events]
        assert "error" in types

    @pytest.mark.asyncio
    async def test_run_suspend_saves_state(self):
        """When a suspend function is called, state is saved to the store."""
        chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What do you think?"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        store = InMemoryInteractionStore()

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                objective=make_objective(),
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=store,
            ))

        types = [event_type(e) for e in events]
        # Should have a suspend event (waitForInput).
        assert "waitForInput" in types

        # The store should now have a saved interaction.
        assert len(store._store) == 1

    @pytest.mark.asyncio
    async def test_run_failed_objective(self):
        """system_failed_to_fulfill_objective yields a complete with success=False."""
        chunks = [
            make_function_call_chunk(
                "system_failed_to_fulfill_objective",
                {"user_message": "Cannot do this"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                objective=make_objective(),
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
            ))

        types = [event_type(e) for e in events]
        assert "complete" in types

        complete = next(e for e in events if event_type(e) == "complete")
        assert complete["complete"]["result"]["success"] is False


# =============================================================================
# resume() tests
# =============================================================================


class TestResume:
    """Tests for the resume() async generator."""

    @pytest.mark.asyncio
    async def test_resume_unknown_id_yields_error(self):
        """Resuming with an unknown interaction ID yields an error."""
        events = await collect_events(resume(
            interaction_id="nonexistent",
            response={"text": "hi"},
            client=make_mock_client(),
            backend=make_mock_backend(),
            store=InMemoryInteractionStore(),
        ))

        assert len(events) == 1
        assert event_type(events[0]) == "error"
        assert "Unknown interaction ID" in events[0]["error"]["message"]

    @pytest.mark.asyncio
    async def test_suspend_then_resume(self):
        """Full round-trip: run suspends, resume continues to completion."""
        # --- Phase 1: run until suspend ---
        suspend_chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What now?"},
            ),
        ]

        async def suspend_stream(*args, **kwargs):
            for chunk in suspend_chunks:
                yield chunk

        store = InMemoryInteractionStore()

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=suspend_stream,
        ):
            run_events = await collect_events(run(
                objective=make_objective(),
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=store,
            ))

        # Find the suspend event to get interaction_id.
        suspend_event = next(
            e for e in run_events if event_type(e) == "waitForInput"
        )
        interaction_id = suspend_event["waitForInput"]["interactionId"]

        # --- Phase 2: resume to completion ---
        resume_chunks = [
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "All done", "href": "/"},
            ),
        ]

        async def resume_stream(*args, **kwargs):
            for chunk in resume_chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=resume_stream,
        ):
            resume_events = await collect_events(resume(
                interaction_id=interaction_id,
                response={"text": "Continue!"},
                client=make_mock_client(),
                backend=make_mock_backend(),
                store=store,
            ))

        types = [event_type(e) for e in resume_events]
        assert "complete" in types

        complete = next(
            e for e in resume_events if event_type(e) == "complete"
        )
        assert complete["complete"]["result"]["success"] is True
