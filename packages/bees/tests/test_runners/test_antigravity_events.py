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
        custom_si = _assemble_system_instructions(custom)

        assert isinstance(custom_si, ag_types.CustomSystemInstructions)
        assert "<identity>" in custom_si.text
        assert AGENT_IDENTITY in custom_si.text
        assert "custom note 1" in custom_si.text
        assert "custom note 2" in custom_si.text

    def test_assemble_system_instructions_with_files(self) -> None:
        from bees.runners.antigravity import (
            _assemble_system_instructions,
            FILES_INSTRUCTION_ANTIGRAVITY,
        )

        custom = ["custom note 1"]
        custom_si = _assemble_system_instructions(custom, has_files=True)

        assert isinstance(custom_si, ag_types.CustomSystemInstructions)
        assert FILES_INSTRUCTION_ANTIGRAVITY.strip() in custom_si.text
        # Ensure it has been specialized for Antigravity:
        assert "Use the <file> tag to present the files to the user" in custom_si.text
        assert "files_list_files" not in custom_si.text

    def test_assemble_system_instructions_without_files(self) -> None:
        from bees.runners.antigravity import (
            _assemble_system_instructions,
            FILES_INSTRUCTION_ANTIGRAVITY,
        )

        custom = ["custom note 1"]
        custom_si = _assemble_system_instructions(custom, has_files=False)

        assert isinstance(custom_si, ag_types.CustomSystemInstructions)
        assert FILES_INSTRUCTION_ANTIGRAVITY.strip() not in custom_si.text


class TestAntigravityExtractInitialPrompt:
    """Tests for ``_extract_initial_prompt``."""

    def test_extract_initial_prompt_basic(self) -> None:
        from pathlib import Path
        from bees.runners.antigravity import _extract_initial_prompt
        from bees.protocols.session import SessionConfiguration
        from bees.disk_file_system import DiskFileSystem

        config = SessionConfiguration(
            segments=[{"text": "My Objective"}],
            function_groups=[],
            function_filter=["agents.*"],
            model="gemini-2.5-flash",
            file_system=DiskFileSystem(Path("/tmp")),
        )

        prompt = _extract_initial_prompt(config)
        assert "<metadata>" in prompt
        assert "<current_date>" in prompt
        assert "<working_directory>/tmp</working_directory>" in prompt
        assert "<objective>My Objective</objective>" in prompt
        assert "<sandbox_environment>" not in prompt

    def test_extract_initial_prompt_sandbox(self, tmp_path: Path) -> None:
        from pathlib import Path
        from bees.runners.antigravity import _extract_initial_prompt
        from bees.protocols.session import SessionConfiguration
        from bees.disk_file_system import DiskFileSystem
        import json

        # Write metadata.json with a slug
        metadata = {"slug": "sub/agent/slug"}
        (tmp_path / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")

        config = SessionConfiguration(
            segments=[{"text": "My Subagent Objective"}],
            function_groups=[],
            function_filter=["files.*"],
            model="gemini-2.5-flash",
            file_system=DiskFileSystem(tmp_path),
            ticket_dir=tmp_path,
        )

        prompt = _extract_initial_prompt(config)
        assert "<metadata>" in prompt
        assert f"<working_directory>{tmp_path.resolve()}</working_directory>" in prompt
        assert "<objective>" in prompt
        assert "My Subagent Objective" in prompt
        assert "<sandbox_environment>" in prompt
        assert "subdirectory: ./sub/agent/slug" in prompt

    def test_extract_initial_prompt_root_with_files(self) -> None:
        from pathlib import Path
        from bees.runners.antigravity import _extract_initial_prompt
        from bees.protocols.session import SessionConfiguration
        from bees.disk_file_system import DiskFileSystem

        config = SessionConfiguration(
            segments=[{"text": "My Root Objective"}],
            function_groups=[],
            function_filter=["files.*"],
            model="gemini-2.5-flash",
            file_system=DiskFileSystem(Path("/tmp")),
        )

        prompt = _extract_initial_prompt(config)
        assert "<metadata>" in prompt
        assert "<working_directory>/tmp</working_directory>" in prompt
        assert "<objective>" in prompt
        assert "My Root Objective" in prompt
        assert "<sandbox_environment>" in prompt
        assert "Your current working directory is the root of the workspace." in prompt
        assert "You can read files from anywhere in the workspace." in prompt
        assert "assigned to work in the subdirectory" not in prompt


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


class TestAntigravityStreamTaskStateAwareness:
    """Tests for AntigravityStream task state awareness."""

    def test_antigravity_stream_awaits_active_tasks(self, tmp_path) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch
        from bees.runners.antigravity import AntigravityStream
        import asyncio

        async def run_test():
            # Mock the SDK Agent and its conversation step iterator
            mock_agent = MagicMock()
            mock_agent.conversation_id = "test-conversation-id"
            mock_conversation = MagicMock()
            mock_conversation.send = AsyncMock()
            mock_agent.conversation = mock_conversation
            
            # Step iterator yields nothing, triggering StopAsyncIteration immediately
            async def mock_receive_steps():
                if False:
                    yield None
            mock_conversation.receive_steps.return_value = mock_receive_steps()
            
            # Create a mock UnifiedAgentStore and set has_pending_tasks to True
            mock_store = MagicMock()
            mock_store.has_pending_tasks.return_value = True
            
            # Set up a ticket_dir structure: tmp_path / "agents" / "parent-id"
            agents_dir = tmp_path / "agents"
            agents_dir.mkdir(parents=True, exist_ok=True)
            ticket_dir = agents_dir / "parent-id"
            ticket_dir.mkdir(exist_ok=True)
            
            with patch("bees.unified_agent_store.UnifiedAgentStore", return_value=mock_store):
                stream = AntigravityStream(
                    agent=mock_agent,
                    exit_stack=AsyncMock(),
                    save_dir=str(ticket_dir),
                    initial_prompt="hello",
                    ticket_dir=ticket_dir,
                )
                
                # Step 1: Initial sendRequest
                event1 = await stream.__anext__()
                assert "sendRequest" in event1
                
                # Step 2: The model goes idle, but since tasks are active,
                # stream should yield waitForInput instead of complete!
                event2 = await stream.__anext__()
                assert "waitForInput" in event2

        asyncio.run(run_test())

    def test_antigravity_stream_completes_when_no_active_tasks(self, tmp_path) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch
        from bees.runners.antigravity import AntigravityStream
        import asyncio

        async def run_test():
            mock_agent = MagicMock()
            mock_agent.conversation_id = "test-conversation-id"
            mock_conversation = MagicMock()
            mock_conversation.send = AsyncMock()
            mock_agent.conversation = mock_conversation
            
            async def mock_receive_steps():
                if False:
                    yield None
            mock_conversation.receive_steps.return_value = mock_receive_steps()
            
            # Create a mock UnifiedAgentStore and set has_pending_tasks to False
            mock_store = MagicMock()
            mock_store.has_pending_tasks.return_value = False
            
            agents_dir = tmp_path / "agents"
            agents_dir.mkdir(parents=True, exist_ok=True)
            ticket_dir = agents_dir / "parent-id"
            ticket_dir.mkdir(exist_ok=True)
            
            with patch("bees.unified_agent_store.UnifiedAgentStore", return_value=mock_store):
                stream = AntigravityStream(
                    agent=mock_agent,
                    exit_stack=AsyncMock(),
                    save_dir=str(ticket_dir),
                    initial_prompt="hello",
                    ticket_dir=ticket_dir,
                )
                
                event1 = await stream.__anext__()
                assert "sendRequest" in event1
                
                # Since no tasks are active, should complete!
                event2 = await stream.__anext__()
                assert "complete" in event2

        asyncio.run(run_test())

    def test_antigravity_stream_awaits_queued_tasks(self, tmp_path) -> None:
        from unittest.mock import AsyncMock, MagicMock, patch
        from bees.runners.antigravity import AntigravityStream
        import asyncio

        async def run_test():
            mock_agent = MagicMock()
            mock_agent.conversation_id = "test-conversation-id"
            mock_conversation = MagicMock()
            mock_conversation.send = AsyncMock()
            mock_agent.conversation = mock_conversation
            
            async def mock_receive_steps():
                if False:
                    yield None
            mock_conversation.receive_steps.return_value = mock_receive_steps()
            
            # Create a mock UnifiedAgentStore and set has_pending_tasks to True
            mock_store = MagicMock()
            mock_store.has_pending_tasks.return_value = True
            
            agents_dir = tmp_path / "agents"
            agents_dir.mkdir(parents=True, exist_ok=True)
            ticket_dir = agents_dir / "parent-id"
            ticket_dir.mkdir(exist_ok=True)
            
            with patch("bees.unified_agent_store.UnifiedAgentStore", return_value=mock_store):
                stream = AntigravityStream(
                    agent=mock_agent,
                    exit_stack=AsyncMock(),
                    save_dir=str(ticket_dir),
                    initial_prompt="hello",
                    ticket_dir=ticket_dir,
                )
                
                event1 = await stream.__anext__()
                assert "sendRequest" in event1
                
                event2 = await stream.__anext__()
                assert "waitForInput" in event2

        asyncio.run(run_test())


class TestAntigravityStreamStepIndexAdjustment:
    """Tests for AntigravityStream step index correction for custom client-side tools."""

    def test_antigravity_stream_adjusts_custom_tool_call_step_index(self) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from bees.runners.antigravity import AntigravityStream
        import asyncio

        async def run_test():
            mock_agent = MagicMock()
            mock_agent.conversation_id = "test-conversation-id"
            mock_conversation = MagicMock()
            mock_conversation.send = AsyncMock()
            mock_agent.conversation = mock_conversation

            # We mock a sequence of steps yielded by receive_steps()
            # In Turn 2, let's say the harness replays:
            # - Step 0 (type = FINISH, index = 0)
            # - Step 9 (type = FINISH, index = 9, i.e. the last step of the previous turn)
            # Then the new steps in Turn 2:
            # - Step 1 (type = TOOL_CALL, index = 1) -> This is the new custom tool call!
            # - Step 10 (type = FINISH, status = DONE, index = 10)
            steps = [
                ag_types.Step(
                    id="step-0",
                    step_index=0,
                    type=ag_types.StepType.FINISH,
                    status=ag_types.StepStatus.DONE,
                    source=ag_types.StepSource.MODEL,
                    target=ag_types.StepTarget.USER,
                ),
                ag_types.Step(
                    id="step-9",
                    step_index=9,
                    type=ag_types.StepType.FINISH,
                    status=ag_types.StepStatus.DONE,
                    source=ag_types.StepSource.MODEL,
                    target=ag_types.StepTarget.USER,
                ),
                ag_types.Step(
                    id="custom-tool-call",
                    step_index=1,
                    type=ag_types.StepType.TOOL_CALL,
                    status=ag_types.StepStatus.ACTIVE,
                    source=ag_types.StepSource.MODEL,
                    target=ag_types.StepTarget.ENVIRONMENT,
                    tool_calls=[ag_types.ToolCall(id="tc-0", name="custom_tool", args={})],
                ),
                ag_types.Step(
                    id="finish-step",
                    step_index=10,
                    type=ag_types.StepType.FINISH,
                    status=ag_types.StepStatus.DONE,
                    source=ag_types.StepSource.MODEL,
                    target=ag_types.StepTarget.USER,
                    content="done",
                ),
            ]

            async def mock_receive_steps():
                for s in steps:
                    yield s

            mock_conversation.receive_steps.return_value = mock_receive_steps()

            stream = AntigravityStream(
                agent=mock_agent,
                exit_stack=AsyncMock(),
                save_dir="/tmp",
                initial_prompt="hello",
                resume_after_step=9,  # Skip steps <= 9
            )

            # Step 1: Initial sendRequest
            event1 = await stream.__anext__()
            assert "sendRequest" in event1

            # Step 2: The custom tool call step (index 1) should NOT be skipped
            # because its index is adjusted to self._last_step_index + 1 = 10,
            # which is > 9!
            event2 = await stream.__anext__()
            assert "functionCall" in event2
            assert event2["functionCall"]["name"] == "custom_tool"

            # Step 3: The finish step (index 10) should be processed
            event3 = await stream.__anext__()
            assert "complete" in event3

        asyncio.run(run_test())



