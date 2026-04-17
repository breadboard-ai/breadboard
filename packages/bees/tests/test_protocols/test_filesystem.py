# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for bees.protocols.filesystem.

Verifies that:
1. Bees-native types work correctly (FileDescriptor, FileSystemSnapshot).
2. ``file_descriptor_to_part`` converts all descriptor types.
3. ``DiskFileSystem`` satisfies the bees ``FileSystem`` protocol.
4. opal_backend's concrete types structurally match the bees-native shapes.
5. Minimal mocks satisfy the ``FileSystem`` protocol.

See ``spec/filesystem.md`` for context.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from bees.protocols.filesystem import (
    DEFAULT_EXTENSION,
    DEFAULT_MIME_TYPE,
    KNOWN_TYPES,
    FileDescriptor,
    FileSystem,
    FileSystemSnapshot,
    SystemFileGetter,
    file_descriptor_to_part,
)


# ---------------------------------------------------------------------------
# 1. Bees-native types work correctly
# ---------------------------------------------------------------------------


class TestFileDescriptor:
    """FileDescriptor dataclass works as expected."""

    def test_text_descriptor(self) -> None:
        fd = FileDescriptor(data="hello", mime_type="text/plain", type="text")
        assert fd.data == "hello"
        assert fd.mime_type == "text/plain"
        assert fd.type == "text"
        assert fd.title is None
        assert fd.resource_key is None

    def test_inline_data_descriptor(self) -> None:
        fd = FileDescriptor(
            data="base64data",
            mime_type="image/png",
            type="inlineData",
            title="screenshot.png",
        )
        assert fd.title == "screenshot.png"

    def test_file_data_descriptor_with_resource_key(self) -> None:
        fd = FileDescriptor(
            data="gs://bucket/file",
            mime_type="application/pdf",
            type="fileData",
            resource_key="abc123",
        )
        assert fd.resource_key == "abc123"


class TestFileSystemSnapshot:
    """FileSystemSnapshot dataclass works as expected."""

    def test_snapshot_construction(self) -> None:
        fd = FileDescriptor(data="x", mime_type="text/plain", type="text")
        snap = FileSystemSnapshot(
            files={"test.txt": fd},
            routes={"": "", "/": "/"},
            file_count=1,
        )
        assert len(snap.files) == 1
        assert snap.file_count == 1
        assert snap.routes == {"": "", "/": "/"}


class TestConstants:
    """Constants have the expected values."""

    def test_known_types(self) -> None:
        assert KNOWN_TYPES == ["audio", "video", "image", "text"]

    def test_default_extension(self) -> None:
        assert DEFAULT_EXTENSION == "txt"

    def test_default_mime_type(self) -> None:
        assert DEFAULT_MIME_TYPE == "text/plain"


# ---------------------------------------------------------------------------
# 2. file_descriptor_to_part converts all descriptor types
# ---------------------------------------------------------------------------


class TestFileDescriptorToPart:
    """``file_descriptor_to_part`` produces correct Gemini data parts."""

    def test_text_part(self) -> None:
        fd = FileDescriptor(data="hello world", mime_type="text/plain", type="text")
        part = file_descriptor_to_part(fd)
        assert part == {"text": "hello world"}

    def test_inline_data_part(self) -> None:
        fd = FileDescriptor(
            data="base64==", mime_type="image/png", type="inlineData",
        )
        part = file_descriptor_to_part(fd)
        assert part == {
            "inlineData": {"data": "base64==", "mimeType": "image/png"},
        }

    def test_inline_data_with_title(self) -> None:
        fd = FileDescriptor(
            data="base64==",
            mime_type="image/png",
            type="inlineData",
            title="photo.png",
        )
        part = file_descriptor_to_part(fd)
        assert part["inlineData"]["title"] == "photo.png"

    def test_file_data_part(self) -> None:
        fd = FileDescriptor(
            data="gs://bucket/file.pdf",
            mime_type="application/pdf",
            type="fileData",
        )
        part = file_descriptor_to_part(fd)
        assert part == {
            "fileData": {
                "fileUri": "gs://bucket/file.pdf",
                "mimeType": "application/pdf",
            },
        }

    def test_file_data_with_resource_key(self) -> None:
        fd = FileDescriptor(
            data="gs://bucket/file.pdf",
            mime_type="application/pdf",
            type="fileData",
            resource_key="key123",
        )
        part = file_descriptor_to_part(fd)
        assert part["fileData"]["resourceKey"] == "key123"

    def test_stored_data_part(self) -> None:
        fd = FileDescriptor(
            data="handle-abc",
            mime_type="video/mp4",
            type="storedData",
        )
        part = file_descriptor_to_part(fd)
        assert part == {
            "storedData": {
                "handle": "handle-abc",
                "mimeType": "video/mp4",
            },
        }

    def test_stored_data_with_resource_key(self) -> None:
        fd = FileDescriptor(
            data="handle-abc",
            mime_type="video/mp4",
            type="storedData",
            resource_key="rk456",
        )
        part = file_descriptor_to_part(fd)
        assert part["storedData"]["resourceKey"] == "rk456"


# ---------------------------------------------------------------------------
# 3. DiskFileSystem satisfies the bees FileSystem protocol
# ---------------------------------------------------------------------------


class TestDiskFileSystemConformance:
    """DiskFileSystem structurally satisfies bees' FileSystem protocol."""

    def test_isinstance_check(self, tmp_path: Path) -> None:
        from bees.disk_file_system import DiskFileSystem

        fs = DiskFileSystem(tmp_path)
        assert isinstance(fs, FileSystem)


# ---------------------------------------------------------------------------
# 4. opal_backend types structurally match bees-native shapes
# ---------------------------------------------------------------------------


class TestOpalBackendConformance:
    """Verifies that opal_backend's types have the same fields as bees' types.

    This is the conformance gate: if these tests pass, migrating
    ``disk_file_system.py`` from ``opal_backend.file_system_protocol``
    to ``bees.protocols.filesystem`` is a safe import rewrite.
    """

    def test_file_descriptor_fields_match(self) -> None:
        from opal_backend.file_system_protocol import (
            FileDescriptor as OpalFileDescriptor,
        )

        bees_fields = {
            f.name for f in FileDescriptor.__dataclass_fields__.values()
        }
        opal_fields = {
            f.name for f in OpalFileDescriptor.__dataclass_fields__.values()
        }
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_file_system_snapshot_fields_match(self) -> None:
        from opal_backend.file_system_protocol import (
            FileSystemSnapshot as OpalFileSystemSnapshot,
        )

        bees_fields = {
            f.name
            for f in FileSystemSnapshot.__dataclass_fields__.values()
        }
        opal_fields = {
            f.name
            for f in OpalFileSystemSnapshot.__dataclass_fields__.values()
        }
        assert bees_fields == opal_fields, (
            f"Field mismatch — bees: {bees_fields - opal_fields}, "
            f"opal: {opal_fields - bees_fields}"
        )

    def test_file_system_protocol_methods_match(self) -> None:
        """Bees' FileSystem protocol has the same methods as opal's."""
        from opal_backend.file_system_protocol import (
            FileSystem as OpalFileSystem,
        )

        def _protocol_members(cls: type) -> set[str]:
            return {
                name
                for name in dir(cls)
                if not name.startswith("_")
                and name not in ("register",)  # Protocol internals
            }

        bees_members = _protocol_members(FileSystem)
        opal_members = _protocol_members(OpalFileSystem)
        assert bees_members == opal_members, (
            f"Method mismatch — bees only: {bees_members - opal_members}, "
            f"opal only: {opal_members - bees_members}"
        )

    def test_constants_match(self) -> None:
        from opal_backend.file_system_protocol import (
            DEFAULT_EXTENSION as OPAL_DEFAULT_EXTENSION,
            DEFAULT_MIME_TYPE as OPAL_DEFAULT_MIME_TYPE,
            KNOWN_TYPES as OPAL_KNOWN_TYPES,
        )

        assert KNOWN_TYPES == OPAL_KNOWN_TYPES
        assert DEFAULT_EXTENSION == OPAL_DEFAULT_EXTENSION
        assert DEFAULT_MIME_TYPE == OPAL_DEFAULT_MIME_TYPE

    def test_file_descriptor_to_part_matches(self) -> None:
        """Both implementations produce the same output for the same input."""
        from opal_backend.file_system_protocol import (
            FileDescriptor as OpalFileDescriptor,
            file_descriptor_to_part as opal_file_descriptor_to_part,
        )

        cases = [
            ("hello", "text/plain", "text", None, None),
            ("base64==", "image/png", "inlineData", "photo.png", None),
            ("gs://b/f", "application/pdf", "fileData", None, "key1"),
            ("handle", "video/mp4", "storedData", None, "rk2"),
        ]

        for data, mime, ftype, title, rkey in cases:
            bees_fd = FileDescriptor(
                data=data, mime_type=mime, type=ftype,
                title=title, resource_key=rkey,
            )
            opal_fd = OpalFileDescriptor(
                data=data, mime_type=mime, type=ftype,
                title=title, resource_key=rkey,
            )
            assert file_descriptor_to_part(bees_fd) == opal_file_descriptor_to_part(opal_fd), (
                f"Output mismatch for type={ftype}"
            )


# ---------------------------------------------------------------------------
# 5. Minimal mocks satisfy the FileSystem protocol
# ---------------------------------------------------------------------------


class TestFileSystemMock:
    """A minimal mock satisfies the ``FileSystem`` protocol."""

    def test_mock_satisfies_protocol(self) -> None:
        class MockFileSystem:
            def add_system_file(self, path: str, getter: SystemFileGetter) -> None:
                pass

            def overwrite(self, name: str, data: str) -> str:
                return name

            def write(self, name: str, data: str) -> str:
                return name

            def append(self, path: str, data: str) -> dict[str, str] | None:
                return None

            async def read_text(self, path: str) -> str | dict[str, str]:
                return ""

            async def get(self, path: str) -> list[dict[str, Any]] | dict[str, str]:
                return [{"text": ""}]

            async def get_many(
                self, paths: list[str],
            ) -> list[dict[str, Any]] | dict[str, str]:
                return []

            async def list_files(self) -> str:
                return ""

            def get_file_url(self, maybe_path: str) -> str | None:
                return None

            def add_part(
                self, part: dict[str, Any], file_name: str | None = None,
            ) -> str | dict[str, str]:
                return "file.txt"

            def add_route(self, original_route: str) -> str:
                return "/route-0"

            def get_original_route(self, route_name: str) -> str | dict[str, str]:
                return ""

            @property
            def files(self) -> dict[str, FileDescriptor]:
                return {}

            @property
            def snapshot(self) -> FileSystemSnapshot:
                return FileSystemSnapshot(files={}, routes={}, file_count=0)

        assert isinstance(MockFileSystem(), FileSystem)
