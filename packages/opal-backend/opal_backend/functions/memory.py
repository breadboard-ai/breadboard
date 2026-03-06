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

from ..agent_file_system import AgentFileSystem
from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    StatusUpdateCallback,
    map_definitions,
)
from ..pidgin import from_pidgin_string
from ..sheet_manager import SheetManager
from ..shared_schemas import STATUS_UPDATE_SCHEMA, TASK_ID_SCHEMA
from ..task_tree_manager import TaskTreeManager

logger = logging.getLogger(__name__)

__all__ = ["get_memory_function_group"]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MEMORY_CREATE_SHEET_FUNCTION = "memory_create_sheet"
MEMORY_READ_SHEET_FUNCTION = "memory_read_sheet"
MEMORY_UPDATE_SHEET_FUNCTION = "memory_update_sheet"
MEMORY_DELETE_SHEET_FUNCTION = "memory_delete_sheet"
MEMORY_GET_METADATA_FUNCTION = "memory_get_metadata"

CHAT_LOG_PATH = "/mnt/system/chat_log.json"

_INSTRUCTION = f"""
## Using memory data store

You have access to a persistent data store that allows you to recall and \
remember data across multiple sessions. Use the data store when the \
objective contains the key phrase "Use Memory".

The data store is stored in a Google Spreadsheet.

Unless the objective explicitly calls for creating new sheets and \
specifies names for them, keep all memory data in a single sheet named \
"memory". Populate it with the columns that make sense for a wide range \
of data. Typically, you will want to include "Date", "Title", and \
"Details" columns. Look at the objective for hints on what columns to \
use. If there is a sheet that already exists, reuse it instead of \
creating a new one.

Create new sheets within this spreadsheet using the \
"{MEMORY_CREATE_SHEET_FUNCTION}" function and delete sheets with the \
"{MEMORY_DELETE_SHEET_FUNCTION}" function. Get the list of existing \
sheets with the "{MEMORY_GET_METADATA_FUNCTION}" function.

To retrieve data from memory, use either the \
"{MEMORY_READ_SHEET_FUNCTION}" function with the standard Google Sheets \
ranges or read the entire sheet as a file using the \
"/mnt/memory/sheet_name" path.

To update data in memory, use the "{MEMORY_UPDATE_SHEET_FUNCTION}" \
function.

The full transcript of the conversation with the user is automatically \
stored in a separate data store. Don't call any functions when asked to \
store chat logs or chat information. Just read the chat log from \
"{CHAT_LOG_PATH}" whenever you need the chat history."""


# ---------------------------------------------------------------------------
# Function definitions
# ---------------------------------------------------------------------------


def _define_memory_create_sheet(
    *,
    sheet_manager: SheetManager,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionDefinition:
    """Port of the ``memory_create_sheet`` function from memory.ts."""

    async def handler(
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

    return FunctionDefinition(
        name=MEMORY_CREATE_SHEET_FUNCTION,
        description="Creates a new memory sheet",
        handler=handler,
        icon="table_chart",
        title="Creating a new memory sheet",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": (
                        "The name of the sheet. Use snake_case for naming."
                    ),
                },
                "columns": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "description": "The name of the column header",
                    },
                    "description": (
                        "An array of strings representing the column headers "
                        "(e.g., ['Name', 'Status'])."
                    ),
                },
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
            "required": ["name", "columns"],
        },
    )


def _define_memory_read_sheet(
    *,
    sheet_manager: SheetManager,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionDefinition:
    """Port of the ``memory_read_sheet`` function from memory.ts."""

    async def handler(
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

    return FunctionDefinition(
        name=MEMORY_READ_SHEET_FUNCTION,
        description=(
            "Reads values from a specific memory range (e.g. Scores!A1:B3)"
        ),
        handler=handler,
        icon="table_chart",
        title="Reading memory",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "range": {
                    "type": "string",
                    "description": (
                        "The Google Sheets range which must include the "
                        "name of the sheet"
                    ),
                },
                "file_name": {
                    "type": "string",
                    "description": (
                        "The name of the file to save the output to. "
                        "This is the name that will come after \"/mnt/\" "
                        "prefix in the file path. Use snake_case for "
                        "naming. Only use when the \"output_format\" is "
                        "set to \"file\"."
                    ),
                },
                "output_format": {
                    "type": "string",
                    "enum": ["file", "json"],
                    "description": (
                        "The output format. When \"file\" is specified, "
                        "the output will be saved as a file and the "
                        "\"file_path\" response parameter will be provided "
                        "as output. Use this when you expect a long output "
                        "from the sheet. NOTE that choosing this option "
                        "will prevent you from seeing the output directly: "
                        "you only get back the file path. You can read "
                        "this file as a separate action, but if you do "
                        "expect to read it, the \"json\" output format "
                        "might be a better choice.\n\n"
                        "When \"json\" is specified, the output will be "
                        "returned as JSON directly, and the \"json\" "
                        "response parameter will be provided."
                    ),
                },
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
            "required": ["range", "output_format"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": (
                        "The file path with the output of the generator. "
                        "Will be provided when the \"output_format\" is "
                        "set to \"file\""
                    ),
                },
                "json": {
                    "type": "string",
                    "description": (
                        "The JSON output of the generator. Will be "
                        "provided when the \"output_format\" is set "
                        "to \"json\""
                    ),
                },
                "error": {
                    "type": "string",
                    "description": (
                        "If an error has occurred, will contain a "
                        "description of the error"
                    ),
                },
            },
        },
    )


def _define_memory_update_sheet(
    *,
    sheet_manager: SheetManager,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionDefinition:
    """Port of the ``memory_update_sheet`` function from memory.ts."""

    async def handler(
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

    return FunctionDefinition(
        name=MEMORY_UPDATE_SHEET_FUNCTION,
        description=(
            "Overwrites a specific memory range with new data. "
            "Used for editing specific rows."
        ),
        handler=handler,
        icon="table_chart",
        title="Updating memory",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "range": {
                    "type": "string",
                    "description": (
                        "The Google Sheets range which must include the "
                        "name of the sheet"
                    ),
                },
                "values": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "description": (
                                "The data to write, may include references "
                                "to files. For instance, if you have an "
                                "existing file at \"/mnt/text3.md\", you "
                                "can reference it as "
                                '<file src="/mnt/text3.md" /> in the data. '
                                "At update time, the tag will be replaced "
                                "with the file contents."
                            ),
                        },
                    },
                    "description": "The 2D array of data to write.",
                },
                **TASK_ID_SCHEMA,
            },
            "required": ["range", "values"],
        },
    )


def _define_memory_delete_sheet(
    *,
    sheet_manager: SheetManager,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionDefinition:
    """Port of the ``memory_delete_sheet`` function from memory.ts."""

    async def handler(
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

    return FunctionDefinition(
        name=MEMORY_DELETE_SHEET_FUNCTION,
        description="Deletes a specific memory sheet",
        handler=handler,
        icon="table_chart",
        title="Deleting a memory sheet",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name of the sheet",
                },
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
            "required": ["name"],
        },
    )


def _define_memory_get_metadata(
    *,
    sheet_manager: SheetManager,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionDefinition:
    """Port of the ``memory_get_metadata`` function from memory.ts."""

    async def handler(
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

    return FunctionDefinition(
        name=MEMORY_GET_METADATA_FUNCTION,
        description=(
            "Returns the names and header rows of all memory sheets."
        ),
        handler=handler,
        icon="table_chart",
        title="Reading memory metadata",
        parameters_json_schema={
            "type": "object",
            "properties": {
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
            },
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "sheets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": (
                                    "The name of the memory sheet"
                                ),
                            },
                            "file_path": {
                                "type": "string",
                                "description": (
                                    "The file path to read the "
                                    "memory sheet"
                                ),
                            },
                            "columns": {
                                "type": "array",
                                "items": {
                                    "type": "string",
                                    "description": "The column name",
                                },
                                "description": (
                                    "The list of column names"
                                ),
                            },
                        },
                    },
                },
                "error": {
                    "type": "string",
                    "description": (
                        "If an error has occurred, will contain a "
                        "description of the error"
                    ),
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_memory_function_group(
    *,
    sheet_manager: SheetManager,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with all memory functions.

    Port of ``getMemoryFunctionGroup`` from ``memory.ts``.
    """
    functions = [
        _define_memory_create_sheet(
            sheet_manager=sheet_manager,
            task_tree_manager=task_tree_manager,
        ),
        _define_memory_read_sheet(
            sheet_manager=sheet_manager,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
        ),
        _define_memory_update_sheet(
            sheet_manager=sheet_manager,
            file_system=file_system,
            task_tree_manager=task_tree_manager,
        ),
        _define_memory_delete_sheet(
            sheet_manager=sheet_manager,
            task_tree_manager=task_tree_manager,
        ),
        _define_memory_get_metadata(
            sheet_manager=sheet_manager,
            task_tree_manager=task_tree_manager,
        ),
    ]

    mapped = map_definitions(functions)
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction=_INSTRUCTION,
    )
