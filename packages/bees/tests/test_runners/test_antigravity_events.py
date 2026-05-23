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





# ---------------------------------------------------------------------------
# System instruction assembly tests
# ---------------------------------------------------------------------------


class TestAntigravitySystemInstructions:
    """Tests for ``_assemble_system_instructions``."""

    def test_assemble_system_instructions(self) -> None:
        from bees.runners.antigravity import (
            _assemble_system_instructions,
            AGENT_IDENTITY,
        )

        custom = ["custom note 1", "custom note 2"]
        templated = _assemble_system_instructions(custom)

        assert templated.identity == AGENT_IDENTITY
        assert len(templated.sections) == 2
        assert templated.sections[0].content == "custom note 1"
        assert templated.sections[0].title == "tools_0"
        assert templated.sections[1].content == "custom note 2"
        assert templated.sections[1].title == "tools_1"


class TestAntigravityBuildCompleteResult:
    """Tests for ``_build_complete_result``."""

    def test_build_complete_result_basic(self) -> None:
        from bees.runners.antigravity import _build_complete_result
        import asyncio

        async def run_test():
            step = ag_types.Step(
                id="step-1",
                step_index=0,
                type=ag_types.StepType.FINISH,
                status=ag_types.StepStatus.DONE,
                source=ag_types.StepSource.MODEL,
                target=ag_types.StepTarget.USER,
                content="Finished normally",
            )
            res = await _build_complete_result(step)
            assert res["success"] is True
            assert res["outcomes"] == {"parts": [{"text": "Finished normally"}]}

        asyncio.run(run_test())

    def test_build_complete_result_structured(self) -> None:
        from bees.runners.antigravity import _build_complete_result
        import asyncio

        async def run_test():
            step = ag_types.Step(
                id="step-1",
                step_index=0,
                type=ag_types.StepType.FINISH,
                status=ag_types.StepStatus.DONE,
                source=ag_types.StepSource.MODEL,
                target=ag_types.StepTarget.USER,
                structured_output={"objective_outcome": "The task was successfully completed!"},
            )
            res = await _build_complete_result(step)
            assert res["success"] is True
            assert res["outcomes"] == {"parts": [{"text": "The task was successfully completed!"}]}
            assert res["structured_output"] == {"objective_outcome": "The task was successfully completed!"}

        asyncio.run(run_test())

    def test_build_complete_result_pidgin_and_intermediate(self) -> None:
        from bees.runners.antigravity import _build_complete_result
        from bees.disk_file_system import DiskFileSystem
        import asyncio
        import tempfile
        from pathlib import Path

        async def run_test():
            with tempfile.TemporaryDirectory() as tmpdir:
                fs = DiskFileSystem(Path(tmpdir))
                fs.write("result.txt", "Some important output data")

                step = ag_types.Step(
                    id="step-1",
                    step_index=0,
                    type=ag_types.StepType.FINISH,
                    status=ag_types.StepStatus.DONE,
                    source=ag_types.StepSource.MODEL,
                    target=ag_types.StepTarget.USER,
                    structured_output={"objective_outcome": "See <file src=\"result.txt\" /> for the output."},
                )
                res = await _build_complete_result(step, file_system=fs)
                assert res["success"] is True
                # outcome_text is resolved via pidgin
                assert res["outcomes"]["parts"] == [
                    {"text": "See \nSome important output data\n for the output."}
                ]
                # intermediate files are collected
                assert len(res["intermediate"]) == 1
                assert res["intermediate"][0]["path"] == "result.txt"
                assert res["intermediate"][0]["content"]["parts"] == [{"text": "Some important output data"}]

        asyncio.run(run_test())


