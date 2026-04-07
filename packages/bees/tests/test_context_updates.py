# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the context_updates formatting module."""

from __future__ import annotations

import json
import pytest
from bees.context_updates import (
    CONTEXT_UPDATE_TAG,
    format_context_update_part,
    format_task_completed,
    format_raw_update,
    updates_to_context_parts,
)


class TestFormatContextUpdatePart:
    """Tests for the text part wrapper."""

    def test_wraps_text_in_tags(self):
        part = format_context_update_part("hello world")
        assert part == {"text": "<context_update>hello world</context_update>"}

    def test_preserves_special_characters(self):
        part = format_context_update_part('task "foo" completed & done')
        assert "<context_update>" in part["text"]
        assert 'task "foo" completed & done' in part["text"]


class TestFormatTaskCompleted:
    """Tests for the task completion formatter."""

    def test_short_id(self):
        result = format_task_completed("abc12345-long-uuid", "all tests passed")
        assert result == "Task abc12345 completed: all tests passed"

    def test_short_id_already(self):
        result = format_task_completed("abc", "done")
        assert result == "Task abc completed: done"


class TestFormatRawUpdate:
    """Tests for the raw update normalizer."""

    def test_string_passthrough(self):
        result = format_raw_update("already a string")
        assert result == "already a string"

    def test_task_dict(self):
        result = format_raw_update({"task_id": "sub-1234-5678", "outcome": "done"})
        assert "sub-1234" in result
        assert "done" in result

    def test_other_dict_json_serialized(self):
        result = format_raw_update({"key": "value"})
        parsed = json.loads(result)
        assert parsed == {"key": "value"}

    def test_non_string_non_dict(self):
        result = format_raw_update(42)
        assert result == "42"


class TestUpdatesToContextParts:
    """Tests for the full pipeline."""

    def test_empty_list(self):
        assert updates_to_context_parts([]) == []

    def test_mixed_updates(self):
        updates = [
            "plain text update",
            {"task_id": "sub-1", "outcome": "done"},
        ]
        parts = updates_to_context_parts(updates)
        assert len(parts) == 2

        # First: plain string
        assert f"<{CONTEXT_UPDATE_TAG}>" in parts[0]["text"]
        assert "plain text update" in parts[0]["text"]

        # Second: task completion
        assert "sub-1" in parts[1]["text"]
        assert "done" in parts[1]["text"]
