# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Simple-files function group for Bees.

Provides file operation functions (write, list, read) using bees-local
declarations. With ``DiskFileSystem`` the paths are already bare
(relative to ``work_dir``) — no ``/mnt/`` translation is needed.

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


def get_simple_files_function_group_factory() -> "FunctionGroupFactory":
    """Return a factory that builds the simple-files function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"simple-files"`` with the three file
    operation functions.

    With ``DiskFileSystem``, paths are bare (relative to work_dir) —
    no path translation is needed.
    """
    from opal_backend.function_definition import FunctionGroupFactory

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            hooks.controller,
            file_system=hooks.file_system,
            task_tree_manager=hooks.task_tree_manager,
        )
        return assemble_function_group(_LOADED, handlers)

    return factory
