# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Function filter → SDK capability mapping.

Translates bees' function filter patterns (``files.*``, ``sandbox.*``, etc.)
into Antigravity SDK ``CapabilitiesConfig`` and custom Python tools.

The mapping table:

    files.*    → VIEW_FILE, CREATE_FILE, EDIT_FILE, LIST_DIR, FIND_FILE, SEARCH_DIR
    sandbox.*  → RUN_COMMAND
    chat.*     → ASK_QUESTION
    system.*   → FINISH
    agents.*   → custom tools (bees-specific orchestration)
    events.*   → custom tools (bees-specific coordination)
    skills.*   → custom tools (skill reading)

Excluded SDK tools: GENERATE_IMAGE, START_SUBAGENT (bees manages its
own agent hierarchy and the direct_model subagent is more capable).
"""

from __future__ import annotations

import fnmatch
import logging
from typing import Any, Callable

from google.antigravity import types as ag_types
from google.antigravity.tools.tool_runner import ToolWithSchema

from bees.protocols.functions import (
    FunctionDefinition,
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
)
from bees.disk_file_system import DiskFileSystem

__all__ = ["map_function_filter", "wrap_bees_handler"]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Filter → SDK BuiltinTools mapping
# ---------------------------------------------------------------------------

# Each bees function filter pattern maps to a set of SDK builtin tools.
# Patterns not listed here produce custom Python tools instead.
_FILTER_TO_BUILTINS: dict[str, list[ag_types.BuiltinTools]] = {
    "files.*": [
        ag_types.BuiltinTools.VIEW_FILE,
        ag_types.BuiltinTools.CREATE_FILE,
        ag_types.BuiltinTools.EDIT_FILE,
        ag_types.BuiltinTools.LIST_DIR,
        ag_types.BuiltinTools.FIND_FILE,
        ag_types.BuiltinTools.SEARCH_DIR,
    ],
    "sandbox.*": [
        ag_types.BuiltinTools.RUN_COMMAND,
    ],
    "chat.*": [
        ag_types.BuiltinTools.ASK_QUESTION,
    ],
    "system.*": [
        ag_types.BuiltinTools.FINISH,
    ],
}

# Function group names that produce custom tools rather than SDK builtins.
_CUSTOM_TOOL_GROUPS = {"agents", "events", "skills"}

# SDK tools we never enable, regardless of filter.
_EXCLUDED_BUILTINS = {
    ag_types.BuiltinTools.GENERATE_IMAGE,
    ag_types.BuiltinTools.START_SUBAGENT,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def map_function_filter(
    function_filter: list[str] | None,
    function_groups: list[FunctionGroupFactory],
    hooks: SessionHooks,
) -> tuple[ag_types.CapabilitiesConfig, list[Callable[..., Any]], list[str]]:
    """Map bees function filters to SDK capabilities and custom tools.

    Args:
        function_filter: The bees-side function filter from the template
            (e.g. ``["files.*", "system.*", "agents.*"]``).  ``None``
            means "all functions".
        function_groups: Assembled function group factories from the
            provisioner.
        hooks: Session hooks for late-binding function group factories.

    Returns:
        A ``(capabilities, custom_tools, custom_instructions)`` tuple:

        - ``capabilities``: SDK ``CapabilitiesConfig`` with the appropriate
          ``enabled_tools`` list.
        - ``custom_tools``: Python callables to register with the SDK's
          ``tools=[...]`` parameter.
        - ``custom_instructions``: System instruction fragments from
          custom tool groups (e.g. agents, events, skills).  Groups
          that map to SDK builtins are excluded — the SDK explains
          its own tools.
    """
    enabled_builtins: set[ag_types.BuiltinTools] = set()
    custom_tools: list[Callable[..., Any]] = []
    custom_instructions: list[str] = []

    if function_filter is None:
        # No filter → enable all SDK builtins (except excluded).
        enabled_builtins = set(ag_types.BuiltinTools) - _EXCLUDED_BUILTINS
        # Also instantiate all custom-tool groups.
        custom_tools, custom_instructions = _extract_custom_tools(
            function_groups, hooks, include_groups=None,
        )
    else:
        custom_group_names: set[str] = set()

        for pattern in function_filter:
            # Check if this pattern maps to SDK builtins.
            matched_builtins = _resolve_builtin_pattern(pattern)
            if matched_builtins is not None:
                enabled_builtins.update(matched_builtins)
            else:
                # Extract the group name from the pattern (e.g. "agents" from
                # "agents.*" or "agents_assign_task").
                group_name = pattern.split(".")[0].split("_")[0]
                if group_name in _CUSTOM_TOOL_GROUPS:
                    custom_group_names.add(group_name)

        # Remove any excluded builtins that snuck in.
        enabled_builtins -= _EXCLUDED_BUILTINS

        # Extract custom tools from matching function groups.
        custom_tools, custom_instructions = _extract_custom_tools(
            function_groups, hooks, include_groups=custom_group_names,
        )

    capabilities = ag_types.CapabilitiesConfig(
        enabled_tools=sorted(enabled_builtins, key=lambda t: t.value),
        enable_subagents=False,  # Bees manages its own agent hierarchy.
    )

    return capabilities, custom_tools, custom_instructions


# ---------------------------------------------------------------------------
# Custom tool wrapping
# ---------------------------------------------------------------------------


def wrap_bees_handler(
    func_def: FunctionDefinition,
) -> Callable[..., Any]:
    """Wrap a bees ``FunctionDefinition`` as an SDK-compatible Python tool.

    The SDK's tool runner calls Python tools with ``**kwargs`` and expects
    a return value.  Bees handlers have the signature
    ``(args: dict, status_cb) -> dict``.  This wrapper bridges the two.

    Returns a ``ToolWithSchema`` so the SDK's ``callable_to_tool_proto``
    serializes the explicit JSON Schema directly, bypassing signature
    introspection (which would see only ``**kwargs``).
    """
    handler = func_def.handler

    async def tool_fn(**kwargs: Any) -> Any:
        # Bees handlers expect (args_dict, status_callback).
        result = await handler(kwargs, _noop_status_cb)
        return result

    # The SDK uses __name__ and __doc__ for tool registration.
    tool_fn.__name__ = func_def.name
    tool_fn.__doc__ = func_def.description

    schema = func_def.parameters_json_schema or {
        "type": "object", "properties": {},
    }
    return ToolWithSchema(tool_fn, schema)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _noop_status_cb(
    message: str | None = None, options: Any = None,
) -> None:
    """No-op status callback for wrapped bees handlers."""


def _resolve_builtin_pattern(
    pattern: str,
) -> list[ag_types.BuiltinTools] | None:
    """Resolve a function filter pattern to SDK builtins, or None."""
    # Direct table lookup first.
    if pattern in _FILTER_TO_BUILTINS:
        return _FILTER_TO_BUILTINS[pattern]

    # Try matching individual tool names (e.g. "chat.await_context_update"
    # still maps to the chat group → ASK_QUESTION).
    for table_pattern, builtins in _FILTER_TO_BUILTINS.items():
        if fnmatch.fnmatch(pattern, table_pattern):
            return builtins

    return None


def _extract_custom_tools(
    function_groups: list[FunctionGroupFactory],
    hooks: SessionHooks,
    *,
    include_groups: set[str] | None,
) -> tuple[list[Callable[..., Any]], list[str]]:
    """Instantiate function groups and wrap their definitions as custom tools.

    Args:
        function_groups: All function group factories from the provisioner.
        hooks: Session hooks for factory instantiation.
        include_groups: If not None, only include groups whose ``name``
            is in this set.  If None, include all groups that map to
            custom tools.

    Returns:
        A ``(tools, instructions)`` tuple.  ``instructions`` contains
        the non-empty ``group.instruction`` strings from matched groups.
    """
    tools: list[Callable[..., Any]] = []
    instructions: list[str] = []

    for entry in function_groups:
        # function_groups contains both FunctionGroupFactory callables
        # and pre-built FunctionGroup objects (e.g. live, skills).
        if isinstance(entry, FunctionGroup):
            group = entry
        elif callable(entry):
            try:
                group = entry(hooks)
            except Exception:
                logger.warning(
                    "Failed to instantiate function group factory %s",
                    entry,
                    exc_info=True,
                )
                continue
        else:
            continue

        group_name = group.name or ""

        # Skip groups that map to SDK builtins.
        if group_name and group_name not in _CUSTOM_TOOL_GROUPS:
            continue

        # Skip groups not in the include set (when filtering).
        if include_groups is not None and group_name not in include_groups:
            continue

        for _name, func_def in group.definitions:
            tools.append(wrap_bees_handler(func_def))

        if group.instruction:
            instructions.append(group.instruction)

    return tools, instructions
