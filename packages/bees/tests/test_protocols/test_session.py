# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for bees.protocols.session.

Verifies that:
1. SUSPEND_TYPES and PAUSE_TYPES match the opal_backend originals.
2. SessionResult has the expected fields, defaults, and structure.
"""

from __future__ import annotations

import unittest
from dataclasses import fields


class TestSuspendTypesConformance(unittest.TestCase):
    """SUSPEND_TYPES matches opal_backend.events.SUSPEND_TYPES."""

    def test_identical_to_opal(self):
        """Bees SUSPEND_TYPES is identical to the opal original."""
        from bees.protocols.session import SUSPEND_TYPES
        from opal_backend.events import SUSPEND_TYPES as OpalSuspendTypes

        self.assertEqual(SUSPEND_TYPES, OpalSuspendTypes)

    def test_is_frozenset(self):
        """SUSPEND_TYPES is a frozenset (immutable)."""
        from bees.protocols.session import SUSPEND_TYPES

        self.assertIsInstance(SUSPEND_TYPES, frozenset)

    def test_contains_known_types(self):
        """SUSPEND_TYPES contains all known suspend event types."""
        from bees.protocols.session import SUSPEND_TYPES

        expected = {
            "waitForInput",
            "waitForChoice",
            "readGraph",
            "inspectNode",
            "applyEdits",
            "queryConsent",
        }
        self.assertEqual(SUSPEND_TYPES, expected)


class TestPauseTypesConformance(unittest.TestCase):
    """PAUSE_TYPES matches opal_backend.events.PAUSE_TYPES."""

    def test_identical_to_opal(self):
        """Bees PAUSE_TYPES is identical to the opal original."""
        from bees.protocols.session import PAUSE_TYPES
        from opal_backend.events import PAUSE_TYPES as OpalPauseTypes

        self.assertEqual(PAUSE_TYPES, OpalPauseTypes)

    def test_is_frozenset(self):
        """PAUSE_TYPES is a frozenset (immutable)."""
        from bees.protocols.session import PAUSE_TYPES

        self.assertIsInstance(PAUSE_TYPES, frozenset)

    def test_contains_paused(self):
        """PAUSE_TYPES contains exactly 'paused'."""
        from bees.protocols.session import PAUSE_TYPES

        self.assertEqual(PAUSE_TYPES, frozenset({"paused"}))


class TestSessionResultConformance(unittest.TestCase):
    """SessionResult has the expected fields and defaults."""

    def test_required_fields(self):
        """SessionResult requires session_id, status, events, output."""
        from bees.protocols.session import SessionResult

        result = SessionResult(
            session_id="test-123",
            status="completed",
            events=5,
            output="/path/to/log.json",
        )
        self.assertEqual(result.session_id, "test-123")
        self.assertEqual(result.status, "completed")
        self.assertEqual(result.events, 5)
        self.assertEqual(result.output, "/path/to/log.json")

    def test_default_values(self):
        """Optional fields have correct defaults."""
        from bees.protocols.session import SessionResult

        result = SessionResult(
            session_id="test",
            status="completed",
            events=0,
            output="",
        )
        self.assertEqual(result.turns, 0)
        self.assertEqual(result.thoughts, 0)
        self.assertIsNone(result.outcome)
        self.assertIsNone(result.error)
        self.assertEqual(result.files, [])
        self.assertIsNone(result.intermediate)
        self.assertFalse(result.suspended)
        self.assertIsNone(result.suspend_event)
        self.assertIsNone(result.outcome_content)
        self.assertFalse(result.paused)
        self.assertIsNone(result.paused_event)

    def test_field_names_match_original(self):
        """Field names and count match the original in session.py."""
        from bees.protocols.session import SessionResult

        field_names = {f.name for f in fields(SessionResult)}
        expected = {
            "session_id",
            "status",
            "events",
            "output",
            "turns",
            "thoughts",
            "outcome",
            "error",
            "files",
            "intermediate",
            "suspended",
            "suspend_event",
            "outcome_content",
            "paused",
            "paused_event",
        }
        self.assertEqual(field_names, expected)

    def test_suspended_result(self):
        """SessionResult can represent a suspended session."""
        from bees.protocols.session import SessionResult

        result = SessionResult(
            session_id="s-1",
            status="suspended",
            events=3,
            output="/log.json",
            suspended=True,
            suspend_event={"waitForInput": {"prompt": {"parts": []}}},
        )
        self.assertTrue(result.suspended)
        self.assertIn("waitForInput", result.suspend_event)

    def test_paused_result(self):
        """SessionResult can represent a paused session."""
        from bees.protocols.session import SessionResult

        result = SessionResult(
            session_id="s-2",
            status="paused",
            events=2,
            output="/log.json",
            paused=True,
            paused_event={"paused": {"message": "503"}},
            error="503",
        )
        self.assertTrue(result.paused)
        self.assertEqual(result.error, "503")

    def test_accessible_from_protocols_package(self):
        """SessionResult is accessible via bees.protocols."""
        from bees.protocols import SessionResult

        result = SessionResult(
            session_id="pkg-test",
            status="completed",
            events=0,
            output="",
        )
        self.assertEqual(result.session_id, "pkg-test")


if __name__ == "__main__":
    unittest.main()
