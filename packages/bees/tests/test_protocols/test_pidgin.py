# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for bees-native pidgin utilities.

Verifies that ``bees.pidgin`` produces identical results to
``opal_backend.pidgin`` for the same inputs.
"""

from __future__ import annotations

import pytest
from typing import Any

from bees.pidgin import from_pidgin_string, merge_text_parts


# ---------------------------------------------------------------------------
# 1. merge_text_parts — pure function tests
# ---------------------------------------------------------------------------


class TestMergeTextParts:
    """Verify merge_text_parts behavior matches opal_backend.pidgin."""

    def test_empty_list(self) -> None:
        assert merge_text_parts([]) == []

    def test_single_text_part(self) -> None:
        parts = [{"text": "hello"}]
        assert merge_text_parts(parts) == [{"text": "hello"}]

    def test_consecutive_text_parts_merged(self) -> None:
        parts = [{"text": "hello"}, {"text": "world"}]
        result = merge_text_parts(parts)
        assert result == [{"text": "hello\nworld"}]

    def test_three_consecutive_text_parts(self) -> None:
        parts = [{"text": "a"}, {"text": "b"}, {"text": "c"}]
        result = merge_text_parts(parts)
        assert result == [{"text": "a\nb\nc"}]

    def test_non_text_parts_preserved(self) -> None:
        parts = [
            {"text": "hello"},
            {"inlineData": {"data": "abc", "mimeType": "image/png"}},
            {"text": "world"},
        ]
        result = merge_text_parts(parts)
        assert len(result) == 3
        assert result[0] == {"text": "hello"}
        assert result[1] == {"inlineData": {"data": "abc", "mimeType": "image/png"}}
        assert result[2] == {"text": "world"}

    def test_mixed_text_parts_not_merged(self) -> None:
        """Text parts with extra keys (e.g. 'thought') are not merged."""
        parts = [{"text": "hello", "thought": True}, {"text": "world"}]
        result = merge_text_parts(parts)
        assert len(result) == 2

    def test_custom_separator(self) -> None:
        parts = [{"text": "a"}, {"text": "b"}]
        result = merge_text_parts(parts, separator=" ")
        assert result == [{"text": "a b"}]

    def test_does_not_mutate_input(self) -> None:
        parts = [{"text": "hello"}, {"text": "world"}]
        original = [dict(p) for p in parts]
        merge_text_parts(parts)
        assert parts == original


# ---------------------------------------------------------------------------
# 2. from_pidgin_string — async resolution tests
# ---------------------------------------------------------------------------


class MockFileSystem:
    """Minimal mock satisfying FileSystem.get() for pidgin resolution."""

    def __init__(self, files: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self._files = files or {}

    async def get(self, path: str) -> list[dict[str, Any]] | dict[str, str]:
        if path in self._files:
            return self._files[path]
        return {"$error": f"File not found: {path}"}


class TestFromPidginString:
    """Verify from_pidgin_string behavior matches opal_backend.pidgin."""

    @pytest.mark.asyncio
    async def test_plain_text(self) -> None:
        fs = MockFileSystem()
        result = await from_pidgin_string("hello world", fs)
        assert result == {"parts": [{"text": "hello world"}], "role": "user"}

    @pytest.mark.asyncio
    async def test_empty_string(self) -> None:
        fs = MockFileSystem()
        result = await from_pidgin_string("", fs)
        assert result == {"parts": [], "role": "user"}

    @pytest.mark.asyncio
    async def test_file_tag_resolved(self) -> None:
        fs = MockFileSystem(
            files={"photo.png": [{"inlineData": {"data": "abc", "mimeType": "image/png"}}]}
        )
        result = await from_pidgin_string('<file src="photo.png" />', fs)
        assert result == {
            "parts": [{"inlineData": {"data": "abc", "mimeType": "image/png"}}],
            "role": "user",
        }

    @pytest.mark.asyncio
    async def test_file_tag_with_surrounding_text(self) -> None:
        fs = MockFileSystem(
            files={"img.png": [{"inlineData": {"data": "x", "mimeType": "image/png"}}]}
        )
        result = await from_pidgin_string(
            'Here is the image: <file src="img.png" /> and some text after.',
            fs,
        )
        assert isinstance(result, dict)
        assert "parts" in result
        parts = result["parts"]
        # Text before, inline data, text after
        assert len(parts) == 3
        assert parts[0] == {"text": "Here is the image: "}
        assert parts[1] == {"inlineData": {"data": "x", "mimeType": "image/png"}}
        assert parts[2] == {"text": " and some text after."}

    @pytest.mark.asyncio
    async def test_link_tag_extracts_title(self) -> None:
        fs = MockFileSystem()
        result = await from_pidgin_string(
            'Click <a href="/route-0">My Link</a> here.',
            fs,
        )
        assert isinstance(result, dict)
        parts = result["parts"]
        # "Click " + "My Link" + " here." — consecutive text parts merged
        assert len(parts) == 1
        assert "Click" in parts[0]["text"]
        assert "My Link" in parts[0]["text"]
        assert "here." in parts[0]["text"]

    @pytest.mark.asyncio
    async def test_file_not_found_returns_error(self) -> None:
        fs = MockFileSystem()  # No files registered
        result = await from_pidgin_string('<file src="missing.png" />', fs)
        assert isinstance(result, dict)
        assert "$error" in result

    @pytest.mark.asyncio
    async def test_multiple_file_tags(self) -> None:
        fs = MockFileSystem(
            files={
                "a.txt": [{"text": "content-a"}],
                "b.txt": [{"text": "content-b"}],
            }
        )
        result = await from_pidgin_string(
            '<file src="a.txt" /> and <file src="b.txt" />',
            fs,
        )
        assert isinstance(result, dict)
        parts = result["parts"]
        # "content-a" + " and " + "content-b" — consecutive text merged
        assert len(parts) == 1
        assert "content-a" in parts[0]["text"]
        assert "content-b" in parts[0]["text"]

    @pytest.mark.asyncio
    async def test_mixed_content(self) -> None:
        """File tags interleaved with non-text parts prevent merging."""
        fs = MockFileSystem(
            files={
                "img.png": [
                    {"inlineData": {"data": "abc", "mimeType": "image/png"}},
                ],
            }
        )
        result = await from_pidgin_string(
            'Before <file src="img.png" /> after',
            fs,
        )
        assert isinstance(result, dict)
        parts = result["parts"]
        assert len(parts) == 3
        assert parts[0]["text"] == "Before "
        assert "inlineData" in parts[1]
        assert parts[2]["text"] == " after"


# ---------------------------------------------------------------------------
# 3. Conformance: bees' output matches opal_backend's output
# ---------------------------------------------------------------------------


class TestOpalConformance:
    """Verify bees.pidgin produces identical output to opal_backend.pidgin."""

    @pytest.mark.asyncio
    async def test_from_pidgin_string_matches_opal(self) -> None:
        """Both implementations produce the same output for identical inputs."""
        from opal_backend.pidgin import (
            from_pidgin_string as opal_from_pidgin_string,
        )

        fs = MockFileSystem(
            files={
                "photo.png": [
                    {"inlineData": {"data": "abc", "mimeType": "image/png"}},
                ],
                "doc.txt": [{"text": "document content"}],
            }
        )

        cases = [
            "plain text",
            '<file src="photo.png" />',
            '<file src="doc.txt" />',
            'Before <file src="photo.png" /> after',
            '<a href="/route-0">My Link</a>',
            'Text with <a href="/r">link</a> and <file src="doc.txt" /> mixed.',
            '<file src="nonexistent.png" />',
        ]

        for content in cases:
            bees_result = await from_pidgin_string(content, fs)
            opal_result = await opal_from_pidgin_string(content, fs)
            assert bees_result == opal_result, (
                f"Mismatch for input: {content!r}\n"
                f"  bees: {bees_result}\n"
                f"  opal: {opal_result}"
            )

    def test_merge_text_parts_matches_opal(self) -> None:
        """Both merge implementations produce identical output."""
        from opal_backend.pidgin import (
            merge_text_parts as opal_merge_text_parts,
        )

        cases = [
            [],
            [{"text": "hello"}],
            [{"text": "a"}, {"text": "b"}, {"text": "c"}],
            [{"text": "a"}, {"inlineData": {"data": "x"}}, {"text": "b"}],
            [{"text": "a", "thought": True}, {"text": "b"}],
        ]

        for parts in cases:
            bees_result = merge_text_parts(parts)
            opal_result = opal_merge_text_parts(parts)
            assert bees_result == opal_result, (
                f"Mismatch for input: {parts!r}"
            )

    def test_regex_patterns_match_opal(self) -> None:
        """Bees' regex patterns produce the same splits as opal's."""
        from bees.pidgin import _SPLIT_REGEX, _FILE_PARSE_REGEX, _LINK_PARSE_REGEX
        from opal_backend.pidgin import (
            _SPLIT_REGEX as opal_SPLIT,
            _FILE_PARSE_REGEX as opal_FILE,
            _LINK_PARSE_REGEX as opal_LINK,
        )

        test_strings = [
            'plain text',
            '<file src="test.png" />',
            '<a href="/route">title</a>',
            'mixed <file src="a.png" /> text <a href="/b">link</a> end',
            '<file  src = "spaced.png"  />',
        ]

        for s in test_strings:
            assert _SPLIT_REGEX.split(s) == opal_SPLIT.split(s), (
                f"SPLIT mismatch for: {s!r}"
            )

        file_strings = [
            '<file src="test.png" />',
            '<file  src = "spaced.png"  />',
            'not a file tag',
        ]
        for s in file_strings:
            bees_m = _FILE_PARSE_REGEX.match(s)
            opal_m = opal_FILE.match(s)
            assert (bees_m is not None) == (opal_m is not None), (
                f"FILE match mismatch for: {s!r}"
            )
            if bees_m and opal_m:
                assert bees_m.group(1) == opal_m.group(1)

        link_strings = [
            '<a href="/route">title</a>',
            '<a  href = "/r"  > spaced </a>',
            'not a link',
        ]
        for s in link_strings:
            bees_m = _LINK_PARSE_REGEX.match(s)
            opal_m = opal_LINK.match(s)
            assert (bees_m is not None) == (opal_m is not None), (
                f"LINK match mismatch for: {s!r}"
            )
            if bees_m and opal_m:
                assert bees_m.group(1) == opal_m.group(1)
                assert bees_m.group(2).strip() == opal_m.group(2).strip()
