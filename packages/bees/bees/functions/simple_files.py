# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Simple-files function group for Bees.

Wraps the built-in system file handlers with a path-translation layer so
the agent never sees the ``/mnt/`` prefix:

* ``system_write_file`` — strips ``/mnt/`` from the returned ``file_path``.
* ``system_list_files`` — strips ``/mnt/`` prefix from every listed path.
* ``system_read_text_from_file`` — passes the bare path directly; AgentFS
  normalises it via ``_resolve_path`` in ``get()``.

This uses the ``FunctionGroupFactory`` pattern to late-bind against the
session's file system via ``SessionHooks``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)
from opal_backend.functions.system import _make_handlers

__all__ = ["get_simple_files_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("simple-files", declarations_dir=_DECLARATIONS_DIR)

_MNT_PREFIX = "/mnt/"


def _strip_mnt(path: str) -> str:
    """Strip the ``/mnt/`` prefix from a path, returning a bare filename."""
    if path.startswith(_MNT_PREFIX):
        return path[len(_MNT_PREFIX):]
    return path


def get_simple_files_function_group_factory() -> "FunctionGroupFactory":
    """Return a factory that builds the simple-files function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"simple-files"`` with the three file
    operation functions, wrapped to present bare filenames to the agent.
    """
    from opal_backend.function_definition import FunctionGroupFactory

    def factory(hooks: SessionHooks) -> FunctionGroup:
        upstream = _make_handlers(
            hooks.controller,
            file_system=hooks.file_system,
            task_tree_manager=hooks.task_tree_manager,
        )

        # --- system_write_file: strip /mnt/ from the response path ---
        _upstream_write = upstream["system_write_file"]

        async def system_write_file(
            args: dict[str, Any], status_cb: Any
        ) -> dict[str, Any]:
            result = await _upstream_write(args, status_cb)
            if "file_path" in result:
                result["file_path"] = _strip_mnt(result["file_path"])
            return result

        # --- system_list_files: strip /mnt/ from every listed filename ---
        _upstream_list = upstream["system_list_files"]

        async def system_list_files(
            args: dict[str, Any], status_cb: Any
        ) -> dict[str, Any]:
            result = await _upstream_list(args, status_cb)
            if "list" in result:
                lines = result["list"].splitlines()
                result["list"] = "\n".join(_strip_mnt(line) for line in lines)
            return result

        handlers = {
            **upstream,
            "system_write_file": system_write_file,
            "system_list_files": system_list_files,
        }
        return assemble_function_group(_LOADED, handlers)

    return factory
