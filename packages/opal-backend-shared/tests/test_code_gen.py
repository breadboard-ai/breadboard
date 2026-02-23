# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for generate_and_execute_code from functions/generate.py.
"""

from __future__ import annotations

from typing import Any, AsyncIterator
from unittest.mock import patch, AsyncMock

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.functions.generate import (
    _define_generate_and_execute_code,
    GENERATE_AND_EXECUTE_CODE_FUNCTION,
    FLASH_MODEL_NAME,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status(_msg):
    pass


async def _make_stream(*chunks: list[dict[str, Any]]) -> AsyncIterator:
    """Create a mock async iterator yielding Gemini-style chunks."""
    for chunk_parts in chunks:
        yield {
            "candidates": [
                {
                    "content": {
                        "parts": chunk_parts,
                        "role": "model",
                    }
                }
            ]
        }


def _text_part(text: str) -> dict:
    return {"text": text}


def _thought_part(text: str) -> dict:
    return {"text": text, "thought": True}


def _inline_data_part(mime: str = "image/png", data: str = "base64img") -> dict:
    return {"inlineData": {"mimeType": mime, "data": data}}


def _code_exec_ok(output: str = "") -> dict:
    return {"codeExecutionResult": {"outcome": "OUTCOME_OK", "output": output}}


def _code_exec_error(output: str = "NameError: x") -> dict:
    return {
        "codeExecutionResult": {
            "outcome": "OUTCOME_FAILED",
            "output": output,
        }
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGenerateAndExecuteCode:
    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_basic_code_generation(self, mock_pidgin, mock_stream):
        """Handler returns result text from code execution."""
        mock_pidgin.return_value = {
            "parts": [{"text": "Calculate 2+2"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("The answer is 4"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler(
            {"prompt": "Calculate 2+2"},
            _noop_status,
        )
        assert "result" in result
        assert "4" in result["result"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_uses_code_execution_tool(self, mock_pidgin, mock_stream):
        """Body includes codeExecution tool."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("done"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        await defn.handler({"prompt": "test"}, _noop_status)

        call_args = mock_stream.call_args
        body = call_args.args[1]
        tools = body.get("tools", [])
        tool_types = [list(t.keys())[0] for t in tools]
        assert "codeExecution" in tool_types

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_search_grounding(self, mock_pidgin, mock_stream):
        """search_grounding adds googleSearch tool."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("result"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        await defn.handler(
            {"prompt": "test", "search_grounding": True},
            _noop_status,
        )

        call_args = mock_stream.call_args
        body = call_args.args[1]
        tools = body.get("tools", [])
        tool_types = [list(t.keys())[0] for t in tools]
        assert "googleSearch" in tool_types
        assert "codeExecution" in tool_types

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_model_is_flash(self, mock_pidgin, mock_stream):
        """Uses FLASH_MODEL_NAME."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("done"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        await defn.handler({"prompt": "test"}, _noop_status)

        call_args = mock_stream.call_args
        assert call_args.args[0] == FLASH_MODEL_NAME

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_thought_parts_sent_to_status(self, mock_pidgin, mock_stream):
        """Thought parts are passed to status callback, not result."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_thought_part("Thinking..."), _text_part("Result"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        statuses = []
        result = await defn.handler({"prompt": "test"}, statuses.append)

        assert "result" in result
        assert "Result" in result["result"]
        assert "Thinking..." in statuses
        assert "Thinking..." not in result["result"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_inline_data_saved_to_fs(self, mock_pidgin, mock_stream):
        """inlineData parts are saved to FS and appear as <file> tags."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_inline_data_part(), _text_part("Done"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)

        assert "result" in result
        assert "<file" in result["result"]
        assert "/mnt/" in result["result"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_inline_data_error(self, mock_pidgin, mock_stream):
        """add_part error on inlineData → error returned."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_inline_data_part(), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        fs.add_part = lambda part, name=None: {"$error": "FS full"}

        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)
        assert "error" in result
        assert "invalid file output" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_code_execution_error(self, mock_pidgin, mock_stream):
        """Last code execution failure → error returned."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("Trying..."), _code_exec_error("NameError: x")]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)
        assert "error" in result
        assert "NameError: x" in result["error"]
        assert "tried and failed" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_code_error_then_success(self, mock_pidgin, mock_stream):
        """Error followed by success → no error returned."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_code_exec_error("NameError")],
            [_text_part("Fixed!"), _code_exec_ok()],
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)
        assert "result" in result
        assert "Fixed!" in result["result"]
        assert "error" not in result

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_empty_stream(self, mock_pidgin, mock_stream):
        """Empty stream → error."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }

        async def empty_stream(*a, **kw):
            return
            yield  # noqa: make it an async generator

        mock_stream.return_value = empty_stream()

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)
        assert "error" in result
        assert "No text" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_streaming_error(self, mock_pidgin, mock_stream):
        """Stream raises → error returned."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }

        async def error_stream(*a, **kw):
            raise ValueError("Connection lost")
            yield  # noqa

        mock_stream.return_value = error_stream()

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        result = await defn.handler({"prompt": "test"}, _noop_status)
        assert "error" in result
        assert "Connection lost" in result["error"]

    @pytest.mark.asyncio
    async def test_pidgin_error(self):
        """Pidgin translation error → error returned."""
        fs = AgentFileSystem()

        with patch(
            "opal_backend_shared.functions.generate.from_pidgin_string"
        ) as mock_pidgin:
            mock_pidgin.return_value = {"$error": "File not found"}
            defn = _define_generate_and_execute_code(file_system=fs)
            result = await defn.handler({"prompt": "test"}, _noop_status)
            assert "error" in result
            assert "File not found" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_status_callback_lifecycle(self, mock_pidgin, mock_stream):
        """Status callback: initial status → cleared at end."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("done"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        statuses = []
        await defn.handler({"prompt": "test"}, statuses.append)
        assert statuses[0] == "Generating Code"
        assert statuses[-1] is None

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.generate.stream_generate_content")
    @patch("opal_backend_shared.functions.generate.from_pidgin_string")
    async def test_status_with_search_grounding(self, mock_pidgin, mock_stream):
        """search_grounding → status starts with 'Researching'."""
        mock_pidgin.return_value = {
            "parts": [{"text": "test"}],
            "role": "user",
        }
        mock_stream.return_value = _make_stream(
            [_text_part("done"), _code_exec_ok()]
        )

        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)

        statuses = []
        await defn.handler(
            {"prompt": "test", "search_grounding": True},
            statuses.append,
        )
        assert statuses[0] == "Researching"

    def test_function_name(self):
        """Function definition has correct name."""
        fs = AgentFileSystem()
        defn = _define_generate_and_execute_code(file_system=fs)
        assert defn.name == GENERATE_AND_EXECUTE_CODE_FUNCTION

    def test_function_group_includes_code(self):
        """get_generate_function_group includes code gen function."""
        from opal_backend_shared.functions.generate import (
            get_generate_function_group,
        )

        fs = AgentFileSystem()
        group = get_generate_function_group(file_system=fs)
        defn_names = [name for name, _ in group.definitions]
        assert GENERATE_AND_EXECUTE_CODE_FUNCTION in defn_names

        decl_names = [d["name"] for d in group.declarations]
        assert GENERATE_AND_EXECUTE_CODE_FUNCTION in decl_names
