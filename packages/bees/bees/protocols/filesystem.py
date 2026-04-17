# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees-native FileSystem protocol and supporting types.

These mirror the shapes in ``opal_backend.file_system_protocol`` so that
``DiskFileSystem`` can import from here instead. Python's structural
subtyping means opal_backend's concrete types satisfy these definitions
without modification.

See ``spec/filesystem.md`` for design rationale.
"""

from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from typing import Any, Callable, Protocol, runtime_checkable

# ---------------------------------------------------------------------------
# MIME type registration
# ---------------------------------------------------------------------------

# Ensure common MIME types are registered — mirrors the side effect in
# opal_backend.file_system_protocol.
mimetypes.add_type("text/markdown", ".md")
mimetypes.add_type("text/csv", ".csv")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KNOWN_TYPES = ["audio", "video", "image", "text"]
DEFAULT_EXTENSION = "txt"
DEFAULT_MIME_TYPE = "text/plain"

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

SystemFileGetter = Callable[[], str | dict[str, str]]
"""A callable that returns file content or an error dict."""

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class FileDescriptor:
    """Describes a file stored in an agent file system."""

    data: str
    mime_type: str
    type: str  # "text", "inlineData", "fileData", "storedData"
    title: str | None = None
    resource_key: str | None = None


@dataclass
class FileSystemSnapshot:
    """Serializable snapshot of file system state.

    Contains everything needed to reconstruct a file system from
    persisted state. For disk-backed implementations this is a
    point-in-time capture of what's on disk.

    Transient state (system file getters) is re-attached by the caller
    after reconstruction.
    """

    files: dict[str, FileDescriptor]
    routes: dict[str, str]
    file_count: int


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def file_descriptor_to_part(file: FileDescriptor) -> dict[str, Any]:
    """Convert a FileDescriptor to a Gemini data part dict.

    Handles ``fileData``, ``inlineData``, ``storedData``, and text types.
    """
    if file.type == "fileData":
        return {
            "fileData": {
                "fileUri": file.data,
                "mimeType": file.mime_type,
                **(
                    {"resourceKey": file.resource_key}
                    if file.resource_key
                    else {}
                ),
            }
        }
    if file.type == "inlineData":
        return {
            "inlineData": {
                "data": file.data,
                "mimeType": file.mime_type,
                **({"title": file.title} if file.title else {}),
            }
        }
    if file.type == "storedData":
        return {
            "storedData": {
                "handle": file.data,
                "mimeType": file.mime_type,
                **(
                    {"resourceKey": file.resource_key}
                    if file.resource_key
                    else {}
                ),
            }
        }
    # Default: text
    return {"text": file.data}


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class FileSystem(Protocol):
    """Protocol for agent file systems — in-memory or disk-backed.

    Consumers should depend on this protocol, not on a concrete class.
    """

    def add_system_file(self, path: str, getter: SystemFileGetter) -> None:
        """Register a virtual system file backed by a getter function."""
        ...

    def overwrite(self, name: str, data: str) -> str:
        """Write (or overwrite) a named text file. Returns the path."""
        ...

    def write(self, name: str, data: str) -> str:
        """Write a named file. Returns the path."""
        ...

    def append(self, path: str, data: str) -> dict[str, str] | None:
        """Append data to an existing text file, or create it.

        Returns ``None`` on success, or an error dict on failure.
        """
        ...

    async def read_text(self, path: str) -> str | dict[str, str]:
        """Read the text content of a file.

        Returns the text string, or an error dict if not found / not text.
        """
        ...

    async def get(self, path: str) -> list[dict[str, Any]] | dict[str, str]:
        """Get the data parts for a file path.

        Returns a list of Gemini data parts, or an error dict.
        """
        ...

    async def get_many(
        self, paths: list[str],
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Get data parts for multiple file paths.

        Returns all parts, or an error dict with joined errors.
        """
        ...

    async def list_files(self) -> str:
        """List all files as newline-separated paths."""
        ...

    def get_file_url(self, maybe_path: str) -> str | None:
        """Get the URL for a file path, if it has a displayable URL.

        Returns ``None`` for text files or unknown paths.
        """
        ...

    def add_part(
        self, part: dict[str, Any], file_name: str | None = None,
    ) -> str | dict[str, str]:
        """Add a data part to the file system. Returns the path or error dict."""
        ...

    def add_route(self, original_route: str) -> str:
        """Register a route and return its pidgin name."""
        ...

    def get_original_route(self, route_name: str) -> str | dict[str, str]:
        """Look up the original route for a pidgin route name."""
        ...

    @property
    def files(self) -> dict[str, FileDescriptor]:
        """Read-only access to all stored files."""
        ...

    @property
    def snapshot(self) -> FileSystemSnapshot:
        """Capture serializable state."""
        ...
