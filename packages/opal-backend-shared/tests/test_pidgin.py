# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for pidgin.py (Phase 4.4f).
"""

from __future__ import annotations

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.pidgin import from_pidgin_string


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
