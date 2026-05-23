# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for antigravity event translation helpers.

Covers ``_tool_result_to_event`` — specifically the Pydantic model
serialization that caused the SearchDirectoryResult crash.
"""

from __future__ import annotations

import json
from typing import Any

import pydantic
import pytest

from google.antigravity import types as ag_types

from bees.runners.antigravity import _tool_result_to_event


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeResult(pydantic.BaseModel):
    """Simulates an SDK builtin tool result (Pydantic BaseModel)."""

    count: int = 0
    message: str = "ok"


# ---------------------------------------------------------------------------
# _tool_result_to_event
# ---------------------------------------------------------------------------


class TestToolResultToEvent:
    """Tests for ``_tool_result_to_event``."""

    def test_pydantic_model_is_serializable(self) -> None:
        """Pydantic BaseModel results are converted to JSON-safe dicts."""
        result = ag_types.ToolResult(
            name="search_directory",
            result=_FakeResult(count=3, message="found"),
        )
        event = _tool_result_to_event(result)

        # Must not raise — this is the exact codepath that crashed.
        serialized = json.dumps(event, ensure_ascii=False)
        parsed = json.loads(serialized)

        assert parsed["functionResponse"]["name"] == "search_directory"
        assert parsed["functionResponse"]["response"] == {
            "count": 3,
            "message": "found",
        }

    def test_pydantic_model_via_builtin_enum(self) -> None:
        """BuiltinTools enum names are converted to strings."""
        result = ag_types.ToolResult(
            name=ag_types.BuiltinTools.SEARCH_DIR,
            result=_FakeResult(count=0),
        )
        event = _tool_result_to_event(result)
        serialized = json.dumps(event)

        parsed = json.loads(serialized)
        assert parsed["functionResponse"]["name"] == ag_types.BuiltinTools.SEARCH_DIR.value

    def test_dict_result_passes_through(self) -> None:
        """Plain dict results are used as-is."""
        result = ag_types.ToolResult(
            name="my_tool",
            result={"status": "ok", "data": [1, 2, 3]},
        )
        event = _tool_result_to_event(result)
        assert event["functionResponse"]["response"] == {
            "status": "ok",
            "data": [1, 2, 3],
        }

    def test_none_result_becomes_empty_dict(self) -> None:
        """None results are normalized to empty dicts."""
        result = ag_types.ToolResult(name="my_tool", result=None)
        event = _tool_result_to_event(result)
        assert event["functionResponse"]["response"] == {}

    def test_error_result_overrides_value(self) -> None:
        """When error is set, response becomes the error dict."""
        result = ag_types.ToolResult(
            name="my_tool",
            result=_FakeResult(count=1),
            error="Something went wrong",
        )
        event = _tool_result_to_event(result)
        assert event["functionResponse"]["response"] == {
            "error": "Something went wrong",
        }

    def test_scalar_result_wrapped(self) -> None:
        """Scalar values are wrapped in a dict."""
        result = ag_types.ToolResult(name="my_tool", result=42)
        event = _tool_result_to_event(result)
        assert event["functionResponse"]["response"] == {"result": 42}

    def test_list_result_wrapped(self) -> None:
        """List values are wrapped in a dict."""
        result = ag_types.ToolResult(name="my_tool", result=["a", "b"])
        event = _tool_result_to_event(result)
        assert event["functionResponse"]["response"] == {
            "result": ["a", "b"],
        }
