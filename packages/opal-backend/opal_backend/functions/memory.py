# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Memory function group for the agent loop.

Port of ``functions/memory.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Provides persistent memory operations backed by Google Sheets. Five
functions are exposed to the agent:

- ``memory_create_sheet`` — create a new sheet with column headers
- ``memory_read_sheet`` — read values from a range (file or json output)
- ``memory_update_sheet`` — overwrite a range with new data
- ``memory_delete_sheet`` — delete a sheet by name
- ``memory_get_metadata`` — list all sheets with columns
"""

from __future__ import annotations

import json
import logging
from typing import Any, cast

from ..file_system_protocol import FileSystem
from ..function_definition import (
    FunctionGroup,
    StatusUpdateCallback,
    load_declarations,
    assemble_function_group,
)
from ..pidgin import from_pidgin_string
from ..sheet_manager import SheetManager
from ..task_tree_manager import TaskTreeManager

logger = logging.getLogger(__name__)

__all__ = ["get_memory_function_group"]

# Function name constants (must match the JSON declarations exactly).
MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet"
MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet"
MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet"
MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet"
MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata"

# Load declarations once at module level.
_LOADED = load_declarations("memory")

# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_handlers(
    *,
    sheet_manager: SheetManager,
    file_system: FileSystem,
    task_tree_manager: TaskTreeManager | None = None,
) -> dict[str, Any]:
    """Build handler map for memory functions."""

    async def memory_create_sheet(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        status_update = args.get("status_update")
        name = args.get("name", "")
        columns = args.get("columns", [])

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        result = await sheet_manager.create_sheet(name=name, columns=columns)
        if not result.get("success"):
            return {"error": result.get("error", "Failed to create sheet")}
        return result

    async def memory_read_sheet(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        status_update = args.get("status_update")
        range_str = args.get("range", "")
        output_format = args.get("output_format", "json")
        file_name = args.get("file_name")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        result = await sheet_manager.read_sheet(range=range_str)
        if "error" in result:
            return {"error": result["error"]}

        values = result.get("values")
        if not values:
            return {"error": "The sheet is empty"}

        # Convert to text part and add to file system.
        # TS uses llm`${result}`.asParts() which JSON-stringifies the full
        # result object (including {"values": ...} wrapper).
        text = json.dumps(result)
        part = {"text": text}
        file_path = file_system.add_part(part, file_name)
        if isinstance(file_path, dict) and "$error" in file_path:
            return {"error": file_path["$error"]}

        if output_format == "file":
            return {"file_path": file_path}
        return {"json": json.dumps(result)}

    async def memory_update_sheet(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        range_str = args.get("range", "")
        pidgin_values: list[list[str]] = args.get("values", [])

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, "")

        # Resolve pidgin file references in cell values.
        errors: list[str] = []
        resolved_values: list[list[str]] = []
        for row in pidgin_values:
            resolved_row: list[str] = []
            for cell in row:
                translated = await from_pidgin_string(cell, file_system)
                if isinstance(translated, dict) and "$error" in translated:
                    errors.append(translated["$error"])
                    resolved_row.append("")
                else:
                    # Extract text from the content parts.
                    translated_dict = cast(dict[str, Any], translated)
                    texts = []
                    parts = translated_dict.get("parts", [])
                    for part in parts:
                        if isinstance(part, dict) and "text" in part:
                            texts.append(part["text"])
                    resolved_row.append("".join(texts))
            resolved_values.append(resolved_row)

        if errors:
            return {"error": ", ".join(errors)}

        result = await sheet_manager.update_sheet(
            range=range_str, values=resolved_values
        )
        if not result.get("success"):
            return {"error": result.get("error", "Failed to update sheet")}
        return result

    async def memory_delete_sheet(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        status_update = args.get("status_update")
        name = args.get("name", "")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        result = await sheet_manager.delete_sheet(name=name)
        if not result.get("success"):
            return {"error": result.get("error", "Failed to delete sheet")}
        return result

    async def memory_get_metadata(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        result = await sheet_manager.get_sheet_metadata()
        if "error" in result:
            return {"error": result["error"]}
        return result

    return {
        "memory_create_sheet": memory_create_sheet,
        "memory_read_sheet": memory_read_sheet,
        "memory_update_sheet": memory_update_sheet,
        "memory_delete_sheet": memory_delete_sheet,
        "memory_get_metadata": memory_get_metadata,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_memory_function_group(
    *,
    sheet_manager: SheetManager,
    file_system: FileSystem,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with all memory functions.

    Port of ``getMemoryFunctionGroup`` from ``memory.ts``.
    """
    handlers = _make_handlers(
        sheet_manager=sheet_manager,
        file_system=file_system,
        task_tree_manager=task_tree_manager,
    )
    return assemble_function_group(_LOADED, handlers)
