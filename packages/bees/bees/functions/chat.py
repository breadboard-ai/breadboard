# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees chat function group — with bees-specific response schema.

Overrides the built-in chat group to use bees-local declarations that
include ``context_updates`` in the response schemas. The handlers are
identical to the built-in implementations — only the declared schema
is different.

This module uses the ``FunctionGroupFactory`` pattern to late-bind
against the session's file system and task tree via ``SessionHooks``.
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
from opal_backend.functions.chat import _make_handlers

__all__ = ["get_chat_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("chat", declarations_dir=_DECLARATIONS_DIR)


def get_chat_function_group_factory() -> "FunctionGroupFactory":
    """Return a factory that builds the bees chat function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"chat"`` — replacing the built-in
    chat group entirely. The handlers are identical to the built-in
    versions, but the declarations include bees-specific
    ``context_updates`` fields in the response schemas.
    """
    from opal_backend.function_definition import FunctionGroupFactory

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            task_tree_manager=hooks.task_tree_manager,
            file_system=hooks.file_system,
        )
        return assemble_function_group(_LOADED, handlers)

    return factory
