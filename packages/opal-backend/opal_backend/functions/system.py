# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
System functions for the agent loop.

Port of ``functions/system.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

This module provides all system functions:
termination (``system_objective_fulfilled`` / ``system_failed_to_fulfill_objective``),
file operations (``system_list_files``, ``system_write_file``,
``system_read_text_from_file``), and task tree management
(``system_create_task_tree``, ``system_mark_completed_tasks``).
"""

from __future__ import annotations


import inspect
from typing import Any, Callable, Awaitable, cast

from ..function_definition import (
    FunctionGroup,
    load_declarations,
    assemble_function_group,
)
from ..loop import AgentResult, FileData, LoopController
from ..agent_file_system import AgentFileSystem
from ..task_tree_manager import TaskTreeManager, TASK_TREE_SCHEMA
from ..pidgin import from_pidgin_string

# Function name constants (must match the TypeScript originals exactly).
OBJECTIVE_FULFILLED_FUNCTION = "system_objective_fulfilled"
FAILED_TO_FULFILL_FUNCTION = "system_failed_to_fulfill_objective"
LIST_FILES_FUNCTION = "system_list_files"
WRITE_FILE_FUNCTION = "system_write_file"
READ_TEXT_FROM_FILE_FUNCTION = "system_read_text_from_file"
CREATE_TASK_TREE_FUNCTION = "system_create_task_tree"
MARK_COMPLETED_TASKS_FUNCTION = "system_mark_completed_tasks"
OBJECTIVE_OUTCOME_PARAMETER = "objective_outcome"
TASK_ID_PARAMETER = "task_id"

# Load declarations once at module level.
_LOADED = load_declarations("system")





# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_handlers(
    controller: LoopController,
    *,
    file_system: AgentFileSystem | None = None,
    task_tree_manager: TaskTreeManager | None = None,
    success_callback: Callable[[str, str], Any] | None = None,
    failure_callback: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Build handler map for system functions."""

    async def system_objective_fulfilled(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        href = args.get("href", "/")
        outcome_text = args.get("objective_outcome", "")

        # If a success callback is provided (e.g. for pidgin translation),
        # run it first. The TS version awaits this callback.
        if success_callback:
            result = success_callback(href, outcome_text)
            # Await if the callback is async (matches TS Promise<Outcome<void>>)
            if inspect.isawaitable(result):
                result = await result
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}

        # Resolve the route name to its original href.
        # Port of fileSystem.getOriginalRoute(href) in loop-setup.ts.
        resolved_href = href
        if file_system:
            original_route = file_system.get_original_route(href)
            if isinstance(original_route, dict) and "$error" in original_route:
                return {"error": original_route["$error"]}
            resolved_href = cast(str, original_route)

        # Resolve pidgin <file> tags in the outcome text to LLMContent.
        # Port of the translator.fromPidginString() call in loop-setup.ts.
        outcomes: dict[str, Any]
        intermediate: list[FileData] | None = None

        if file_system and outcome_text:
            resolved = await from_pidgin_string(outcome_text, file_system)
            if isinstance(resolved, dict) and "$error" in resolved:
                return {"error": resolved["$error"]}
            # from_pidgin_string returns dict (LLMContent) on success.
            outcomes = cast(dict[str, Any], resolved)

            # Collect all intermediate files with their resolved parts.
            # Port of the intermediate file collection in loop-setup.ts.
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

        if failure_callback:
            failure_callback(user_message)

        controller.terminate(
            AgentResult(
                success=False,
                href=href,
                outcomes={"parts": [{"text": user_message}]},
            )
        )
        return {}

    async def system_list_files(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        status_update = args.get("status_update")
        if status_cb and status_update:
            status_cb(status_update)
        elif status_cb:
            status_cb("Getting a list of files")
        assert file_system is not None
        return {"list": await file_system.list_files()}

    async def system_write_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_name = args.get("file_name", "")
        content = args.get("content", "")
        assert file_system is not None

        # Resolve <file> tags in the content via pidgin translator
        translated = await from_pidgin_string(content, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # Extract text from the translated content parts.
        # from_pidgin_string returns dict (LLMContent) on success.
        translated_dict = cast(dict[str, Any], translated)
        text_parts = []
        for part in translated_dict.get("parts", []):
            if "text" in part:
                text_parts.append(part["text"])
        resolved_content = "\n".join(text_parts) if text_parts else content

        file_path = file_system.write(file_name, resolved_content)
        return {"file_path": file_path}

    async def system_read_text_from_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_path = args.get("file_path", "")
        assert file_system is not None
        text = await file_system.read_text(file_path)
        if isinstance(text, dict) and "$error" in text:
            return {"error": text["$error"]}
        return {"text": text}

    async def system_create_task_tree(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        task_tree = args.get("task_tree")
        if not task_tree:
            return {"error": "task_tree is required"}
        assert task_tree_manager is not None
        file_path = task_tree_manager.set(task_tree)
        return {"file_path": file_path}

    async def system_mark_completed_tasks(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        task_ids = args.get("task_ids", [])
        assert task_tree_manager is not None
        file_path = task_tree_manager.set_complete(task_ids)
        return {"file_path": file_path}

    # Build handler map — only include handlers for available services.
    handlers: dict[str, Any] = {
        "system_objective_fulfilled": system_objective_fulfilled,
        "system_failed_to_fulfill_objective": system_failed_to_fulfill_objective,
    }
    if file_system is not None:
        handlers["system_list_files"] = system_list_files
        handlers["system_write_file"] = system_write_file
        handlers["system_read_text_from_file"] = system_read_text_from_file
    if task_tree_manager is not None:
        handlers["system_create_task_tree"] = system_create_task_tree
        handlers["system_mark_completed_tasks"] = system_mark_completed_tasks

    return handlers


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_system_function_group(
    controller: LoopController,
    *,
    file_system: AgentFileSystem | None = None,
    task_tree_manager: TaskTreeManager | None = None,
    success_callback: Callable[[str, str], Any] | None = None,
    failure_callback: Callable[[str], None] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with all system functions.

    This is the Python equivalent of ``getSystemFunctionGroup`` from
    system.ts. It wires termination, file, and task tree functions.

    Args:
        controller: The LoopController for termination functions.
        file_system: The AgentFileSystem for file operations. When
            ``None``, file functions are omitted.
        task_tree_manager: The TaskTreeManager for task tree operations.
            When ``None``, task tree functions are omitted.
        success_callback: Optional callback for objective_fulfilled.
        failure_callback: Optional callback for failed_to_fulfill.

    Returns:
        A FunctionGroup with declarations, definitions, and instruction.
    """
    handlers = _make_handlers(
        controller,
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        success_callback=success_callback,
        failure_callback=failure_callback,
    )
    return assemble_function_group(
        _LOADED,
        handlers,
    )
