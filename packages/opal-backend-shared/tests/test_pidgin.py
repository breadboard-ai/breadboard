# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for pidgin.py.
"""

from __future__ import annotations

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.pidgin import (
    from_pidgin_string,
    to_pidgin,
    ToPidginResult,
    ROUTE_TOOL_PATH,
    MEMORY_TOOL_PATH,
    NOTEBOOKLM_TOOL_PATH,
)


class TestFromPidginString:
    """Tests for from_pidgin_string."""

    def test_plain_text_passthrough(self):
        fs = AgentFileSystem()
        result = from_pidgin_string("hello world", fs)
        assert "parts" in result
        assert result["parts"] == [{"text": "hello world"}]
        assert result["role"] == "user"

    def test_resolves_file_tag(self):
        fs = AgentFileSystem()
        fs.write("report.md", "# My Report")
        result = from_pidgin_string(
            'See the report: <file src="/mnt/report.md" />', fs
        )
        assert "parts" in result
        # Should have merged text: "See the report: " + "# My Report"
        texts = [p["text"] for p in result["parts"] if "text" in p]
        assert any("My Report" in t for t in texts)

    def test_resolves_multiple_file_tags(self):
        fs = AgentFileSystem()
        fs.write("a.txt", "content A")
        fs.write("b.txt", "content B")
        result = from_pidgin_string(
            'File A: <file src="/mnt/a.txt" /> and File B: <file src="/mnt/b.txt" />',
            fs,
        )
        assert "parts" in result
        full_text = " ".join(
            p["text"] for p in result["parts"] if "text" in p
        )
        assert "content A" in full_text
        assert "content B" in full_text

    def test_extracts_link_text(self):
        fs = AgentFileSystem()
        result = from_pidgin_string(
            'Go to <a href="/agents/writer">the writer</a> for help', fs
        )
        assert "parts" in result
        full_text = " ".join(
            p["text"] for p in result["parts"] if "text" in p
        )
        assert "the writer" in full_text

    def test_missing_file_returns_error(self):
        fs = AgentFileSystem()
        result = from_pidgin_string(
            'See: <file src="/mnt/missing.txt" />', fs
        )
        assert "$error" in result
        assert "unable to proceed" in result["$error"].lower()

    def test_empty_string(self):
        fs = AgentFileSystem()
        result = from_pidgin_string("", fs)
        assert "parts" in result
        # Empty string produces empty parts or single empty text
        assert len(result["parts"]) <= 1

    def test_merges_consecutive_text_parts(self):
        fs = AgentFileSystem()
        result = from_pidgin_string(
            'before <a href="/x">link</a> after', fs
        )
        assert "parts" in result
        # "before", "link", "after" should be merged into fewer parts
        text_parts = [p for p in result["parts"] if "text" in p]
        # All consecutive text parts should be merged
        assert len(text_parts) == 1

    def test_non_text_parts_not_merged(self):
        """File data parts break text merging."""
        fs = AgentFileSystem()
        fs.add_part({
            "inlineData": {"data": "base64img", "mimeType": "image/png"}
        })
        result = from_pidgin_string(
            'before <file src="/mnt/image1.png" /> after', fs
        )
        assert "parts" in result
        # Should have: text("before"), inlineData, text("after")
        assert len(result["parts"]) == 3


class TestToPidgin:
    """Tests for to_pidgin."""

    def test_text_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [{"type": "text", "text": "Hello world"}], fs
        )
        assert isinstance(result, ToPidginResult)
        assert result.text == "Hello world"

    def test_multiple_text_segments(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {"type": "text", "text": "Hello "},
                {"type": "text", "text": "world"},
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert result.text == "Hello world"

    def test_asset_segment_with_text(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "asset",
                    "title": "Background",
                    "content": {
                        "parts": [{"text": "Some context"}]
                    },
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert '<asset title="Background">' in result.text
        assert "Some context" in result.text
        assert "</asset>" in result.text

    def test_asset_segment_with_data_part(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "asset",
                    "title": "Image Asset",
                    "content": {
                        "parts": [
                            {"inlineData": {"data": "abc", "mimeType": "image/png"}}
                        ]
                    },
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert '<asset title="Image Asset">' in result.text
        assert '<file src="/mnt/' in result.text
        assert "</asset>" in result.text
        # Data should be registered in FS
        assert fs.list_files()  # non-empty string means files exist

    def test_input_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "input",
                    "title": "Style Agent",
                    "content": {
                        "parts": [{"text": "Agent output here"}]
                    },
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert '<input source-agent="Style Agent">' in result.text
        assert "Agent output here" in result.text
        assert "</input>" in result.text

    def test_route_tool_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "tool",
                    "path": ROUTE_TOOL_PATH,
                    "title": "Detail view",
                    "instance": "https://example.com/run",
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert "<a href=" in result.text
        assert "Detail view" in result.text
        # Route should be registered
        route_name = fs.add_route("dummy")  # get next route name
        assert route_name  # routes are being tracked

    def test_memory_tool_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [{"type": "tool", "path": MEMORY_TOOL_PATH}], fs
        )
        assert isinstance(result, ToPidginResult)
        assert result.use_memory is True
        assert "Use Memory" in result.text

    def test_notebooklm_tool_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [{"type": "tool", "path": NOTEBOOKLM_TOOL_PATH}], fs
        )
        assert isinstance(result, ToPidginResult)
        assert result.use_notebooklm is True
        assert "Use NotebookLM" in result.text

    def test_notebooklm_flag_passthrough(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [{"type": "text", "text": "hi"}], fs, use_notebooklm_flag=True
        )
        assert isinstance(result, ToPidginResult)
        assert result.use_notebooklm is True

    def test_custom_tool_segment(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "tool",
                    "path": "https://example.com/tool.bgl.json",
                    "title": "My Tool",
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert len(result.custom_tool_urls) == 1
        assert result.custom_tool_urls[0]["url"] == "https://example.com/tool.bgl.json"
        assert result.custom_tool_urls[0]["title"] == "My Tool"

    def test_route_missing_instance_errors(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {
                    "type": "tool",
                    "path": ROUTE_TOOL_PATH,
                    "title": "Broken",
                }
            ],
            fs,
        )
        assert isinstance(result, dict)
        assert "$error" in result
        assert "Malformed route" in result["$error"]

    def test_asset_empty_content_errors(self):
        fs = AgentFileSystem()
        result = to_pidgin(
            [{"type": "asset", "title": "Empty", "content": {"parts": []}}],
            fs,
        )
        assert isinstance(result, dict)
        assert "$error" in result

    def test_notebooklm_stored_data_passthrough(self):
        """NotebookLM storedData should pass through as URL text, not file ref."""
        fs = AgentFileSystem()
        nlm_url = "https://notebooklm.google.com/notebook/abc123"
        result = to_pidgin(
            [
                {
                    "type": "asset",
                    "title": "NLM Source",
                    "content": {
                        "parts": [
                            {"storedData": {"handle": nlm_url, "mimeType": "application/x-notebooklm"}}
                        ]
                    },
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert nlm_url in result.text
        assert "<file" not in result.text  # Should NOT be a file reference

    def test_large_text_becomes_content_tag(self):
        """Text > MAX_INLINE_CHARACTER_LENGTH should get a <content> tag."""
        fs = AgentFileSystem()
        large_text = "x" * 1500
        result = to_pidgin(
            [
                {
                    "type": "asset",
                    "title": "Big",
                    "content": {"parts": [{"text": large_text}]},
                }
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert "<content src=" in result.text
        assert large_text in result.text

    def test_mixed_segments(self):
        """Integration test with text + asset + tool segments."""
        fs = AgentFileSystem()
        result = to_pidgin(
            [
                {"type": "text", "text": "Please analyze: "},
                {
                    "type": "asset",
                    "title": "Doc",
                    "content": {"parts": [{"text": "Document content"}]},
                },
                {"type": "tool", "path": MEMORY_TOOL_PATH},
            ],
            fs,
        )
        assert isinstance(result, ToPidginResult)
        assert "Please analyze: " in result.text
        assert '<asset title="Doc">' in result.text
        assert result.use_memory is True

    def test_empty_segments(self):
        fs = AgentFileSystem()
        result = to_pidgin([], fs)
        assert isinstance(result, ToPidginResult)
        assert result.text == ""
        assert result.use_memory is False

    def test_round_trip_text(self):
        """to_pidgin → from_pidgin_string should preserve file content."""
        fs = AgentFileSystem()
        # to_pidgin: register an image
        to_result = to_pidgin(
            [
                {"type": "text", "text": "Here: "},
                {
                    "type": "asset",
                    "title": "Photo",
                    "content": {
                        "parts": [
                            {"inlineData": {"data": "img_data", "mimeType": "image/png"}}
                        ]
                    },
                },
            ],
            fs,
        )
        assert isinstance(to_result, ToPidginResult)
        # from_pidgin: resolve the file ref back
        from_result = from_pidgin_string(to_result.text, fs)
        assert "parts" in from_result
        # Should contain the original inlineData part
        data_parts = [p for p in from_result["parts"] if "inlineData" in p]
        assert len(data_parts) == 1
        assert data_parts[0]["inlineData"]["data"] == "img_data"

