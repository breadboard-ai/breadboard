# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Files function group for Bees.

Provides file operation functions (write, list, read, list-dir) using bees-local
declarations. With ``DiskFileSystem`` the paths are already bare
(relative to ``work_dir``) — no ``/mnt/`` translation is needed.

The handler bodies are inlined from ``opal_backend.functions.system``,
using bees-native types from ``bees.protocols`` and pidgin resolution
from ``bees.pidgin``. See ``spec/handler-bodies.md`` for rationale.

This uses the ``FunctionGroupFactory`` pattern to late-bind against the
session's file system via ``SessionHooks``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from bees.pidgin import from_pidgin_string
from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)

from bees.subagent_scope import SubagentScope

__all__ = ["get_files_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("files", declarations_dir=_DECLARATIONS_DIR)

# Binary detection & line-counting limits.
_BINARY_SNIFF_BYTES = 8 * 1024
_MAX_LINE_COUNT_SIZE = 10 * 1024 * 1024  # 10 MB
_SKIP_NAMES = {"node_modules", "__pycache__"}


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_file_handlers(
    *,
    file_system: Any,
) -> dict[str, Any]:
    """Build handler map for bees file operation functions.

    Only file operations are included — termination and task tree
    handlers are separate concerns.

    Args:
        file_system: A ``FileSystem``-compatible object.
    """

    async def files_list_files(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        status_update = args.get("status_update")
        if status_cb and status_update:
            status_cb(status_update)
        elif status_cb:
            status_cb("Getting a list of files")
        return {"list": await file_system.list_files()}

    async def files_write_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_name = args.get("file_name", "")
        content = args.get("content", "")

        # Resolve <file> tags in the content via pidgin translator.
        translated = await from_pidgin_string(content, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # Extract text from the translated content parts.
        translated_dict = cast(dict[str, Any], translated)
        text_parts = []
        for part in translated_dict.get("parts", []):
            if "text" in part:
                text_parts.append(part["text"])
        resolved_content = "\n".join(text_parts) if text_parts else content

        file_path = file_system.write(file_name, resolved_content)
        return {"file_path": file_path}

    async def files_read_text_from_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_path = args.get("file_path", "")
        text = await file_system.read_text(file_path)
        if isinstance(text, dict) and "$error" in text:
            return {"error": text["$error"]}
        return {"text": text}

    return {
        "files_list_files": files_list_files,
        "files_write_file": files_write_file,
        "files_read_text_from_file": files_read_text_from_file,
    }


def _make_list_dir_handler(work_dir: Path) -> Any:
    """Build a ``files_list_dir`` handler bound to *work_dir*."""

    async def files_list_dir(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        dir_rel = args.get("dir", ".")
        dir_path = (work_dir / dir_rel).resolve()

        # Prevent path traversal outside work_dir.
        try:
            dir_path.relative_to(work_dir.resolve())
        except ValueError:
            return {"error": f"Path is outside the working directory: {dir_rel}"}

        if not dir_path.is_dir():
            return {"error": f"Not a directory: {dir_rel}"}

        if status_cb:
            status_cb(f"Listing {dir_rel}")

        entries: list[dict[str, Any]] = []
        try:
            for child in sorted(dir_path.iterdir(), key=lambda p: p.name):
                name = child.name
                if name.startswith(".") or name in _SKIP_NAMES:
                    continue

                if child.is_dir():
                    entries.append({"name": name, "isDir": True})
                elif child.is_file():
                    try:
                        stat = child.stat()
                    except OSError:
                        continue
                    entry: dict[str, Any] = {
                        "name": name,
                        "sizeBytes": stat.st_size,
                    }
                    # For text-ish files, include line count.
                    if stat.st_size <= _MAX_LINE_COUNT_SIZE:
                        try:
                            raw = child.read_bytes()
                            if b"\x00" not in raw[:_BINARY_SNIFF_BYTES]:
                                entry["lineCount"] = raw.count(b"\n")
                        except OSError:
                            pass
                    entries.append(entry)
        except OSError as e:
            return {"error": str(e)}

        return {"entries": json.dumps(entries)}

    return files_list_dir


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_files_function_group_factory(scope: SubagentScope | None = None) -> FunctionGroupFactory:
    """Return a factory that builds the files function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"files"`` with file operation
    functions. Handler bodies are inlined from opal_backend.

    With ``DiskFileSystem``, paths are bare (relative to work_dir) —
    no path translation is needed.
    """

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_file_handlers(
            file_system=hooks.file_system,
        )

        # Add bees-local handlers.
        handlers["files_list_dir"] = _make_list_dir_handler(hooks.file_system._work_dir)

        
        if scope and scope.slug_path:
            original_write = handlers["files_write_file"]
            
            async def restricted_write_file(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
                file_name = args.get("file_name", "")
                if not scope.is_writable(file_name):
                    return {"error": f"You can only write files in the directory: {scope.slug_path}"}
                return await original_write(args, status_cb)
                
            handlers["files_write_file"] = restricted_write_file
            
        return assemble_function_group(_LOADED, handlers)

    return factory
