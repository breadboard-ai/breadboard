# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees system function group — termination only.

Overrides the built-in system group to provide only the termination
functions (``system_objective_fulfilled`` and
``system_failed_to_fulfill_objective``). All other system functions
(file operations, task tree) are excluded.

The handlers are identical to the built-in implementations — including
pidgin resolution, route mapping, and intermediate file collection.
Only the set of *exposed* functions is narrowed via local declarations.

This module uses the ``FunctionGroupFactory`` pattern to late-bind
against the session's controller and file system via ``SessionHooks``.
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

__all__ = ["get_system_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("system", declarations_dir=_DECLARATIONS_DIR)


def get_system_function_group_factory() -> "FunctionGroupFactory":
    """Return a factory that builds the bees system function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"system"`` — replacing the built-in
    system group entirely. Only termination functions are included,
    but their implementations are identical to the built-in versions.
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
