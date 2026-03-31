# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
In-memory virtual file system for the agent loop.

Port of ``visual-editor/src/a2/agent/file-system.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Provides a simple
``/mnt/``-prefixed virtual file system that the agent uses to store and
retrieve files during execution. Files are keyed by path and stored as
``FileDescriptor`` dicts.

When a ``SheetManager`` is attached via ``set_sheet_manager()``, paths
starting with ``/mnt/memory/`` are resolved to Google Sheets data.
"""

from __future__ import annotations

import json
import logging
import mimetypes
from typing import TYPE_CHECKING, Any, cast

from .file_system_protocol import (
    FileDescriptor,
    FileSystemSnapshot,
    SystemFileGetter,
    file_descriptor_to_part,
    DEFAULT_EXTENSION,
    DEFAULT_MIME_TYPE,
    KNOWN_TYPES,
)

if TYPE_CHECKING:
    from .sheet_manager import SheetManager

# Re-export for backward compatibility — existing code imports these
# from agent_file_system.
__all__ = [
    "AgentFileSystem",
    "FileDescriptor",
    "FileSystemSnapshot",
    "SystemFileGetter",
]


class AgentFileSystem:
    """In-memory virtual file system with ``/mnt/`` paths.

    Files are stored as ``FileDescriptor`` entries keyed by path.
    Auto-generated names follow the pattern ``/mnt/{type}{count}.{ext}``.
    """

    def __init__(self) -> None:
        self._file_count = 0
        self._files: dict[str, FileDescriptor] = {}
        self._routes: dict[str, str] = {"": "", "/": "/"}
        self._system_files: dict[str, SystemFileGetter] = {}
        self._sheet_manager: SheetManager | None = None
        self._logger = logging.getLogger(__name__)

    # ---- Public API ----

    def add_system_file(self, path: str, getter: SystemFileGetter) -> None:
        """Register a virtual system file backed by a getter function."""
        self._system_files[path] = getter

    def overwrite(self, name: str, data: str) -> str:
        """Write (or overwrite) a named text file. Returns the path."""
        path, mime_type = self._create_named(name)
        self._files[path] = FileDescriptor(
            data=data, mime_type=mime_type, type="text"
        )
        return path

    def write(self, name: str, data: str) -> str:
        """Write a named file. HTML files get ``inlineData`` type. Returns path.

        Warns if the file already exists.
        """
        path, mime_type = self._create_named(name, overwrite_warning=True)
        file_type = "inlineData" if mime_type == "text/html" else "text"
        self._files[path] = FileDescriptor(
            data=data, mime_type=mime_type, type=file_type
        )
        return path

    def append(self, path: str, data: str) -> dict[str, str] | None:
        """Append data to an existing text file, or create it.

        Returns ``None`` on success, or an error dict on failure.
        """
        file = self._files.get(path)
        if file is None:
            self._files[path] = FileDescriptor(
                data=data, mime_type="text/markdown", type="text"
            )
            return None
        if file.type != "text":
            return {"$error": f'File "{path}" already exists and is not a text file'}
        file.data = f"{file.data}\n{data}"
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
                return {
                    "$error": f"File at {path} is not a text file"
                }
        return "\n".join(texts)

    def _resolve_path(self, path: str) -> str:
        """Normalise an incoming file path to a canonical ``/mnt/`` form.

        Applies two fixups in order:

        1. ``mnt/foo``  → ``/mnt/foo``  (existing Gemini quirk: missing leading slash)
        2. ``foo.md``   → ``/mnt/foo.md`` (new: bare relative names, e.g. in bees context)

        Rule 2 triggers when the path contains no leading ``/`` *and* does not
        start with ``mnt/``. Subdirectory-relative paths like ``build/index.js``
        are also normalised to ``/mnt/build/index.js``.
        Absolute ``/mnt/...`` paths pass through unchanged.
        """
        if path.startswith("mnt/"):
            return f"/{path}"
        if not path.startswith("/"):
            return f"/mnt/{path}"
        return path

    async def get(self, path: str) -> list[dict[str, Any]] | dict[str, str]:
        """Get the data parts for a file path.

        Returns a list of data parts, or an error dict.
        """
        path = self._resolve_path(path)

        if path.startswith("/mnt/system/"):
            res = self._get_system_file(path)
            if not (isinstance(res, dict) and "$error" in res):
                return res

        if path.startswith("/mnt/memory/") and self._sheet_manager:
            return await self._get_memory_file(path)

        file = self._files.get(path)
        if file is None:
            return {"$error": f'file "{path}" not found'}

        return [self._file_to_part(file)]

    async def get_many(
        self, paths: list[str]
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Get data parts for multiple file paths.

        Port of ``getMany`` from ``file-system.ts``.

        Resolves all paths (even if some fail), collects all errors,
        and returns them joined by ``","``.
        """
        errors: list[str] = []
        parts: list[dict[str, Any]] = []
        for path in paths:
            result = await self.get(path)
            if isinstance(result, dict):
                if "$error" in result:
                    errors.append(result["$error"])
                continue
            parts.extend(cast(list[dict[str, Any]], result))
        if errors:
            return {"$error": ",".join(errors)}
        return parts

    async def list_files(self) -> str:
        """List all files as newline-separated paths."""
        all_paths = list(self._files.keys()) + list(self._system_files.keys())

        # Include memory sheet paths when a sheet manager is attached.
        if self._sheet_manager:
            try:
                metadata = await self._sheet_manager.get_sheet_metadata()
                sheets = metadata.get("sheets", [])
                for sheet in sheets:
                    all_paths.append(f"/mnt/memory/{sheet['name']}")
            except Exception:
                pass  # Best-effort; don't fail list_files on metadata errors.

        return "\n".join(all_paths)

    def get_file_url(self, maybe_path: str) -> str | None:
        """Get the URL for a file path, if it has a displayable URL.

        Returns ``None`` for text files or unknown paths.
        """
        file = self._files.get(maybe_path)
        if file is None:
            return None
        if file.type == "fileData":
            return file.data
        if file.type == "inlineData":
            return f"data:{file.mime_type};base64,{file.data}"
        if file.type == "storedData":
            return file.data
        return None

    def set_sheet_manager(self, manager: SheetManager) -> None:
        """Attach a SheetManager for /mnt/memory/ path resolution."""
        self._sheet_manager = manager

    async def _get_memory_file(
        self, path: str
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Resolve a /mnt/memory/{sheet_name} path via the SheetManager.

        Port of ``#getMemoryFile`` from ``file-system.ts``.
        """
        assert self._sheet_manager is not None
        sheet_name = path.replace("/mnt/memory/", "")
        text = await self._sheet_manager.read_sheet_as_text(sheet_name)
        if text is None:
            return []
        return [{"text": text}]

    # ---- Route mapping ----

    def add_route(self, original_route: str) -> str:
        """Register a route and return its pidgin name."""
        # The "- 1" is because by default we add two routes ("" and "/").
        # So newly added routes start at 1.
        route_name = f"/route-{len(self._routes) - 1}"
        self._routes[route_name] = original_route
        return route_name

    def get_original_route(self, route_name: str) -> str | dict[str, str]:
        """Look up the original route for a pidgin route name.

        Returns the original route string, or an error dict.
        """
        original = self._routes.get(route_name)
        if original is None:
            return {"$error": f'Route "{route_name}" not found'}
        return original

    # ---- Snapshot / restore ----

    @property
    def snapshot(self) -> FileSystemSnapshot:
        """Capture serializable state."""
        return FileSystemSnapshot(
            files=dict(self._files),
            routes=dict(self._routes),
            file_count=self._file_count,
        )

    @classmethod
    def from_snapshot(cls, snap: FileSystemSnapshot) -> "AgentFileSystem":
        """Construct a live instance from a snapshot.

        Transient state (system files, sheet manager) must be re-attached
        by the caller.
        """
        fs = cls()
        fs._files = dict(snap.files)
        fs._routes = dict(snap.routes)
        fs._file_count = snap.file_count
        return fs

    # ---- File access (read-only) ----

    @property
    def files(self) -> dict[str, FileDescriptor]:
        """Read-only access to all stored files."""
        return dict(self._files)

    def restore_from(self, files: dict[str, dict[str, Any]]) -> None:
        """Restore file system state from a saved snapshot."""
        self._files.clear()
        for path, descriptor in files.items():
            self._files[path] = FileDescriptor(
                data=descriptor["data"],
                mime_type=descriptor["mime_type"],
                type=descriptor["type"],
                title=descriptor.get("title"),
                resource_key=descriptor.get("resource_key"),
            )
        self._file_count = len(self._files)

    # ---- File creation helpers ----

    def add_part(
        self, part: dict[str, Any], file_name: str | None = None
    ) -> str | dict[str, str]:
        """Add a data part to the file system. Returns the path or error dict.

        Supports ``text``, ``inlineData``, ``storedData``, ``fileData`` parts.
        """
        if "text" in part:
            mime_type = "text/markdown"
            name = self._create_path(mime_type, file_name)
            self._files[name] = FileDescriptor(
                data=part["text"], mime_type=mime_type, type="text"
            )
            return name

        if "inlineData" in part:
            inline = part["inlineData"]
            mime_type = inline.get("mimeType", DEFAULT_MIME_TYPE)
            name = self._create_path(mime_type, file_name)
            self._files[name] = FileDescriptor(
                data=inline["data"],
                mime_type=mime_type,
                type="inlineData",
                title=inline.get("title"),
            )
            return name

        if "storedData" in part:
            stored = part["storedData"]
            mime_type = stored.get("mimeType", DEFAULT_MIME_TYPE)
            existing = self._find_existing_by_handle(stored["handle"])
            if existing:
                return existing
            name = self._create_path(mime_type, file_name)
            self._files[name] = FileDescriptor(
                data=stored["handle"],
                mime_type=mime_type,
                type="storedData",
                resource_key=stored.get("resourceKey"),
            )
            return name

        if "fileData" in part:
            file_data = part["fileData"]
            mime_type = file_data.get("mimeType", DEFAULT_MIME_TYPE)
            existing = self._find_existing_by_handle(file_data["fileUri"])
            if existing:
                return existing
            name = self._create_path(mime_type, file_name)
            self._files[name] = FileDescriptor(
                data=file_data["fileUri"],
                mime_type=mime_type,
                type="fileData",
                resource_key=file_data.get("resourceKey"),
            )
            return name

        return {"$error": f"Unsupported part: {part}"}

    def create(self, mime_type: str) -> str:
        """Create a new auto-named path for the given MIME type."""
        self._file_count += 1
        name = self._get_type_name(mime_type)
        ext = mimetypes.guess_extension(mime_type) or f".{DEFAULT_EXTENSION}"
        # Remove leading dot from extension
        ext = ext.lstrip(".")
        return f"/mnt/{name}{self._file_count}.{ext}"

    # ---- Private helpers ----

    def _create_named(
        self, name: str, overwrite_warning: bool = False
    ) -> tuple[str, str]:
        """Create a named path. Returns (path, mime_type)."""
        ext = name.rsplit(".", 1)[-1] if "." in name else None
        mime_type = (
            mimetypes.types_map.get(f".{ext}", DEFAULT_MIME_TYPE)
            if ext
            else DEFAULT_MIME_TYPE
        )
        filename = name if ext else f"{name}.{DEFAULT_EXTENSION}"
        path = f"/mnt/{filename}"
        if overwrite_warning and path in self._files:
            print(f'Warning: File "{path}" already exists, will be overwritten')
        return path, mime_type

    def _create_path(
        self, mime_type: str, file_name: str | None = None
    ) -> str:
        """Create a path, either from an explicit name or auto-generated."""
        if file_name:
            has_extension = "." in file_name
            if has_extension:
                name = file_name
            else:
                ext = mimetypes.guess_extension(mime_type) or f".{DEFAULT_EXTENSION}"
                ext = ext.lstrip(".")
                name = f"{file_name}.{ext}"
            return self._create_named(name, overwrite_warning=True)[0]
        return self.create(mime_type)

    def _get_type_name(self, mime_type: str) -> str:
        """Map MIME type to a short name prefix (e.g., 'image', 'audio')."""
        first = mime_type.split("/")[0] if "/" in mime_type else ""
        return first if first in KNOWN_TYPES else "file"

    def _get_system_file(
        self, path: str
    ) -> list[dict[str, Any]] | dict[str, str]:
        """Get content from a registered system file."""
        getter = self._system_files.get(path)
        if getter is None:
            return {"$error": f"File {path} was not found"}
        result = getter()
        if isinstance(result, dict):
            return result  # error
        return [{"text": result}]

    def _file_to_part(self, file: FileDescriptor) -> dict[str, Any]:
        """Convert a FileDescriptor to a Gemini data part dict."""
        return file_descriptor_to_part(file)

    def _find_existing_by_handle(self, data: str) -> str | None:
        """Find an existing path with the same data handle/URI."""
        for path, descriptor in self._files.items():
            if descriptor.type in ("storedData", "fileData") and descriptor.data == data:
                return path
        return None
