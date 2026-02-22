# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for AgentFileSystem (Phase 4.4f).
"""

from __future__ import annotations

import pytest

from opal_backend_shared.agent_file_system import (
    AgentFileSystem,
    FileDescriptor,
)


# =============================================================================
# Basic read/write operations
# =============================================================================


class TestWriteAndRead:
    """Tests for write, overwrite, append, and read_text."""

    def test_write_creates_file(self):
        fs = AgentFileSystem()
        path = fs.write("hello.txt", "world")
        assert path == "/mnt/hello.txt"
        text = fs.read_text(path)
        assert text == "world"

    def test_write_adds_extension_when_missing(self):
        fs = AgentFileSystem()
        path = fs.write("hello", "world")
        assert path == "/mnt/hello.txt"

    def test_write_html_uses_inline_data_type(self):
        fs = AgentFileSystem()
        path = fs.write("page.html", "<h1>hi</h1>")
        assert path == "/mnt/page.html"
        file = fs.files[path]
        assert file.type == "inlineData"

    def test_overwrite_replaces_content(self):
        fs = AgentFileSystem()
        path = fs.overwrite("data.txt", "first")
        assert fs.read_text(path) == "first"
        fs.overwrite("data.txt", "second")
        assert fs.read_text(path) == "second"

    def test_overwrite_does_not_warn(self):
        """overwrite always silently replaces."""
        fs = AgentFileSystem()
        fs.overwrite("data.txt", "first")
        # Should not raise or print warning
        fs.overwrite("data.txt", "second")

    def test_write_infers_markdown_mime_type(self):
        """Ported from TS: .md → text/markdown."""
        fs = AgentFileSystem()
        path = fs.write("report.md", "# Hello")
        assert path == "/mnt/report.md"
        file = fs.files[path]
        assert file.mime_type == "text/markdown"
        assert file.type == "text"

    def test_write_infers_csv_mime_type(self):
        """Ported from TS: .csv → text/csv."""
        fs = AgentFileSystem()
        path = fs.write("data.csv", "a,b,c")
        assert path == "/mnt/data.csv"
        file = fs.files[path]
        assert file.mime_type == "text/csv"

    def test_overwrite_infers_json_mime_type(self):
        """Ported from TS: .json → application/json."""
        fs = AgentFileSystem()
        path = fs.overwrite("config.json", '{"key": "value"}')
        assert path == "/mnt/config.json"
        file = fs.files[path]
        assert file.mime_type == "application/json"

    def test_append_creates_file_if_not_exists(self):
        fs = AgentFileSystem()
        result = fs.append("/mnt/log.md", "line 1")
        assert result is None
        assert fs.read_text("/mnt/log.md") == "line 1"

    def test_append_adds_to_existing_file(self):
        fs = AgentFileSystem()
        fs.append("/mnt/log.md", "line 1")
        fs.append("/mnt/log.md", "line 2")
        assert fs.read_text("/mnt/log.md") == "line 1\nline 2"

    def test_append_errors_on_non_text_file(self):
        fs = AgentFileSystem()
        fs.write("page.html", "<h1>hi</h1>")
        result = fs.append("/mnt/page.html", "more")
        assert result is not None
        assert "$error" in result

    def test_read_text_errors_on_missing_file(self):
        fs = AgentFileSystem()
        result = fs.read_text("/mnt/nope.txt")
        assert isinstance(result, dict)
        assert "$error" in result


# =============================================================================
# File listing
# =============================================================================


class TestListFiles:
    """Tests for list_files."""

    def test_empty_fs_returns_empty_string(self):
        fs = AgentFileSystem()
        assert fs.list_files() == ""

    def test_lists_written_files(self):
        fs = AgentFileSystem()
        fs.write("a.txt", "content a")
        fs.write("b.md", "content b")
        listing = fs.list_files()
        assert "/mnt/a.txt" in listing
        assert "/mnt/b.md" in listing

    def test_lists_system_files(self):
        fs = AgentFileSystem()
        fs.add_system_file("/mnt/system/status", lambda: "ok")
        listing = fs.list_files()
        assert "/mnt/system/status" in listing


# =============================================================================
# System files
# =============================================================================


class TestSystemFiles:
    """Tests for virtual system files."""

    def test_get_system_file(self):
        fs = AgentFileSystem()
        fs.add_system_file("/mnt/system/task_tree", lambda: '{"tasks": []}')
        result = fs.get("/mnt/system/task_tree")
        assert isinstance(result, list)
        assert result[0]["text"] == '{"tasks": []}'

    def test_get_missing_system_file_errors(self):
        fs = AgentFileSystem()
        result = fs.get("/mnt/system/nope")
        assert isinstance(result, dict)
        assert "$error" in result

    def test_system_file_getter_returning_error_propagates(self):
        """Ported from TS: handles failure to get a system file."""
        fs = AgentFileSystem()
        fs.add_system_file(
            "/mnt/system/broken",
            lambda: {"$error": "Sorry"},
        )
        result = fs.get("/mnt/system/broken")
        assert isinstance(result, dict)
        assert "$error" in result


# =============================================================================
# Path fix-up
# =============================================================================


class TestPathFixup:
    """Tests for path normalization."""

    def test_fixes_missing_slash(self):
        fs = AgentFileSystem()
        fs.write("test.txt", "content")
        # Gemini sometimes omits the leading slash
        result = fs.get("mnt/test.txt")
        assert isinstance(result, list)
        assert result[0]["text"] == "content"

    def test_missing_file_returns_error(self):
        fs = AgentFileSystem()
        result = fs.get("/mnt/nope.txt")
        assert isinstance(result, dict)
        assert "$error" in result


# =============================================================================
# Auto-generated names
# =============================================================================


class TestCreate:
    """Tests for auto-generated file paths."""

    def test_auto_names_by_mime_type(self):
        fs = AgentFileSystem()
        assert fs.create("image/png") == "/mnt/image1.png"
        assert fs.create("audio/mpeg") == "/mnt/audio2.mp3"
        assert fs.create("text/plain") == "/mnt/text3.txt"

    def test_unknown_mime_type_uses_file_prefix(self):
        fs = AgentFileSystem()
        path = fs.create("application/octet-stream")
        assert path.startswith("/mnt/file")

    def test_increments_counter(self):
        fs = AgentFileSystem()
        p1 = fs.create("image/png")
        p2 = fs.create("image/png")
        assert p1 != p2
        assert "1" in p1
        assert "2" in p2


# =============================================================================
# Route mapping
# =============================================================================


class TestRouteMapping:
    """Tests for route add/lookup."""

    def test_add_route_returns_pidgin_name(self):
        fs = AgentFileSystem()
        name = fs.add_route("/agents/writer")
        assert name == "/route-1"

    def test_get_original_route(self):
        fs = AgentFileSystem()
        name = fs.add_route("/agents/writer")
        original = fs.get_original_route(name)
        assert original == "/agents/writer"

    def test_default_routes_exist(self):
        fs = AgentFileSystem()
        assert fs.get_original_route("") == ""
        assert fs.get_original_route("/") == "/"

    def test_missing_route_errors(self):
        fs = AgentFileSystem()
        result = fs.get_original_route("/route-99")
        assert isinstance(result, dict)
        assert "$error" in result


# =============================================================================
# Data part operations
# =============================================================================


class TestAddPart:
    """Tests for add_part (data parts)."""

    def test_add_text_part(self):
        fs = AgentFileSystem()
        path = fs.add_part({"text": "hello world"})
        assert isinstance(path, str)
        assert path.startswith("/mnt/")
        assert fs.read_text(path) == "hello world"

    def test_add_inline_data_part(self):
        fs = AgentFileSystem()
        path = fs.add_part({
            "inlineData": {
                "data": "base64data",
                "mimeType": "image/png",
            }
        })
        assert isinstance(path, str)
        assert "image" in path

    def test_add_stored_data_deduplicates(self):
        fs = AgentFileSystem()
        p1 = fs.add_part({
            "storedData": {
                "handle": "drive://abc",
                "mimeType": "text/plain",
            }
        })
        p2 = fs.add_part({
            "storedData": {
                "handle": "drive://abc",
                "mimeType": "text/plain",
            }
        })
        assert p1 == p2

    def test_add_file_data_deduplicates(self):
        fs = AgentFileSystem()
        p1 = fs.add_part({
            "fileData": {
                "fileUri": "https://example.com/file",
                "mimeType": "video/mp4",
            }
        })
        p2 = fs.add_part({
            "fileData": {
                "fileUri": "https://example.com/file",
                "mimeType": "video/mp4",
            }
        })
        assert p1 == p2

    def test_add_part_with_explicit_name(self):
        fs = AgentFileSystem()
        path = fs.add_part({"text": "content"}, file_name="report.md")
        assert path == "/mnt/report.md"

    def test_add_part_with_name_without_extension(self):
        fs = AgentFileSystem()
        path = fs.add_part(
            {"inlineData": {"data": "img", "mimeType": "image/png"}},
            file_name="photo"
        )
        assert path == "/mnt/photo.png"

    def test_unsupported_part_errors(self):
        fs = AgentFileSystem()
        result = fs.add_part({"unknown": "data"})
        assert isinstance(result, dict)
        assert "$error" in result

    def test_different_handles_not_deduplicated(self):
        """Ported from TS: different handles create separate files."""
        fs = AgentFileSystem()
        p1 = fs.add_part({
            "storedData": {
                "handle": "stored://handle-1",
                "mimeType": "image/png",
            }
        })
        p2 = fs.add_part({
            "storedData": {
                "handle": "stored://handle-2",
                "mimeType": "image/png",
            }
        })
        assert p1 != p2
        assert len(fs.files) == 2

    def test_text_parts_not_deduplicated(self):
        """Ported from TS: same text content still creates two files."""
        fs = AgentFileSystem()
        p1 = fs.add_part({"text": "same text"})
        p2 = fs.add_part({"text": "same text"})
        assert p1 != p2
        assert len(fs.files) == 2


# =============================================================================
# File URL
# =============================================================================


class TestGetFileUrl:
    """Tests for get_file_url."""

    def test_text_file_returns_none(self):
        fs = AgentFileSystem()
        fs.write("note.txt", "hello")
        assert fs.get_file_url("/mnt/note.txt") is None

    def test_inline_data_returns_data_url(self):
        fs = AgentFileSystem()
        fs.add_part({
            "inlineData": {"data": "abc123", "mimeType": "image/png"}
        })
        url = fs.get_file_url("/mnt/image1.png")
        assert url == "data:image/png;base64,abc123"

    def test_missing_path_returns_none(self):
        fs = AgentFileSystem()
        assert fs.get_file_url("/mnt/nope") is None


# =============================================================================
# Restore from snapshot
# =============================================================================


class TestRestoreFrom:
    """Tests for restore_from."""

    def test_restores_files_from_snapshot(self):
        fs = AgentFileSystem()
        fs.restore_from({
            "/mnt/a.txt": {
                "data": "hello",
                "mime_type": "text/plain",
                "type": "text",
            },
            "/mnt/b.md": {
                "data": "world",
                "mime_type": "text/markdown",
                "type": "text",
            },
        })
        assert fs.read_text("/mnt/a.txt") == "hello"
        assert fs.read_text("/mnt/b.md") == "world"

    def test_restore_clears_previous_files(self):
        fs = AgentFileSystem()
        fs.write("old.txt", "old content")
        fs.restore_from({
            "/mnt/new.txt": {
                "data": "new content",
                "mime_type": "text/plain",
                "type": "text",
            },
        })
        assert isinstance(fs.read_text("/mnt/old.txt"), dict)  # error
        assert fs.read_text("/mnt/new.txt") == "new content"
