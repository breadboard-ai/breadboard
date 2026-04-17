# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for DiskFileSystem.

Covers the full FileSystem protocol surface: write, read, list, get,
system files, binary files, snapshot, and add_part.
"""

from __future__ import annotations

import asyncio
import base64

import pytest

from bees.disk_file_system import DiskFileSystem
from bees.protocols.filesystem import FileDescriptor


# ---------------------------------------------------------------------------
# write / read_text / overwrite
# ---------------------------------------------------------------------------


class TestWriteReadOverwrite:

    def test_write_creates_file_on_disk(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        path = fs.write("hello.md", "# Hello")
        assert path == "hello.md"
        assert (tmp_path / "hello.md").read_text() == "# Hello"

    def test_write_adds_extension_when_missing(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        path = fs.write("notes", "some notes")
        assert path == "notes.txt"
        assert (tmp_path / "notes.txt").read_text() == "some notes"

    def test_write_creates_nested_dirs(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        path = fs.write("build/index.js", "console.log('hi')")
        assert path == "build/index.js"
        assert (tmp_path / "build" / "index.js").read_text() == "console.log('hi')"

    def test_overwrite_replaces_content(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("data.txt", "original")
        fs.overwrite("data.txt", "replaced")
        assert (tmp_path / "data.txt").read_text() == "replaced"

    @pytest.mark.asyncio
    async def test_read_text_returns_content(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("readme.md", "# README")
        text = await fs.read_text("readme.md")
        assert text == "# README"

    @pytest.mark.asyncio
    async def test_read_text_returns_error_for_missing_file(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        result = await fs.read_text("nope.txt")
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# append
# ---------------------------------------------------------------------------


class TestAppend:

    def test_append_creates_new_file(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        result = fs.append("log.md", "line 1")
        assert result is None
        assert (tmp_path / "log.md").read_text() == "line 1"

    def test_append_adds_to_existing_file(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("log.md", "line 1")
        result = fs.append("log.md", "line 2")
        assert result is None
        assert (tmp_path / "log.md").read_text() == "line 1\nline 2"

    def test_append_rejects_binary_file(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        (tmp_path / "img.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)
        result = fs.append("img.png", "oops")
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# get (Gemini data parts)
# ---------------------------------------------------------------------------


class TestGet:

    @pytest.mark.asyncio
    async def test_get_text_file_returns_text_part(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("note.md", "hello")
        parts = await fs.get("note.md")
        assert isinstance(parts, list)
        assert len(parts) == 1
        assert parts[0] == {"text": "hello"}

    @pytest.mark.asyncio
    async def test_get_binary_file_returns_inline_data(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
        (tmp_path / "image.png").write_bytes(png_bytes)
        parts = await fs.get("image.png")
        assert isinstance(parts, list)
        assert len(parts) == 1
        assert "inlineData" in parts[0]
        assert parts[0]["inlineData"]["mimeType"] == "image/png"
        decoded = base64.b64decode(parts[0]["inlineData"]["data"])
        assert decoded == png_bytes

    @pytest.mark.asyncio
    async def test_get_missing_file_returns_error(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        result = await fs.get("nope.txt")
        assert isinstance(result, dict)
        assert "$error" in result

    @pytest.mark.asyncio
    async def test_get_system_file(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.add_system_file("system/status", lambda: "all good")
        parts = await fs.get("system/status")
        assert isinstance(parts, list)
        assert parts[0] == {"text": "all good"}

    @pytest.mark.asyncio
    async def test_get_system_file_error(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.add_system_file(
            "system/broken",
            lambda: {"$error": "something broke"},
        )
        result = await fs.get("system/broken")
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# get_many
# ---------------------------------------------------------------------------


class TestGetMany:

    @pytest.mark.asyncio
    async def test_get_many_returns_all_parts(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("a.txt", "alpha")
        fs.write("b.txt", "beta")
        parts = await fs.get_many(["a.txt", "b.txt"])
        assert isinstance(parts, list)
        assert len(parts) == 2

    @pytest.mark.asyncio
    async def test_get_many_returns_error_on_missing(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("a.txt", "alpha")
        result = await fs.get_many(["a.txt", "nope.txt"])
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# list_files
# ---------------------------------------------------------------------------


class TestListFiles:

    @pytest.mark.asyncio
    async def test_list_files_returns_all_files(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("a.txt", "alpha")
        fs.write("b.md", "beta")
        listing = await fs.list_files()
        lines = listing.strip().split("\n")
        assert "a.txt" in lines
        assert "b.md" in lines

    @pytest.mark.asyncio
    async def test_list_files_includes_nested(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("build/index.js", "code")
        listing = await fs.list_files()
        assert "build/index.js" in listing

    @pytest.mark.asyncio
    async def test_list_files_skips_node_modules(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / "pkg.js").write_text("module")
        listing = await fs.list_files()
        assert "node_modules" not in listing

    @pytest.mark.asyncio
    async def test_list_files_skips_hidden_dirs(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        hidden = tmp_path / ".cache"
        hidden.mkdir()
        (hidden / "data.txt").write_text("hidden")
        listing = await fs.list_files()
        assert ".cache" not in listing

    @pytest.mark.asyncio
    async def test_list_files_includes_system_files(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.add_system_file("system/status", lambda: "ok")
        listing = await fs.list_files()
        assert "system/status" in listing

    @pytest.mark.asyncio
    async def test_list_files_empty_dir(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        listing = await fs.list_files()
        assert listing == ""


# ---------------------------------------------------------------------------
# files property
# ---------------------------------------------------------------------------


class TestFilesProperty:

    def test_files_returns_file_descriptors(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("note.md", "# Note")
        files = fs.files
        assert "note.md" in files
        fd = files["note.md"]
        assert isinstance(fd, FileDescriptor)
        assert fd.data == "# Note"
        assert fd.type == "text"
        assert fd.mime_type == "text/markdown"

    def test_files_returns_binary_as_inline_data(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
        (tmp_path / "img.png").write_bytes(png_bytes)
        files = fs.files
        assert "img.png" in files
        fd = files["img.png"]
        assert fd.type == "inlineData"
        assert fd.mime_type == "image/png"

    def test_files_excludes_node_modules(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        nm = tmp_path / "node_modules"
        nm.mkdir()
        (nm / "pkg.js").write_text("module")
        files = fs.files
        assert not any("node_modules" in k for k in files)

    def test_files_excludes_hidden_dirs(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        hidden = tmp_path / ".cache"
        hidden.mkdir()
        (hidden / "data.txt").write_text("hidden")
        files = fs.files
        assert not any(".cache" in k for k in files)


# ---------------------------------------------------------------------------
# snapshot
# ---------------------------------------------------------------------------


class TestSnapshot:

    def test_snapshot_captures_disk_state(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        fs.write("a.txt", "alpha")
        fs.write("b.md", "beta")
        snap = fs.snapshot
        assert "a.txt" in snap.files
        assert "b.md" in snap.files
        assert snap.file_count == 2

    def test_snapshot_includes_routes(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        pidgin = fs.add_route("https://example.com")
        snap = fs.snapshot
        assert pidgin in snap.routes
        assert snap.routes[pidgin] == "https://example.com"


# ---------------------------------------------------------------------------
# add_part
# ---------------------------------------------------------------------------


class TestAddPart:

    def test_add_text_part_writes_to_disk(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        path = fs.add_part({"text": "hello world"}, file_name="note.md")
        assert path == "note.md"
        assert (tmp_path / "note.md").read_text() == "hello world"

    def test_add_inline_data_part_writes_bytes(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
        data = base64.b64encode(png_bytes).decode()
        path = fs.add_part(
            {"inlineData": {"data": data, "mimeType": "image/png"}},
            file_name="icon.png",
        )
        assert path == "icon.png"
        assert (tmp_path / "icon.png").read_bytes() == png_bytes

    def test_add_text_part_auto_names(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        path = fs.add_part({"text": "auto"})
        assert path  # non-empty
        assert (tmp_path / path).read_text() == "auto"

    def test_add_unsupported_part_returns_error(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        result = fs.add_part({"unknown": "data"})
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


class TestRoutes:

    def test_add_and_get_route(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        pidgin = fs.add_route("https://example.com/page")
        original = fs.get_original_route(pidgin)
        assert original == "https://example.com/page"

    def test_get_unknown_route_returns_error(self, tmp_path):
        fs = DiskFileSystem(tmp_path)
        result = fs.get_original_route("/route-999")
        assert isinstance(result, dict)
        assert "$error" in result


# ---------------------------------------------------------------------------
# Protocol compliance
# ---------------------------------------------------------------------------


class TestProtocolCompliance:

    def test_satisfies_file_system_protocol(self, tmp_path):
        """DiskFileSystem satisfies the FileSystem runtime_checkable protocol."""
        from opal_backend.file_system_protocol import FileSystem

        fs = DiskFileSystem(tmp_path)
        assert isinstance(fs, FileSystem)

    def test_agent_file_system_still_satisfies_protocol(self):
        """AgentFileSystem should also satisfy the FileSystem protocol."""
        from opal_backend.file_system_protocol import FileSystem
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        assert isinstance(fs, FileSystem)
