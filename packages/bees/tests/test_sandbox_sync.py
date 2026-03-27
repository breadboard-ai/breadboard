# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for sandbox ↔ AgentFileSystem sync.

Covers the two sync helpers directly (no subprocess) and the full
execute_bash round-trip with a real subprocess.
"""

from __future__ import annotations

import asyncio
import base64
import tempfile
from pathlib import Path

import pytest

from opal_backend.agent_file_system import AgentFileSystem
from bees.functions.sandbox import (
    _sync_agent_fs_to_disk,
    _sync_disk_to_agent_fs,
    get_sandbox_function_group,
)


# ---------------------------------------------------------------------------
# _sync_agent_fs_to_disk
# ---------------------------------------------------------------------------


class TestSyncAgentFsToDisk:

    def test_text_file_written_to_disk(self, tmp_path):
        fs = AgentFileSystem()
        fs.write("hello.md", "# Hello")
        _sync_agent_fs_to_disk(fs, tmp_path)
        assert (tmp_path / "mnt" / "hello.md").read_text() == "# Hello"

    def test_nested_path_creates_parent_dirs(self, tmp_path):
        fs = AgentFileSystem()
        fs.write("subdir/file.txt", "content")
        _sync_agent_fs_to_disk(fs, tmp_path)
        assert (tmp_path / "mnt" / "subdir" / "file.txt").read_text() == "content"

    def test_unchanged_file_not_rewritten(self, tmp_path):
        fs = AgentFileSystem()
        fs.write("a.txt", "same")
        _sync_agent_fs_to_disk(fs, tmp_path)
        disk = tmp_path / "mnt" / "a.txt"
        mtime_before = disk.stat().st_mtime_ns

        # Sync again without changes.
        _sync_agent_fs_to_disk(fs, tmp_path)
        assert disk.stat().st_mtime_ns == mtime_before

    def test_system_path_skipped(self, tmp_path):
        fs = AgentFileSystem()
        fs.add_system_file("/mnt/system/status", lambda: "ok")
        _sync_agent_fs_to_disk(fs, tmp_path)
        assert not (tmp_path / "mnt" / "system").exists()

    def test_inline_data_file_skipped(self, tmp_path):
        """Binary inlineData files are not written to disk (can't be exec'd)."""
        fs = AgentFileSystem()
        fs.add_part({
            "inlineData": {"data": "abc", "mimeType": "image/png"},
        })
        _sync_agent_fs_to_disk(fs, tmp_path)
        assert not (tmp_path / "mnt").exists() or not any(
            (tmp_path / "mnt").rglob("*.png")
        )


# ---------------------------------------------------------------------------
# _sync_disk_to_agent_fs
# ---------------------------------------------------------------------------


class TestSyncDiskToAgentFs:

    def test_new_text_file_ingested(self, tmp_path):
        fs = AgentFileSystem()
        mnt = tmp_path / "mnt"
        mnt.mkdir()
        (mnt / "created.txt").write_text("from bash")
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert "/mnt/created.txt" in fs.files
        assert fs.files["/mnt/created.txt"].data == "from bash"

    def test_modified_text_file_updates_agent_fs(self, tmp_path):
        fs = AgentFileSystem()
        fs.write("existing.txt", "original")
        mnt = tmp_path / "mnt"
        mnt.mkdir()
        (mnt / "existing.txt").write_text("modified by bash")
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert fs.files["/mnt/existing.txt"].data == "modified by bash"

    def test_unchanged_existing_file_not_mutated(self, tmp_path):
        fs = AgentFileSystem()
        fs.write("stable.txt", "unchanged")
        mnt = tmp_path / "mnt"
        mnt.mkdir()
        (mnt / "stable.txt").write_text("unchanged")
        fd_before = fs.files["/mnt/stable.txt"]
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert fs.files["/mnt/stable.txt"] is fd_before

    def test_binary_file_ingested_as_inline_data(self, tmp_path):
        fs = AgentFileSystem()
        mnt = tmp_path / "mnt"
        mnt.mkdir()
        # A minimal PNG magic number (8-byte signature).
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
        (mnt / "img.png").write_bytes(png_bytes)
        _sync_disk_to_agent_fs(fs, tmp_path)
        # The file may land under a different auto-generated path, but
        # exactly one inlineData entry should exist.
        inline = [
            (p, d) for p, d in fs.files.items() if d.type == "inlineData"
        ]
        assert len(inline) == 1
        path, descriptor = inline[0]
        assert descriptor.mime_type == "image/png"

    def test_binary_file_not_ingested_twice(self, tmp_path):
        fs = AgentFileSystem()
        mnt = tmp_path / "mnt"
        mnt.mkdir()
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
        (mnt / "img.png").write_bytes(png_bytes)
        _sync_disk_to_agent_fs(fs, tmp_path)
        count_after_first = len(fs.files)
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert len(fs.files) == count_after_first

    def test_system_path_on_disk_skipped(self, tmp_path):
        fs = AgentFileSystem()
        system_dir = tmp_path / "mnt" / "system"
        system_dir.mkdir(parents=True)
        (system_dir / "injected.txt").write_text("malicious")
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert "/mnt/system/injected.txt" not in fs.files

    def test_nested_bash_created_file_ingested(self, tmp_path):
        fs = AgentFileSystem()
        mnt = tmp_path / "mnt"
        build = mnt / "build"
        build.mkdir(parents=True)
        (build / "index.js").write_text("console.log('hi')")
        _sync_disk_to_agent_fs(fs, tmp_path)
        assert "/mnt/build/index.js" in fs.files

    def test_no_mnt_dir_is_noop(self, tmp_path):
        """If work_dir has no mnt/ subdir, sync is a safe no-op."""
        fs = AgentFileSystem()
        _sync_disk_to_agent_fs(fs, tmp_path)  # should not raise
        assert len(fs.files) == 0


# ---------------------------------------------------------------------------
# execute_bash round-trip (integration)
# ---------------------------------------------------------------------------


class TestExecuteBashSync:

    @pytest.mark.asyncio
    async def test_agent_fs_file_readable_in_bash(self, tmp_path):
        """File written to AgentFS is visible to bash."""
        fs = AgentFileSystem()
        fs.write("note.md", "hello from agent")

        work_dir = tmp_path / "filesystem"
        work_dir.mkdir()

        # Build group manually using the eager form wired with agent_fs.
        from bees.functions.sandbox import _make_handlers, load_declarations, assemble_function_group, _DECLARATIONS_DIR
        handlers = _make_handlers(work_dir=work_dir, agent_fs=fs)
        loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
        group = assemble_function_group(loaded, handlers)

        handler = dict(group.definitions)["execute_bash"].handler
        result = await handler({"command": "cat mnt/note.md"}, None)
        assert result["exit_code"] == 0
        assert "hello from agent" in result["stdout"]

    @pytest.mark.asyncio
    async def test_bash_created_file_in_agent_fs(self, tmp_path):
        """File created by bash appears in AgentFS after the call."""
        fs = AgentFileSystem()
        work_dir = tmp_path / "filesystem"
        work_dir.mkdir()
        (work_dir / "mnt").mkdir()

        from bees.functions.sandbox import _make_handlers, load_declarations, assemble_function_group, _DECLARATIONS_DIR
        handlers = _make_handlers(work_dir=work_dir, agent_fs=fs)
        loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
        group = assemble_function_group(loaded, handlers)

        handler = dict(group.definitions)["execute_bash"].handler
        result = await handler(
            {"command": "echo 'created by bash' > mnt/output.txt"}, None
        )
        assert result["exit_code"] == 0
        assert "/mnt/output.txt" in fs.files
        assert "created by bash" in fs.files["/mnt/output.txt"].data

    @pytest.mark.asyncio
    async def test_bash_modified_file_updates_agent_fs(self, tmp_path):
        """Bash modification of an AgentFS file is picked up after the call."""
        fs = AgentFileSystem()
        fs.write("data.txt", "original")
        work_dir = tmp_path / "filesystem"
        work_dir.mkdir()

        from bees.functions.sandbox import _make_handlers, load_declarations, assemble_function_group, _DECLARATIONS_DIR
        handlers = _make_handlers(work_dir=work_dir, agent_fs=fs)
        loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
        group = assemble_function_group(loaded, handlers)

        handler = dict(group.definitions)["execute_bash"].handler
        result = await handler(
            {"command": "echo 'overwritten' > mnt/data.txt"}, None
        )
        assert result["exit_code"] == 0
        assert "overwritten" in fs.files["/mnt/data.txt"].data
