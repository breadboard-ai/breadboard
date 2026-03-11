"""Ark system functions — real-filesystem variants.

Cloned from opal-backend's system functions. The key difference: file
operations (list, write, read) operate on the real filesystem within
the sandbox work_dir, not the in-memory AgentFileSystem.

Pidgin ``<file>`` tags are resolved via the ``FileReader`` protocol
(see ``ark_pidgin.py``).
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)
from opal_backend.loop import AgentResult, LoopController

from .ark_pidgin import TextFileReader, from_pidgin_string

__all__ = ["get_ark_system_group"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"


def _build_instruction() -> str:
    """Build the system instruction with the current date interpolated."""
    loaded = load_declarations("system", declarations_dir=_DECLARATIONS_DIR)
    now = datetime.now().strftime("%B %-d, %Y %-I:%M %p")
    instruction = loaded.instruction or ""
    return instruction.replace("{{current_date}}", now)


def _make_handlers(
    controller: LoopController,
    *,
    work_dir: Path,
) -> dict[str, Any]:
    """Build handler map for Ark system functions."""
    reader = TextFileReader(work_dir)

    async def system_objective_fulfilled(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        outcome_text = args.get("objective_outcome", "")
        href = args.get("href", "/")

        # Resolve <file> tags in the outcome.
        resolved = await from_pidgin_string(outcome_text, reader)

        # Collect intermediate files from work_dir.
        from opal_backend.loop import FileData

        intermediate = []
        for root, _dirs, files in os.walk(work_dir):
            for fname in files:
                full_path = Path(root) / fname
                rel_path = str(full_path.relative_to(work_dir))
                try:
                    text = full_path.read_text(encoding="utf-8")
                    intermediate.append(
                        FileData(
                            path=rel_path,
                            content={"parts": [{"text": text}]},
                        )
                    )
                except (UnicodeDecodeError, OSError):
                    # Skip binary or unreadable files.
                    pass

        result_data = AgentResult(
            success=True,
            href=href,
            outcomes=resolved,
        )
        if intermediate:
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

    async def system_list_files(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        status_update = args.get("status_update")
        if status_cb and status_update:
            status_cb(status_update)
        elif status_cb:
            status_cb("Listing files")

        file_list = []
        for root, _dirs, files in os.walk(work_dir):
            for fname in files:
                full_path = Path(root) / fname
                rel_path = str(full_path.relative_to(work_dir))
                file_list.append(rel_path)
        return {"list": "\n".join(sorted(file_list)) if file_list else "(empty)"}

    async def system_write_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_name = args.get("file_name", "")
        content = args.get("content", "")

        if not file_name:
            return {"error": "file_name is required"}

        # Prevent path traversal.
        target = (work_dir / file_name).resolve()
        if not str(target).startswith(str(work_dir.resolve())):
            return {"error": "file_name must be within the working directory"}

        # Resolve <file> tags in the content.
        resolved = await from_pidgin_string(content, reader)
        text_parts = []
        for part in resolved.get("parts", []):
            if "text" in part:
                text_parts.append(part["text"])
        resolved_content = "\n".join(text_parts) if text_parts else content

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(resolved_content, encoding="utf-8")
        return {"file_path": str(target.relative_to(work_dir))}

    async def system_read_text_from_file(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        file_path = args.get("file_path", "")
        if not file_path:
            return {"error": "file_path is required"}

        target = (work_dir / file_path).resolve()
        if not str(target).startswith(str(work_dir.resolve())):
            return {"error": "file_path must be within the working directory"}

        if not target.exists():
            return {"error": f"File not found: {file_path}"}

        try:
            text = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return {"error": f"File is not a text file: {file_path}"}
        return {"text": text}

    async def system_create_task_tree(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        task_tree = args.get("task_tree")
        if not task_tree:
            return {"error": "task_tree is required"}

        tree_path = work_dir / "task_tree.json"
        tree_path.write_text(
            json.dumps(task_tree, indent=2), encoding="utf-8"
        )
        return {"file_path": "task_tree.json"}

    async def system_mark_completed_tasks(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        task_ids = args.get("task_ids", [])
        tree_path = work_dir / "task_tree.json"

        if not tree_path.exists():
            return {"error": "No task tree found. Create one first."}

        tree = json.loads(tree_path.read_text(encoding="utf-8"))

        def _mark(node: dict) -> None:
            if node.get("task_id") in task_ids:
                node["status"] = "complete"
            for sub in node.get("subtasks", []):
                _mark(sub)

        _mark(tree)
        tree_path.write_text(
            json.dumps(tree, indent=2), encoding="utf-8"
        )
        return {"file_path": "task_tree.json"}

    return {
        "system_objective_fulfilled": system_objective_fulfilled,
        "system_failed_to_fulfill_objective": system_failed_to_fulfill_objective,
        "system_list_files": system_list_files,
        "system_write_file": system_write_file,
        "system_read_text_from_file": system_read_text_from_file,
        "system_create_task_tree": system_create_task_tree,
        "system_mark_completed_tasks": system_mark_completed_tasks,
    }


def get_ark_system_group(
    controller: LoopController, *, work_dir: Path
) -> FunctionGroup:
    """Build the Ark system FunctionGroup backed by the real filesystem.

    Args:
        controller: The LoopController for termination functions.
        work_dir: The sandbox directory for file operations.

    Returns:
        A FunctionGroup with declarations, definitions, and instruction.
    """
    handlers = _make_handlers(controller, work_dir=work_dir)
    loaded = load_declarations("system", declarations_dir=_DECLARATIONS_DIR)
    return assemble_function_group(
        loaded,
        handlers,
        instruction_override=_build_instruction(),
    )
