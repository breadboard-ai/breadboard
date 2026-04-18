# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees system function group — termination only.

Overrides the built-in system group to provide only the termination
functions (``system_objective_fulfilled`` and
``system_failed_to_fulfill_objective``). All other system functions
(file operations, task tree) are excluded.

The handler bodies are inlined from ``opal_backend.functions.system``,
using bees-native types from ``bees.protocols`` and pidgin resolution
from ``bees.pidgin``. See ``spec/handler-bodies.md`` for rationale.

This module uses the ``FunctionGroupFactory`` pattern to late-bind
against the session's controller and file system via ``SessionHooks``.
"""

from __future__ import annotations

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
from bees.protocols.handler_types import (
    AgentResult,
    FileData,
)

__all__ = ["get_system_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("system", declarations_dir=_DECLARATIONS_DIR)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_handlers(
    controller: Any,
    *,
    file_system: Any | None = None,
) -> dict[str, Any]:
    """Build handler map for bees system termination functions.

    Only termination handlers are included — task tree and file operation
    handlers belong in opal_backend, not in bees.

    Args:
        controller: A ``SessionTerminator``-compatible object.
        file_system: A ``FileSystem``-compatible object for pidgin
            resolution and intermediate file collection.
    """

    async def system_objective_fulfilled(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        href = args.get("href", "/")
        outcome_text = args.get("objective_outcome", "")

        # Resolve the route name to its original href.
        resolved_href = href
        if file_system:
            original_route = file_system.get_original_route(href)
            if isinstance(original_route, dict) and "$error" in original_route:
                return {"error": original_route["$error"]}
            resolved_href = cast(str, original_route)

        # Resolve pidgin <file> tags in the outcome text to LLMContent.
        outcomes: dict[str, Any]
        intermediate: list[FileData] | None = None

        if file_system and outcome_text:
            resolved = await from_pidgin_string(outcome_text, file_system)
            if isinstance(resolved, dict) and "$error" in resolved:
                return {"error": resolved["$error"]}
            outcomes = cast(dict[str, Any], resolved)

            # Collect all intermediate files with their resolved parts.
            errors: list[str] = []
            intermediate = []
            for path in list(file_system.files.keys()):
                file_parts = await file_system.get(path)
                if isinstance(file_parts, dict) and "$error" in file_parts:
                    errors.append(file_parts["$error"])
                    continue
                if file_parts:
                    intermediate.append(
                        FileData(
                            path=path,
                            content={"parts": file_parts},
                        )
                    )
            if errors:
                return {"error": "; ".join(errors)}
        else:
            outcomes = {"parts": [{"text": outcome_text}]}

        result_data = AgentResult(
            success=True,
            href=resolved_href,
            outcomes=outcomes,
        )
        if intermediate is not None:
            result_data.intermediate = intermediate
        controller.terminate(result_data)
        return {}

    async def system_failed_to_fulfill_objective(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        user_message = args.get("user_message", "")
        href = args.get("href", "/")

        controller.terminate(
            AgentResult(
                success=False,
                href=href,
                outcomes={"parts": [{"text": user_message}]},
            )
        )
        return {}

    return {
        "system_objective_fulfilled": system_objective_fulfilled,
        "system_failed_to_fulfill_objective": system_failed_to_fulfill_objective,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_system_function_group_factory() -> FunctionGroupFactory:
    """Return a factory that builds the bees system function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"system"`` — replacing the built-in
    system group entirely. Only termination functions are included,
    with handler bodies inlined from the opal_backend originals.
    """

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            hooks.controller,
            file_system=hooks.file_system,
        )
        return assemble_function_group(_LOADED, handlers)

    return factory
