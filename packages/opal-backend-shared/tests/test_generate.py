# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for functions/generate.py.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.functions.generate import (
    get_generate_function_group,
    _define_generate_text,
    _resolve_text_model,
    GENERATE_TEXT_FUNCTION,
    DEFAULT_SYSTEM_INSTRUCTION,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status(_msg):
    """No-op status callback."""
    pass


def _make_gemini_chunks(texts: list[str]):
    """Build a list of Gemini streaming chunks from text strings."""
    return [
        {
            "candidates": [
                {"content": {"parts": [{"text": t}]}}
            ]
        }
        for t in texts
    ]


def _make_thought_chunk(text: str):
    """Build a Gemini chunk with a thought part."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": text, "thought": True}]
                }
            }
        ]
    }


async def _fake_stream(chunks):
    """Async generator that yields chunks."""
    for chunk in chunks:
        yield chunk


# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------


class TestResolveTextModel:
    def test_pro(self):
        assert _resolve_text_model("pro") == "gemini-3-pro-preview"

    def test_flash(self):
        assert _resolve_text_model("flash") == "gemini-3-flash-preview"

    def test_lite(self):
        assert _resolve_text_model("lite") == "gemini-2.5-flash-lite"

    def test_unknown_defaults_to_flash(self):
        assert _resolve_text_model("unknown") == "gemini-3-flash-preview"


# ---------------------------------------------------------------------------
# Function group
# ---------------------------------------------------------------------------


class TestGetGenerateFunctionGroup:
    def test_returns_function_group(self):
        fs = AgentFileSystem()
        group = get_generate_function_group(file_system=fs)
        assert group.instruction is not None
        assert GENERATE_TEXT_FUNCTION in group.instruction

    def test_has_generate_text_declaration(self):
        fs = AgentFileSystem()
        group = get_generate_function_group(file_system=fs)
        names = [d["name"] for d in group.declarations]
        assert GENERATE_TEXT_FUNCTION in names

    def test_has_generate_text_definition(self):
        fs = AgentFileSystem()
        group = get_generate_function_group(file_system=fs)
        defn_names = [name for name, _ in group.definitions]
        assert GENERATE_TEXT_FUNCTION in defn_names


# ---------------------------------------------------------------------------
# generate_text handler
# ---------------------------------------------------------------------------


class TestGenerateTextHandler:
    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_basic_text_generation(self, mock_stream):
        """Handler returns merged text from streaming chunks."""
        chunks = _make_gemini_chunks(["Hello", " world", "!"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        result = await defn.handler(
            {"prompt": "Say hello", "model": "flash"},
            _noop_status,
        )
        assert result == {"text": "Hello world!"}
        mock_stream.assert_called_once()

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_skips_thought_parts(self, mock_stream):
        """Thought parts are filtered out of the result."""
        chunks = [
            _make_thought_chunk("Hmm let me think..."),
            *_make_gemini_chunks(["The answer is 42"]),
        ]
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        result = await defn.handler(
            {"prompt": "What is the answer?", "model": "pro"},
            _noop_status,
        )
        assert result == {"text": "The answer is 42"}

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_empty_response_returns_error(self, mock_stream):
        """No text in response → error."""
        mock_stream.return_value = _fake_stream([])

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        result = await defn.handler(
            {"prompt": "Generate something", "model": "flash"},
            _noop_status,
        )
        assert "error" in result
        assert "No text" in result["error"]

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_search_grounding_tool(self, mock_stream):
        """Search grounding adds googleSearch tool to body."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {
                "prompt": "Search for info",
                "model": "flash",
                "search_grounding": True,
            },
            _noop_status,
        )

        # Inspect the body passed to stream_generate_content
        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1] if len(call_kwargs.args) > 1 else call_kwargs.kwargs["body"]
        assert "tools" in body
        tool_types = [list(t.keys())[0] for t in body["tools"]]
        assert "googleSearch" in tool_types

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_maps_grounding_tool(self, mock_stream):
        """Maps grounding adds googleMaps tool to body."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {
                "prompt": "Find a restaurant",
                "model": "flash",
                "maps_grounding": True,
            },
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        tool_types = [list(t.keys())[0] for t in body["tools"]]
        assert "googleMaps" in tool_types

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_url_context_tool(self, mock_stream):
        """URL context adds urlContext tool (auto-approved in dev)."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {
                "prompt": "Check this URL",
                "model": "flash",
                "url_context": True,
            },
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        tool_types = [list(t.keys())[0] for t in body["tools"]]
        assert "urlContext" in tool_types

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_no_grounding_means_no_tools(self, mock_stream):
        """No grounding flags → no tools key in body."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {"prompt": "Simple prompt", "model": "flash"},
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        assert "tools" not in body

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_pro_model_enables_thinking(self, mock_stream):
        """Pro model sets thinkingConfig in generationConfig."""
        chunks = _make_gemini_chunks(["deep result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {"prompt": "Complex problem", "model": "pro"},
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        assert "thinkingConfig" in body.get("generationConfig", {})
        assert body["generationConfig"]["thinkingConfig"]["thinkingLevel"] == "high"

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_model_resolution_in_call(self, mock_stream):
        """The resolved model name is passed to stream_generate_content."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {"prompt": "test", "model": "lite"},
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        model = call_kwargs.args[0]
        assert model == "gemini-2.5-flash-lite"

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_system_instruction_included(self, mock_stream):
        """Body includes the default system instruction."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        await defn.handler(
            {"prompt": "test", "model": "flash"},
            _noop_status,
        )

        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        assert body["systemInstruction"] == DEFAULT_SYSTEM_INSTRUCTION

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_pidgin_file_resolved(self, mock_stream):
        """File references in the prompt are resolved by from_pidgin_string."""
        chunks = _make_gemini_chunks(["Image shows a cat"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        # Add a file using the real API
        fs.add_part({
            "inlineData": {"data": "base64data", "mimeType": "image/png"}
        })
        # The auto-generated path is /mnt/image1.png

        defn = _define_generate_text(file_system=fs)

        result = await defn.handler(
            {
                "prompt": 'Describe this image <file src="/mnt/image1.png" />',
                "model": "flash",
            },
            _noop_status,
        )
        assert result == {"text": "Image shows a cat"}

        # Verify the body contains the resolved file as a data part
        call_kwargs = mock_stream.call_args
        body = call_kwargs.args[1]
        contents = body["contents"]
        assert len(contents) == 1
        parts = contents[0]["parts"]
        # Should have text part + inline data part from the resolved file
        assert len(parts) >= 2

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_streaming_error_returns_error(self, mock_stream):
        """Streaming exception is caught and returned as error."""
        async def failing_stream(*args, **kwargs):
            raise ConnectionError("Network failure")
            yield  # make it an async generator  # noqa: E115

        mock_stream.return_value = failing_stream()

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        result = await defn.handler(
            {"prompt": "test", "model": "flash"},
            _noop_status,
        )
        assert "error" in result
        assert "Network failure" in result["error"]

    @pytest.mark.asyncio
    @patch(
        "opal_backend_shared.functions.generate.stream_generate_content"
    )
    async def test_status_callback_called(self, mock_stream):
        """Status callback is called with status text and cleared at end."""
        chunks = _make_gemini_chunks(["result"])
        mock_stream.return_value = _fake_stream(chunks)

        fs = AgentFileSystem()
        defn = _define_generate_text(file_system=fs)

        statuses = []
        def track_status(msg):
            statuses.append(msg)

        await defn.handler(
            {"prompt": "test", "model": "flash"},
            track_status,
        )
        assert statuses[0] == "Generating Text"
        assert statuses[-1] is None  # cleared
