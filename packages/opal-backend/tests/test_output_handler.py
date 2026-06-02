# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the output handler logic."""

from __future__ import annotations

import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from opal_backend.node_handlers import (
    NodeHandlerDeps,
    output_handler,
)
# Private helpers under test.
from opal_backend.node_handlers import (
    _build_webpage_request_body,
    _get_input_parts,
    _html_auto_layout_handler,
    _manual_output_handler,
    _parse_stored_data_url,
    _passthrough,
    _substitute_template_parts,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_deps(
    stream_chunks: list[dict] | None = None,
    assets: dict | None = None,
) -> NodeHandlerDeps:
    """Build NodeHandlerDeps with a mocked backend for webpage generation."""
    backend = MagicMock()

    if stream_chunks is not None:
        async def _mock_stream(*args, **kwargs):
            for chunk in stream_chunks:
                yield chunk
        backend.stream_generate_webpage = _mock_stream
    else:
        backend.stream_generate_webpage = AsyncMock()

    return NodeHandlerDeps(
        on_agent_event=AsyncMock(),
        on_thought_event=AsyncMock(),
        run_agent_fn=None,
        backend=backend,
        interaction_store=None,
        assets=assets,
    )


# ---------------------------------------------------------------------------
# _parse_stored_data_url
# ---------------------------------------------------------------------------

class TestParseStoredDataUrl:
    """Test URL parsing for stored data handles."""

    def test_drive_prefix(self):
        """drive:/ prefix → drive:// format."""
        result = _parse_stored_data_url("drive:/abc123")
        assert result == "drive://abc123"

    def test_drive_prefix_multiple_slashes(self):
        """drive:/// prefix → drive:// format (extra slashes stripped)."""
        result = _parse_stored_data_url("drive:///abc123")
        assert result == "drive://abc123"

    def test_google_drive_file_url(self):
        """Google Drive file URL → drive:// format."""
        url = "https://drive.google.com/file/d/FILE_ID_123/view"
        result = _parse_stored_data_url(url)
        assert result == "drive://FILE_ID_123"

    def test_blob_url(self):
        """Blob URL → gs:// format."""
        url = "https://example.com/board/blobs/blob-id-456"
        result = _parse_stored_data_url(url)
        assert result == "gs://blob-id-456"

    def test_unknown_url_passthrough(self):
        """Unknown URL → returned unchanged."""
        url = "https://example.com/other/path"
        result = _parse_stored_data_url(url)
        assert result == url


# ---------------------------------------------------------------------------
# _build_webpage_request_body
# ---------------------------------------------------------------------------

class TestBuildWebpageRequestBody:
    """Test request body construction for generateWebpageStream."""

    def test_text_parts_get_metadata(self):
        """Text parts get partMetadata with input_name: 'text_N'."""
        content = [
            {"role": "user", "parts": [{"text": "Hello"}]},
            {"role": "user", "parts": [{"text": "World"}]},
        ]
        body = _build_webpage_request_body(content, "instruction")
        contents = body["contents"]
        assert len(contents) == 2
        assert contents[0]["parts"][0]["text"] == "Hello"
        assert contents[0]["parts"][0]["partMetadata"] == {"input_name": "text_1"}
        assert contents[1]["parts"][0]["text"] == "World"
        assert contents[1]["parts"][0]["partMetadata"] == {"input_name": "text_2"}

    def test_inline_data_parts_get_metadata(self):
        """InlineData parts get partMetadata with input_name: 'media_N'."""
        content = [{
            "role": "user",
            "parts": [{"inlineData": {"mimeType": "image/png", "data": "abc"}}],
        }]
        body = _build_webpage_request_body(content, "")
        contents = body["contents"]
        assert len(contents) == 1
        part = contents[0]["parts"][0]
        assert "inlineData" in part
        assert part["inlineData"]["mimeType"] == "image/png"
        assert part["partMetadata"] == {"input_name": "media_1"}

    def test_stored_data_converted_to_file_data(self):
        """StoredData parts are converted to fileData with media_N metadata."""
        content = [{
            "role": "user",
            "parts": [{
                "storedData": {
                    "handle": "drive:/file123",
                    "mimeType": "image/jpeg",
                },
            }],
        }]
        body = _build_webpage_request_body(content, "")
        contents = body["contents"]
        assert len(contents) == 1
        part = contents[0]["parts"][0]
        assert "fileData" in part
        assert part["fileData"]["mimeType"] == "image/jpeg"
        assert part["fileData"]["fileUri"] == "drive://file123"
        assert part["partMetadata"] == {"input_name": "media_1"}

    def test_empty_content(self):
        """Empty content → empty contents list."""
        body = _build_webpage_request_body([], "instruction")
        assert body["contents"] == []
        assert body["intent"] == ""
        assert body["userInstruction"] == "instruction"

    def test_mixed_content(self):
        """Mixed text and media content — counts are independent."""
        content = [
            {"role": "user", "parts": [{"text": "Describe this"}]},
            {"role": "user", "parts": [
                {"inlineData": {"mimeType": "image/png", "data": "img"}},
            ]},
            {"role": "user", "parts": [{"text": "And this"}]},
        ]
        body = _build_webpage_request_body(content, "sys")
        contents = body["contents"]
        assert len(contents) == 3
        assert contents[0]["parts"][0]["partMetadata"] == {"input_name": "text_1"}
        assert contents[1]["parts"][0]["partMetadata"] == {"input_name": "media_1"}
        assert contents[2]["parts"][0]["partMetadata"] == {"input_name": "text_2"}
        assert body["userInstruction"] == "sys"


# ---------------------------------------------------------------------------
# _passthrough
# ---------------------------------------------------------------------------

class TestPassthrough:
    """Test simple passthrough behavior."""

    def test_single_input_unwrapped(self):
        """Single input value is unwrapped from its list."""
        result = _passthrough({"context": ["hello"]})
        assert result == {"context": "hello"}

    def test_multiple_inputs_stay_as_list(self):
        """Multiple input values stay as a list."""
        result = _passthrough({"context": ["a", "b"]})
        assert result == {"context": ["a", "b"]}

    def test_multiple_ports(self):
        """Multiple ports each get unwrapped independently."""
        result = _passthrough({
            "text": ["hello"],
            "image": ["img1", "img2"],
        })
        assert result == {"text": "hello", "image": ["img1", "img2"]}


# ---------------------------------------------------------------------------
# _manual_output_handler
# ---------------------------------------------------------------------------

class TestManualOutputHandler:
    """Test manual output mode — template substitution + passthrough."""

    def test_with_text_config_calls_substitute(self):
        """Text in config triggers template substitution and returns context."""
        inputs: dict = {}
        config = {"text": "Hello world"}
        result = _manual_output_handler(inputs, config)
        assert "context" in result
        # Simple text should pass through substitution unchanged.
        assert result["context"] == "Hello world"

    def test_without_text_config_falls_through(self):
        """No 'text' in config → falls through to _passthrough."""
        inputs = {"image": ["img_data"]}
        config: dict = {}
        result = _manual_output_handler(inputs, config)
        # _passthrough unwraps single values.
        assert result == {"image": "img_data"}

    def test_with_llm_content_text_config(self):
        """LLMContent dict in config with text parts is extracted."""
        inputs: dict = {}
        config = {
            "text": {"role": "user", "parts": [{"text": "extracted text"}]},
        }
        result = _manual_output_handler(inputs, config)
        assert result["context"] == "extracted text"


# ---------------------------------------------------------------------------
# output_handler — mode dispatch
# ---------------------------------------------------------------------------

class TestOutputHandlerDispatch:
    """Test that output_handler dispatches to the correct sub-handler."""

    @pytest.mark.asyncio
    async def test_default_mode_uses_manual(self):
        """Missing mode defaults to manual handler."""
        inputs: dict = {}
        config = {"text": "default output"}
        result = await output_handler(inputs, config)
        assert result["context"] == "default output"

    @pytest.mark.asyncio
    async def test_manual_layout_mode(self):
        """'Manual layout' mode → manual handler."""
        inputs: dict = {}
        config = {"p-render-mode": "Manual layout", "text": "manual"}
        result = await output_handler(inputs, config)
        assert result["context"] == "manual"

    @pytest.mark.asyncio
    async def test_auto_mode_dispatches_to_html(self):
        """'Auto' mode → HTML handler (falls back to manual without backend)."""
        inputs: dict = {}
        config = {"p-render-mode": "Auto", "text": "auto output"}
        # No deps/backend → html handler falls back to manual.
        result = await output_handler(inputs, config, deps=None)
        assert result["context"] == "auto output"

    @pytest.mark.asyncio
    async def test_consistent_ui_mode_dispatches_to_html(self):
        """'consistent-ui' mode → HTML handler."""
        inputs: dict = {}
        config = {"p-render-mode": "consistent-ui", "text": "consistent"}
        result = await output_handler(inputs, config, deps=None)
        assert result["context"] == "consistent"

    @pytest.mark.asyncio
    async def test_google_doc_mode_uses_manual(self):
        """'google-doc' mode → manual handler (TODO stub)."""
        inputs: dict = {}
        config = {"p-render-mode": "google-doc", "text": "doc output"}
        result = await output_handler(inputs, config)
        assert result["context"] == "doc output"


# ---------------------------------------------------------------------------
# _html_auto_layout_handler
# ---------------------------------------------------------------------------

class TestHtmlAutoLayoutHandler:
    """Test HTML auto-layout via generateWebpageStream."""

    @pytest.mark.asyncio
    async def test_happy_path(self):
        """Stream with thought + html → base64-encoded HTML output."""
        thought_text = "Planning layout..."
        html_text = "<html><body>Hello</body></html>"
        chunks = [
            {"parts": [
                {"text": thought_text,
                 "partMetadata": {"chunk_type": "thought"}},
            ]},
            {"parts": [
                {"text": html_text,
                 "partMetadata": {"chunk_type": "html"}},
            ]},
        ]
        deps = _make_deps(stream_chunks=chunks)
        inputs: dict = {}
        config = {"text": "Some content"}

        result = await _html_auto_layout_handler(inputs, config, deps)

        # on_thought_event called with thought text.
        deps.on_thought_event.assert_called_once_with(thought_text)

        # Result is base64-encoded HTML as inlineData.
        context = result["context"]
        assert len(context) == 1
        part = context[0]["parts"][0]
        assert part["inlineData"]["mimeType"] == "text/html"
        decoded = base64.b64decode(part["inlineData"]["data"]).decode()
        assert decoded == html_text

    @pytest.mark.asyncio
    async def test_error_chunk_raises(self):
        """Error chunk raises ValueError."""
        chunks = [
            {"parts": [
                {"text": "Something went wrong",
                 "partMetadata": {"chunk_type": "error"}},
            ]},
        ]
        deps = _make_deps(stream_chunks=chunks)
        inputs: dict = {}
        config = {"text": "content"}

        with pytest.raises(ValueError, match="Something went wrong"):
            await _html_auto_layout_handler(inputs, config, deps)

    @pytest.mark.asyncio
    async def test_no_html_result_falls_back_to_manual(self):
        """No html result → falls back to manual handler."""
        # Stream with only a thought, no html chunk.
        chunks = [
            {"parts": [
                {"text": "thinking...",
                 "partMetadata": {"chunk_type": "thought"}},
            ]},
        ]
        deps = _make_deps(stream_chunks=chunks)
        inputs: dict = {}
        config = {"text": "fallback text"}

        result = await _html_auto_layout_handler(inputs, config, deps)

        # Should fall back to manual → returns substituted text.
        assert result["context"] == "fallback text"

    @pytest.mark.asyncio
    async def test_no_backend_falls_back_to_manual(self):
        """No backend → falls back to manual handler."""
        deps = NodeHandlerDeps(
            on_agent_event=AsyncMock(),
            run_agent_fn=None,
            backend=None,
            interaction_store=None,
        )
        inputs: dict = {}
        config = {"text": "no backend text"}

        result = await _html_auto_layout_handler(inputs, config, deps)
        assert result["context"] == "no backend text"

    @pytest.mark.asyncio
    async def test_no_text_config_falls_back_to_manual(self):
        """No text in config → falls back to manual handler (passthrough)."""
        deps = _make_deps(stream_chunks=[])
        inputs = {"image": ["img_data"]}
        config: dict = {}

        result = await _html_auto_layout_handler(inputs, config, deps)
        # _manual_output_handler → _passthrough since no "text" in config.
        assert result == {"image": "img_data"}

    @pytest.mark.asyncio
    async def test_string_text_config(self):
        """String text in config is used directly for the request."""
        html_text = "<p>Result</p>"
        chunks = [
            {"parts": [
                {"text": html_text,
                 "partMetadata": {"chunk_type": "html"}},
            ]},
        ]
        deps = _make_deps(stream_chunks=chunks)
        inputs: dict = {}
        config = {"text": "Hello plain text"}

        result = await _html_auto_layout_handler(inputs, config, deps)

        # Should succeed and return HTML.
        context = result["context"]
        decoded = base64.b64decode(context[0]["parts"][0]["inlineData"]["data"]).decode()
        assert decoded == html_text

    @pytest.mark.asyncio
    async def test_image_input_preserved_in_request_body(self):
        """Image storedData from an input is included in the webpage request."""
        html_text = "<html><body><img src='...'></body></html>"
        chunks = [
            {"parts": [
                {"text": html_text,
                 "partMetadata": {"chunk_type": "html"}},
            ]},
        ]
        captured_bodies: list[dict] = []

        async def _capture_stream(body):
            captured_bodies.append(body)
            for chunk in chunks:
                yield chunk

        deps = _make_deps(stream_chunks=chunks)
        deps.backend.stream_generate_webpage = _capture_stream

        # Template references both an image and text input.
        template = (
            '{{"type":"in","path":"img-node","title":"Image"}}'
            ' {{"type":"in","path":"txt-node","title":"Text"}}'
        )
        inputs = {
            "p-z-img-node": [[
                {"role": "user", "parts": [{
                    "storedData": {
                        "handle": "/board/blobs/abc123",
                        "mimeType": "image/png",
                    }
                }]}
            ]],
            "p-z-txt-node": [[
                {"role": "model", "parts": [{"text": "A haiku"}]}
            ]],
        }
        config = {
            "text": {"role": "user", "parts": [{"text": template}]},
        }

        result = await _html_auto_layout_handler(inputs, config, deps)

        # Verify the request body was captured.
        assert len(captured_bodies) == 1
        body = captured_bodies[0]
        contents = body["contents"]

        # Should have 2 content items: storedData (as fileData) + text.
        assert len(contents) == 2

        # First content: the image (storedData → fileData).
        media_part = contents[0]["parts"][0]
        assert "fileData" in media_part
        assert media_part["fileData"]["mimeType"] == "image/png"

        # Second content: the text.
        text_part = contents[1]["parts"][0]
        assert "text" in text_part
        assert "A haiku" in text_part["text"]


# ---------------------------------------------------------------------------
# _substitute_template_parts (multimodal template substitution)
# ---------------------------------------------------------------------------

class TestSubstituteTemplateParts:
    """Test multimodal-aware template substitution."""

    def test_text_only(self):
        """Pure text input is preserved."""
        parts = _substitute_template_parts("Hello world", {})
        assert parts == [{"text": "Hello world"}]

    def test_text_input_substituted(self):
        """Text input is inlined as a text part."""
        inputs = {
            "p-z-node1": [[
                {"role": "model", "parts": [{"text": "replaced"}]}
            ]],
        }
        parts = _substitute_template_parts(
            'before {{"type":"in","path":"node1","title":"Node"}} after',
            inputs,
        )
        # Adjacent text parts should be merged.
        assert len(parts) == 1
        assert parts[0]["text"] == "before replaced after"

    def test_image_input_preserved(self):
        """storedData parts from inputs are preserved, not converted to text."""
        inputs = {
            "p-z-img": [[
                {"role": "user", "parts": [{
                    "storedData": {
                        "handle": "/board/blobs/abc",
                        "mimeType": "image/png",
                    }
                }]}
            ]],
        }
        parts = _substitute_template_parts(
            '{{"type":"in","path":"img","title":"Image"}}',
            inputs,
        )
        assert len(parts) == 1
        assert "storedData" in parts[0]
        assert parts[0]["storedData"]["mimeType"] == "image/png"

    def test_mixed_text_and_image(self):
        """Template with both text and image produces mixed parts list."""
        inputs = {
            "p-z-img": [[
                {"role": "user", "parts": [{
                    "storedData": {
                        "handle": "/board/blobs/xyz",
                        "mimeType": "image/png",
                    }
                }]}
            ]],
            "p-z-txt": [[
                {"role": "model", "parts": [{"text": "poem"}]}
            ]],
        }
        parts = _substitute_template_parts(
            '{{"type":"in","path":"img","title":"Img"}}'
            ' {{"type":"in","path":"txt","title":"Txt"}}',
            inputs,
        )
        # Should be: storedData, then " poem" (merged text).
        assert len(parts) == 2
        assert "storedData" in parts[0]
        assert parts[1] == {"text": " poem"}

    def test_missing_input_uses_title(self):
        """Missing input falls back to the placeholder title."""
        parts = _substitute_template_parts(
            '{{"type":"in","path":"missing","title":"Fallback"}}',
            {},
        )
        assert parts == [{"text": "Fallback"}]


# ---------------------------------------------------------------------------
# _get_input_parts
# ---------------------------------------------------------------------------

class TestGetInputParts:
    """Test extracting parts from input port values."""

    def test_string_value(self):
        assert _get_input_parts(["hello"]) == [{"text": "hello"}]

    def test_single_llm_content(self):
        value = {"role": "model", "parts": [{"text": "hi"}]}
        assert _get_input_parts([value]) == [{"text": "hi"}]

    def test_llm_content_array(self):
        value = [
            {"role": "$metadata", "parts": [{"text": "meta"}]},
            {"role": "model", "parts": [{"text": "content"}]},
        ]
        assert _get_input_parts([value]) == [{"text": "content"}]

    def test_stored_data_preserved(self):
        value = {"role": "user", "parts": [
            {"storedData": {"handle": "h", "mimeType": "image/png"}}
        ]}
        result = _get_input_parts([value])
        assert len(result) == 1
        assert "storedData" in result[0]

    def test_empty_values(self):
        assert _get_input_parts([]) == []
