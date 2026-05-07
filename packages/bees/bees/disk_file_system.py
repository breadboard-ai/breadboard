# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Disk-backed file system for bees agent sessions.

Satisfies the ``FileSystem`` protocol by reading and writing directly
to a working directory on disk.  Paths are relative to ``work_dir`` —
no ``/mnt/`` prefix.

This replaces the in-memory ``AgentFileSystem`` + bidirectional sync
hacks that previously bridged the virtual FS with the bash sandbox.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import mimetypes
from pathlib import Path
from typing import Any

from bees.protocols.filesystem import (
    FileDescriptor,
    FileSystemSnapshot,
    SystemFileGetter,
    DEFAULT_EXTENSION,
    DEFAULT_MIME_TYPE,
    KNOWN_TYPES,
)

__all__ = ["DiskFileSystem"]

logger = logging.getLogger(__name__)

_BINARY_SNIFF_BYTES = 8 * 1024  # scan first 8 KB for null bytes
_SKIP_DIRS = {"node_modules", "__pycache__"}
_MNT_PREFIX = "/mnt/"


def _is_binary(path: Path) -> bool:
    """Return True if the file looks like non-text binary data."""
    try:
        chunk = path.read_bytes()[:_BINARY_SNIFF_BYTES]
        return b"\x00" in chunk
    except OSError:
        return False


def _strip_mnt(path: str) -> str:
    """Strip the ``/mnt/`` prefix from a path if present.

    Callers in opal-backend use ``/mnt/system/…`` constants.
    DiskFileSystem stores everything with bare relative paths.
    """
    if path.startswith(_MNT_PREFIX):
        return path[len(_MNT_PREFIX):]
    return path


class DiskFileSystem:
    """Disk-backed agent file system.

    All file I/O targets ``work_dir`` directly.  Paths supplied by the
    agent (``write("notes.md", …)``) map to ``work_dir/notes.md``.

    Virtual namespaces (system files) use the same getter pattern as
    ``AgentFileSystem``.  Routes are held in memory (transient per
    session).
    """

    def __init__(self, work_dir: Path) -> None:
        self._work_dir = work_dir
        self._work_dir.mkdir(parents=True, exist_ok=True)
        self._system_files: dict[str, SystemFileGetter] = {}
        self._routes: dict[str, str] = {"": "", "/": "/"}
        self._file_count = 0
        self._logger = logging.getLogger(__name__)

    # ---- Public API ----

    def add_system_file(self, path: str, getter: SystemFileGetter) -> None:
        """Register a virtual system file backed by a getter function.

        Normalizes ``/mnt/``-prefixed paths to bare relative paths so
        callers in opal-backend (which use the legacy path constant)
        work transparently.
        """
        self._system_files[_strip_mnt(path)] = getter

    def overwrite(self, name: str, data: str) -> str:
        """Write (or overwrite) a named text file.  Returns the path."""
        path, _ = self._resolve_write(name)
        disk_path = self._work_dir / path
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        disk_path.write_text(data, encoding="utf-8")
        return path

    def write(self, name: str, data: str) -> str:
        """Write a named file.  Returns the path.

        Warns if the file already exists.
        """
        path, _ = self._resolve_write(name)
        disk_path = self._work_dir / path
        if disk_path.exists():
            self._logger.warning('File "%s" already exists, will be overwritten', path)
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        disk_path.write_text(data, encoding="utf-8")
        return path

    def append(self, path: str, data: str) -> dict[str, str] | None:
        """Append data to an existing text file, or create it.

        Returns ``None`` on success, or an error dict on failure.
        """
        disk_path = self._work_dir / path
        if disk_path.exists():
            if _is_binary(disk_path):
                return {"$error": f'File "{path}" already exists and is not a text file'}
            existing = disk_path.read_text(encoding="utf-8", errors="replace")
            disk_path.write_text(f"{existing}\n{data}", encoding="utf-8")
        else:
            disk_path.parent.mkdir(parents=True, exist_ok=True)
            disk_path.write_text(data, encoding="utf-8")
        return None

    async def read_text(self, path: str) -> str | dict[str, str]:
        """Read the text content of a file.

        Returns the text string, or an error dict if the file is not found
        or is not a text file.
        """
        parts = await self.get(path)
        if isinstance(parts, dict):
            return parts  # error

        texts: list[str] = []
        for part in parts:
            if "text" in part:
                texts.append(part["text"])
            else:
                return {"$error": f"File at {path} is not a text file"}
        return "\n".join(texts)

    async def get(self, path: str) -> list[dict[str, Any]] | dict[str, str]:
        """Get the data parts for a file path.

        Returns a list of Gemini data parts, or an error dict.
        """
        normalized = _strip_mnt(path)

        # Check system files first.
        if normalized in self._system_files:
            return self._get_system_file(normalized)

        disk_path = self._work_dir / normalized
        if not disk_path.is_file():
            return {"$error": f'file "{path}" not found'}

        if _is_binary(disk_path):
            mime_type, _ = mimetypes.guess_type(disk_path.name)
            mime_type = mime_type or "application/octet-stream"
            raw = disk_path.read_bytes()
            data = base64.b64encode(raw).decode("ascii")
            return [{"inlineData": {"data": data, "mimeType": mime_type}}]

        content = disk_path.read_text(encoding="utf-8", errors="replace")
        return [{"text": content}]

    async def get_many(
        self, paths: list[str],
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Get data parts for multiple file paths."""
        errors: list[str] = []
        parts: list[dict[str, Any]] = []
        for path in paths:
            result = await self.get(path)
            if isinstance(result, dict):
                if "$error" in result:
                    errors.append(result["$error"])
                continue
            parts.extend(result)
        if errors:
            return {"$error": ",".join(errors)}
        return parts

    async def list_files(self) -> str:
        """List all files as newline-separated paths."""
        all_paths: list[str] = []

        # Walk disk files.
        for disk_path in self._work_dir.rglob("*"):
            if not disk_path.is_file():
                continue
            rel = disk_path.relative_to(self._work_dir)
            if any(
                part.startswith(".") or part in _SKIP_DIRS
                for part in rel.parts
            ):
                continue
            all_paths.append(str(rel))

        # Include system file paths.
        all_paths.extend(self._system_files.keys())

        return "\n".join(sorted(all_paths))

    def get_file_url(self, maybe_path: str) -> str | None:
        """Get the URL for a file path, if it has a displayable URL.

        Disk-backed files don't have URLs in the Opal sense.
        Returns ``None`` always.
        """
        return None

    def add_part(
        self, part: dict[str, Any], file_name: str | None = None,
    ) -> str | dict[str, str]:
        """Add a data part to the file system.  Returns the path or error dict.

        Supports ``text``, ``inlineData``, ``storedData``, ``fileData`` parts.
        Text and inlineData are written to disk.  StoredData and fileData
        are stored as metadata sidecar files (not applicable to bees).
        """
        if "text" in part:
            name = file_name or self._auto_name("text/markdown")
            disk_path = self._work_dir / name
            disk_path.parent.mkdir(parents=True, exist_ok=True)
            disk_path.write_text(part["text"], encoding="utf-8")
            return name

        if "inlineData" in part:
            inline = part["inlineData"]
            mime_type = inline.get("mimeType", DEFAULT_MIME_TYPE)
            name = file_name or self._auto_name(mime_type)
            if not file_name:
                ext = mimetypes.guess_extension(mime_type) or f".{DEFAULT_EXTENSION}"
                ext = ext.lstrip(".")
                if "." not in name:
                    name = f"{name}.{ext}"
            disk_path = self._work_dir / name
            disk_path.parent.mkdir(parents=True, exist_ok=True)
            raw = base64.b64decode(inline.get("data", ""))
            disk_path.write_bytes(raw)
            return name

        if "storedData" in part or "fileData" in part:
            # Remote references — not applicable to bees disk FS but
            # we accept them to satisfy the protocol.
            key = "storedData" if "storedData" in part else "fileData"
            data = part[key]
            mime_type = data.get("mimeType", DEFAULT_MIME_TYPE)
            name = file_name or self._auto_name(mime_type)
            # Store as a JSON sidecar with the reference.
            disk_path = self._work_dir / f"{name}.ref.json"
            disk_path.parent.mkdir(parents=True, exist_ok=True)
            import json
            disk_path.write_text(json.dumps(part, indent=2), encoding="utf-8")
            return name

        return {"$error": f"Unsupported part: {part}"}

    # ---- Route mapping ----

    def add_route(self, original_route: str) -> str:
        """Register a route and return its pidgin name."""
        route_name = f"/route-{len(self._routes) - 1}"
        self._routes[route_name] = original_route
        return route_name

    def get_original_route(self, route_name: str) -> str | dict[str, str]:
        """Look up the original route for a pidgin route name."""
        original = self._routes.get(route_name)
        if original is None:
            return {"$error": f'Route "{route_name}" not found'}
        return original

    # ---- Properties ----

    @property
    def files(self) -> dict[str, FileDescriptor]:
        """Read disk files into a dict of FileDescriptor objects.

        This is on the read path for ``system_objective_fulfilled``
        which collects intermediate files.  The returned dict uses
        relative paths as keys (no ``/mnt/`` prefix).
        """
        result: dict[str, FileDescriptor] = {}

        for disk_path in self._work_dir.rglob("*"):
            if not disk_path.is_file():
                continue
            rel = disk_path.relative_to(self._work_dir)
            if any(
                part.startswith(".") or part in _SKIP_DIRS
                for part in rel.parts
            ):
                continue
            path = str(rel)

            if _is_binary(disk_path):
                mime_type, _ = mimetypes.guess_type(disk_path.name)
                mime_type = mime_type or "application/octet-stream"
                raw = disk_path.read_bytes()
                data = base64.b64encode(raw).decode("ascii")
                result[path] = FileDescriptor(
                    data=data,
                    mime_type=mime_type,
                    type="inlineData",
                )
            else:
                try:
                    content = disk_path.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                mime_type, _ = mimetypes.guess_type(disk_path.name)
                mime_type = mime_type or DEFAULT_MIME_TYPE
                result[path] = FileDescriptor(
                    data=content,
                    mime_type=mime_type,
                    type="text",
                )

        return result

    @property
    def snapshot(self) -> FileSystemSnapshot:
        """Capture serializable state.

        For disk-backed FS, this reads all files into memory — intended
        only for suspend/resume compatibility.  In practice, bees should
        pass ``file_system=None`` on the InteractionState and reconstruct
        a fresh ``DiskFileSystem`` on resume.
        """
        files = self.files
        return FileSystemSnapshot(
            files=files,
            routes=dict(self._routes),
            file_count=len(files),
        )

    def hydrate_from_snapshot(self, snapshot: FileSystemSnapshot) -> None:
        """Hydrate the disk workspace from a snapshot.

        Clears any existing files on disk before writing snapshot files.
        """
        # Clear existing files on disk (excluding hidden files or skipped directories)
        if self._work_dir.exists():
            for item in self._work_dir.rglob("*"):
                if item.is_file():
                    rel = item.relative_to(self._work_dir)
                    if not any(part.startswith(".") or part in _SKIP_DIRS for part in rel.parts):
                        item.unlink(missing_ok=True)

            # Clean up empty directories
            for item in sorted(self._work_dir.rglob("*"), key=lambda p: len(p.parts), reverse=True):
                if item.is_dir():
                    try:
                        item.rmdir()
                    except OSError:
                        pass  # skip if not empty

        # Re-create files from snapshot
        for path, desc in snapshot.files.items():
            disk_path = self._work_dir / path
            disk_path.parent.mkdir(parents=True, exist_ok=True)

            if desc.type == "inlineData":
                raw = base64.b64decode(desc.data)
                disk_path.write_bytes(raw)
            else:
                disk_path.write_text(desc.data, encoding="utf-8")

        # Restore memory state
        self._routes = dict(snapshot.routes)
        self._file_count = snapshot.file_count

    # ---- Private helpers ----

    def _resolve_write(self, name: str) -> tuple[str, str]:
        """Resolve a name to a (relative_path, mime_type) tuple.

        Ensures the name has an extension.
        """
        ext = name.rsplit(".", 1)[-1] if "." in name else None
        mime_type = (
            mimetypes.types_map.get(f".{ext}", DEFAULT_MIME_TYPE)
            if ext
            else DEFAULT_MIME_TYPE
        )
        filename = name if ext else f"{name}.{DEFAULT_EXTENSION}"
        return filename, mime_type

    def _auto_name(self, mime_type: str) -> str:
        """Generate an auto-incrementing filename for the given MIME type."""
        self._file_count += 1
        first = mime_type.split("/")[0] if "/" in mime_type else ""
        name = first if first in KNOWN_TYPES else "file"
        ext = mimetypes.guess_extension(mime_type) or f".{DEFAULT_EXTENSION}"
        ext = ext.lstrip(".")
        return f"{name}{self._file_count}.{ext}"

    def _get_system_file(
        self, path: str,
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Get content from a registered system file."""
        getter = self._system_files.get(path)
        if getter is None:
            return {"$error": f"File {path} was not found"}
        result = getter()
        if isinstance(result, dict):
            return result  # error
        return [{"text": result}]
