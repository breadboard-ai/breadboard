# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tasks function group."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    SessionHooks,
    assemble_function_group,
    load_declarations,
    FunctionGroupFactory,
)

__all__ = ["get_tasks_function_group_factory"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"
_LOADED = load_declarations("tasks", declarations_dir=_DECLARATIONS_DIR)


def _make_handlers(workspace_root_id: str | None = None, scheduler: Any | None = None) -> dict[str, Any]:
    """Build the handler map for the tasks function group."""

    async def _tasks_list_types(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Listing available task types")
            
        allowed_tasks = []
        if workspace_root_id:
            from bees.ticket import load_ticket
            ticket = load_ticket(workspace_root_id)
            if ticket and ticket.metadata.tasks:
                allowed_tasks = ticket.metadata.tasks
                
        task_types = []
        from bees.playbook import list_playbooks, load_playbook, validate_task_template
        
        for name in list_playbooks():
            try:
                data = load_playbook(name)
                if validate_task_template(data):
                    task_name = data.get("name", name)
                    if task_name in allowed_tasks:
                        task_types.append({
                            "name": task_name,
                            "title": data.get("title", name),
                            "description": data.get("description", ""),
                        })
            except Exception as e:
                logger.warning("tasks_list_types: skipping invalid %s: %s", name, e)
                
        if status_cb:
            status_cb(None, None)
            
        return {"task_types": task_types}

    async def _tasks_create_task(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        title = args.get("title")
        task_type = args.get("type")
        summary = args.get("summary")
        objective = args.get("objective")
        slug = args.get("slug")
        wait_ms = args.get("wait_ms_before_async")
        
        if not all([task_type, summary, objective, slug]):
            return {"error": "type, summary, objective, and slug are required"}
            
        if status_cb:
            status_cb(f"Creating task of type: {task_type}")
            
        from bees.playbook import load_playbook, validate_task_template
        try:
            data = load_playbook(task_type)
            if not validate_task_template(data):
                return {"error": f"Invalid task template: {task_type}"}
        except FileNotFoundError:
            return {"error": f"Task type not found: {task_type}"}
            
        from bees.playbook import run_playbook
        try:
            tickets = run_playbook(
                task_type,
                context=objective,
                parent_ticket_id=workspace_root_id,
                slug=slug,
            )
            if not tickets:
                return {"error": "Failed to create task ticket"}
            
            ticket = tickets[0]
            
            if slug:
                ticket.objective = f"{ticket.objective}\n\n<subagent_context>\nYour parent id is: {workspace_root_id}\n</subagent_context>\n<sandbox_environment>\nYour current working directory is the root of the workspace.\nYou are assigned to work in the subdirectory: ./{slug}\nCRITICAL: You must prefix all file paths with {slug}/ when creating or writing files (e.g., using system_write_file or redirection in bash). Writes to the root directory or other directories will fail.\nYou can read files from anywhere in the workspace.\n</sandbox_environment>"
                ticket.save()
                (ticket.fs_dir / slug).mkdir(parents=True, exist_ok=True)
                
            if title:
                ticket.metadata.title = title
            elif summary:
                ticket.metadata.title = summary
                
            ticket.metadata.creator_ticket_id = workspace_root_id
            ticket.save_metadata()
            
        except Exception as e:
            logger.exception("tasks_create_task failed")
            return {"error": str(e)}
            
        if status_cb:
            status_cb(None, None)
            
        if wait_ms and scheduler:
            if status_cb:
                status_cb(f"Waiting for task {ticket.id}...")
            status = await scheduler.wait_for_ticket(ticket.id, wait_ms)
            if status_cb:
                status_cb(None, None)
                
            if status == "completed":
                from bees.ticket import load_ticket
                fresh = load_ticket(ticket.id)
                return {"outcome": fresh.metadata.outcome if fresh else "completed"}
            else:
                return {"task_id": ticket.id, "status": status}
        
        return {"task_id": ticket.id, "status": ticket.metadata.status}

    async def _tasks_check_status(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Checking status of tasks")
            
        tasks = []
        if workspace_root_id:
            from bees.ticket import TICKETS_DIR, load_ticket
            
            if TICKETS_DIR.exists():
                for entry in TICKETS_DIR.iterdir():
                    if not entry.is_dir():
                        continue
                    try:
                        ticket = load_ticket(entry.name)
                        if ticket and ticket.metadata.creator_ticket_id == workspace_root_id:
                            tasks.append({
                                "task_id": ticket.id,
                                "summary": ticket.metadata.title or "(no title)",
                                "status": ticket.metadata.status,
                            })
                    except Exception as e:
                        logger.warning("tasks_check_status: failed to read ticket %s: %s", entry.name, e)
                        
        if status_cb:
            status_cb(None, None)
            
        if not tasks:
            return {"message": "There are no tasks."}
            
        return {"tasks": tasks}

    async def _tasks_cancel_task(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        task_id = args.get("task_id")
        if not task_id:
            return {"error": "task_id is required"}
            
        if status_cb:
            status_cb(f"Cancelling task {task_id}")
            
        if not scheduler:
            return {"error": "Scheduler not available in handler"}
            
        cancelled = scheduler.cancel_ticket(task_id)
        
        if status_cb:
            status_cb(None, None)
            
        if cancelled:
            return {"message": f"Task {task_id} cancellation requested."}
        else:
            return {"error": f"Task {task_id} not found."}

    return {
        "tasks_list_types": _tasks_list_types,
        "tasks_create_task": _tasks_create_task,
        "tasks_check_status": _tasks_check_status,
        "tasks_cancel_task": _tasks_cancel_task,
    }


def get_tasks_function_group_factory(workspace_root_id: str | None = None, scheduler: Any | None = None) -> FunctionGroupFactory:
    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(workspace_root_id, scheduler)
        return assemble_function_group(_LOADED, handlers)
    return factory
