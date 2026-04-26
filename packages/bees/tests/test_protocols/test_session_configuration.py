# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for session configuration and stream types.

Verifies that:
1. SessionConfiguration has the expected fields and can be constructed.
2. SessionStream protocol can be satisfied by a minimal mock.
3. SessionEvent is a dict[str, Any] alias.
4. New types are accessible via the protocols package.
"""

from __future__ import annotations

import asyncio
import unittest
from collections.abc import AsyncIterator
from dataclasses import fields
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock


class TestSessionConfigurationConformance(unittest.TestCase):
    """SessionConfiguration has the expected fields and shape."""

    def _make_config(self, **overrides: Any):
        """Create a SessionConfiguration with test defaults."""
        from bees.protocols.session import SessionConfiguration

        # Create a minimal FileSystem mock.
        fs = MagicMock()

        defaults = dict(
            segments=[{"type": "text", "text": "hello"}],
            function_groups=[],
            function_filter=None,
            model="gemini-2.5-flash",
            file_system=fs,
        )
        defaults.update(overrides)
        return SessionConfiguration(**defaults)

    def test_required_fields(self):
        """SessionConfiguration requires segments, function_groups,
        function_filter, model, and file_system."""
        config = self._make_config()
        self.assertEqual(config.segments, [{"type": "text", "text": "hello"}])
        self.assertEqual(config.function_groups, [])
        self.assertIsNone(config.function_filter)
        self.assertEqual(config.model, "gemini-2.5-flash")
        self.assertIsNotNone(config.file_system)

    def test_default_values(self):
        """Optional fields have correct defaults."""
        config = self._make_config()
        self.assertEqual(config.label, "")
        self.assertIsNone(config.log_path)
        self.assertIsNone(config.on_chat_entry)
        self.assertFalse(config.extract_chat_from_context)

    def test_all_fields_settable(self):
        """All fields can be set explicitly."""
        config = self._make_config(
            label="test-123",
            log_path=Path("/tmp/test.json"),
            on_chat_entry=lambda role, text: None,
            function_filter=["system.*", "chat.*"],
        )
        self.assertEqual(config.label, "test-123")
        self.assertEqual(config.log_path, Path("/tmp/test.json"))
        self.assertIsNotNone(config.on_chat_entry)
        self.assertEqual(config.function_filter, ["system.*", "chat.*"])

    def test_field_names(self):
        """SessionConfiguration has exactly the expected field names."""
        from bees.protocols.session import SessionConfiguration

        field_names = {f.name for f in fields(SessionConfiguration)}
        expected = {
            "segments",
            "function_groups",
            "function_filter",
            "model",
            "file_system",
            "ticket_id",
            "ticket_dir",
            "label",
            "log_path",
            "on_chat_entry",
            "extract_chat_from_context",
            "voice",
        }
        self.assertEqual(field_names, expected)

    def test_accessible_from_protocols_package(self):
        """SessionConfiguration is accessible via bees.protocols."""
        from bees.protocols import SessionConfiguration

        config = self._make_config()
        self.assertIsInstance(config, SessionConfiguration)


class TestSessionStreamConformance(unittest.TestCase):
    """SessionStream protocol can be satisfied by a minimal mock."""

    def test_mock_satisfies_protocol(self):
        """A minimal async iterator with back-channel satisfies
        SessionStream."""
        from bees.protocols.session import SessionStream

        class MockStream:
            def __init__(self, events: list[dict[str, Any]]):
                self._events = events
                self._index = 0
                self._resume_state: bytes | None = None

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
                pass

            async def send_context(
                self, parts: list[dict[str, Any]],
            ) -> None:
                pass

            def resume_state(self) -> bytes | None:
                return self._resume_state

        stream = MockStream([
            {"thought": {"text": "thinking..."}},
            {"functionCall": {"name": "test", "args": {}}},
            {"complete": {"result": {"success": True}}},
        ])
        self.assertIsInstance(stream, SessionStream)

    def test_mock_stream_yields_events(self):
        """MockStream yields events in order via async iteration."""
        from bees.protocols.session import SessionStream

        class MockStream:
            def __init__(self, events: list[dict[str, Any]]):
                self._events = events
                self._index = 0

            def __aiter__(self) -> AsyncIterator[dict[str, Any]]:
                return self

            async def __anext__(self) -> dict[str, Any]:
                if self._index >= len(self._events):
                    raise StopAsyncIteration
                event = self._events[self._index]
                self._index += 1
                return event

            async def send_tool_response(self, responses):
                pass

            async def send_context(self, parts):
                pass

            def resume_state(self) -> bytes | None:
                return None

        events = [
            {"thought": {"text": "a"}},
            {"complete": {"result": {}}},
        ]
        stream = MockStream(events)

        collected = []

        async def drain():
            async for event in stream:
                collected.append(event)

        asyncio.get_event_loop().run_until_complete(drain())
        self.assertEqual(collected, events)

    def test_resume_state_none_on_complete(self):
        """resume_state() returns None when the run completed normally."""
        from bees.protocols.session import SessionStream

        class MockStream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

            async def send_tool_response(self, responses):
                pass

            async def send_context(self, parts):
                pass

            def resume_state(self) -> bytes | None:
                return None

        stream = MockStream()
        self.assertIsNone(stream.resume_state())
        self.assertIsInstance(stream, SessionStream)

    def test_resume_state_bytes_on_suspend(self):
        """resume_state() returns bytes when the run suspended."""
        from bees.protocols.session import SessionStream

        class MockStream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

            async def send_tool_response(self, responses):
                pass

            async def send_context(self, parts):
                pass

            def resume_state(self) -> bytes | None:
                return b'{"session_id": "s-1", "interaction_id": "i-1"}'

        stream = MockStream()
        state = stream.resume_state()
        self.assertIsInstance(state, bytes)
        self.assertIsInstance(stream, SessionStream)

    def test_accessible_from_protocols_package(self):
        """SessionStream is accessible via bees.protocols."""
        from bees.protocols import SessionStream

        self.assertTrue(hasattr(SessionStream, "__aiter__"))
        self.assertTrue(hasattr(SessionStream, "send_tool_response"))
        self.assertTrue(hasattr(SessionStream, "send_context"))
        self.assertTrue(hasattr(SessionStream, "resume_state"))


class TestSessionEventConformance(unittest.TestCase):
    """SessionEvent is a dict[str, Any] type alias."""

    def test_is_dict_alias(self):
        """SessionEvent resolves to dict[str, Any]."""
        from bees.protocols.session import SessionEvent

        # A plain dict should satisfy the type.
        event: SessionEvent = {"thought": {"text": "test"}}
        self.assertIsInstance(event, dict)

    def test_accessible_from_protocols_package(self):
        """SessionEvent is accessible via bees.protocols."""
        from bees.protocols import SessionEvent

        event: SessionEvent = {"complete": {}}
        self.assertIsInstance(event, dict)


if __name__ == "__main__":
    unittest.main()
