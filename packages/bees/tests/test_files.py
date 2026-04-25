# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for files_list_dir in the files function group."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bees.functions.files import _make_list_dir_handler


@pytest.fixture
def work_dir(tmp_path: Path) -> Path:
    """Create a work directory with a known structure."""
    # Directories
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "utils").mkdir()
    (tmp_path / "build").mkdir()

    # Text files
    (tmp_path / "README.md").write_text("# Hello\n\nWorld\n")
    (tmp_path / "src" / "main.py").write_text("print('hi')\n")

    # Binary file (contains null bytes)
    (tmp_path / "image.png").write_bytes(b"\x89PNG\x00\x00fake")

    # Empty file
    (tmp_path / "empty.txt").write_bytes(b"")

    # Dotfile and skip dirs (should be hidden)
    (tmp_path / ".hidden").write_text("secret")
    (tmp_path / ".git").mkdir()
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "__pycache__").mkdir()

    return tmp_path


@pytest.mark.asyncio
async def test_lists_root_directory(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)

    assert "error" not in result
    entries = json.loads(result["entries"])
    names = [e["name"] for e in entries]

    # Visible entries (sorted).
    assert "README.md" in names
    assert "build" in names
    assert "empty.txt" in names
    assert "image.png" in names
    assert "src" in names

    # Skipped entries.
    assert ".hidden" not in names
    assert ".git" not in names
    assert "node_modules" not in names
    assert "__pycache__" not in names


@pytest.mark.asyncio
async def test_directory_entries_have_isDir(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)
    entries = json.loads(result["entries"])

    dirs = [e for e in entries if e.get("isDir")]
    dir_names = [e["name"] for e in dirs]
    assert "src" in dir_names
    assert "build" in dir_names

    # Directories should not have sizeBytes.
    for d in dirs:
        assert "sizeBytes" not in d


@pytest.mark.asyncio
async def test_text_file_has_line_count(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)
    entries = json.loads(result["entries"])

    readme = next(e for e in entries if e["name"] == "README.md")
    assert "sizeBytes" in readme
    assert readme["sizeBytes"] > 0
    assert readme["lineCount"] == 3  # "# Hello\n\nWorld\n"


@pytest.mark.asyncio
async def test_binary_file_has_no_line_count(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)
    entries = json.loads(result["entries"])

    img = next(e for e in entries if e["name"] == "image.png")
    assert "sizeBytes" in img
    assert "lineCount" not in img


@pytest.mark.asyncio
async def test_empty_file_has_zero_lines(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)
    entries = json.loads(result["entries"])

    empty = next(e for e in entries if e["name"] == "empty.txt")
    assert empty["sizeBytes"] == 0
    assert empty["lineCount"] == 0


@pytest.mark.asyncio
async def test_subdirectory_listing(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "src"}, None)

    assert "error" not in result
    entries = json.loads(result["entries"])
    names = [e["name"] for e in entries]

    assert "main.py" in names
    assert "utils" in names


@pytest.mark.asyncio
async def test_nonexistent_directory(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "nope"}, None)

    assert "error" in result
    assert "Not a directory" in result["error"]


@pytest.mark.asyncio
async def test_path_traversal_blocked(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "../../.."}, None)

    assert "error" in result
    assert "outside the working directory" in result["error"]


@pytest.mark.asyncio
async def test_entries_are_sorted(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    result = await handler({"dir": "."}, None)
    entries = json.loads(result["entries"])
    names = [e["name"] for e in entries]

    assert names == sorted(names)


@pytest.mark.asyncio
async def test_defaults_to_dot(work_dir: Path):
    """Omitting 'dir' should default to listing root."""
    handler = _make_list_dir_handler(work_dir)
    result = await handler({}, None)

    assert "error" not in result
    entries = json.loads(result["entries"])
    names = [e["name"] for e in entries]
    assert "README.md" in names


@pytest.mark.asyncio
async def test_status_callback_called(work_dir: Path):
    handler = _make_list_dir_handler(work_dir)
    calls: list[str] = []
    result = await handler({"dir": "src"}, lambda msg, *_: calls.append(msg))

    assert "error" not in result
    assert any("src" in c for c in calls)
