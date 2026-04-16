# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tasks function group."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from bees.subagent_scope import SubagentScope

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


def _make_handlers(
    scope: SubagentScope | None = None,
    caller_ticket_id: str | None = None,
    scheduler: Any | None = None,
    ticket_id: str | None = None,
) -> dict[str, Any]:
    """Build the handler map for the tasks function group."""

    async def _tasks_list_types(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Listing available task types")
            
        allowed_tasks = []
        if caller_ticket_id:
            task = scheduler.store.get(caller_ticket_id) if scheduler else None
            if task and task.metadata.tasks:
                allowed_tasks = task.metadata.tasks
                
        task_types = []
        from bees.playbook import list_playbooks, load_playbook
        
        config_dir = scheduler.store.hive_dir / "config"
        
        for name in list_playbooks(config_dir):
            try:
                data = load_playbook(name, config_dir)
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
            
        from bees.playbook import load_playbook, stamp_child_task
        config_dir = scheduler.store.hive_dir / "config"
        try:
            load_playbook(task_type, config_dir)
        except FileNotFoundError:
            return {"error": f"Task type not found: {task_type}"}


        try:
            parent = scheduler.store.get(caller_ticket_id) if scheduler and caller_ticket_id else None
            if not parent:
                return {"error": "Parent ticket not found"}

            task = stamp_child_task(
                task_type,
                parent_task=parent,
                slug=slug,
                store=scheduler.store,
                context=objective,
                title=title or summary,
                scope=scope,
            )
            
        except Exception as e:
            logger.exception("tasks_create_task failed")
            return {"error": str(e)}
            
        if status_cb:
            status_cb(None, None)
            
        if wait_ms and scheduler:
            if status_cb:
                status_cb(f"Waiting for task {task.id}...")
            status = await scheduler.wait_for_task(task.id, wait_ms)
            if status_cb:
                status_cb(None, None)
                
            if status == "completed":
                fresh = scheduler.store.get(task.id) if scheduler else None
                return {"outcome": fresh.metadata.outcome if fresh else "completed"}
            else:
                return {"task_id": task.id, "status": status}
        
        return {"task_id": task.id, "status": task.metadata.status}

    async def _tasks_check_status(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Checking status of tasks")

        tasks: list[dict[str, Any]] = []
        if caller_ticket_id:
            from collections import defaultdict

            # Build an index: parent_task_id -> list of child tickets.
            children_of: dict[str, list[Any]] = defaultdict(list)
            for t in (scheduler.store.query_all() if scheduler else []):
                if t.metadata.parent_task_id:
                    children_of[t.metadata.parent_task_id].append(t)

            def _build_tree(parent_id: str) -> list[dict[str, Any]]:
                result: list[dict[str, Any]] = []
                for t in children_of.get(parent_id, []):
                    node: dict[str, Any] = {
                        "task_id": t.id,
                        "summary": t.metadata.title or "(no title)",
                        "status": t.metadata.status,
                    }
                    subtasks = _build_tree(t.id)
                    if subtasks:
                        node["subtasks"] = subtasks
                    result.append(node)
                return result

            tasks = _build_tree(caller_ticket_id)

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
            
        cancelled = scheduler.cancel_task(task_id)
        
        if status_cb:
            status_cb(None, None)
            
        if cancelled:
            return {"message": f"Task {task_id} cancellation requested."}
        else:
            return {"error": f"Task {task_id} not found."}

    async def _tasks_send_event(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        """Send a typed event to a child task's agent."""
        task_id = args.get("task_id")
        event_type = args.get("type", "")
        message = args.get("message", "")

        if not task_id:
            return {"error": "task_id is required"}
        if not event_type:
            return {"error": "type is required"}
        if not scheduler:
            return {"error": "Scheduler not available"}

        if status_cb:
            status_cb(f"Sending event to task {task_id}: {event_type}")

        try:
            update = {
                "type": event_type,
                "message": message,
                "from_ticket_id": ticket_id,
            }
            error = scheduler.deliver_to_task(
                task_id,
                update,
                expected_creator=caller_ticket_id,
            )
        except Exception as e:
            logger.exception("tasks_send_event failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        if error:
            return {"error": error}

        return {
            "task_id": task_id,
            "type": event_type,
            "delivered": True,
        }

    return {
        "tasks_list_types": _tasks_list_types,
        "tasks_create_task": _tasks_create_task,
        "tasks_check_status": _tasks_check_status,
        "tasks_cancel_task": _tasks_cancel_task,
        "tasks_send_event": _tasks_send_event,
    }


def get_tasks_function_group_factory(
    scope: SubagentScope | None = None,
    caller_ticket_id: str | None = None,
    scheduler: Any | None = None,
    ticket_id: str | None = None,
) -> FunctionGroupFactory:
    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(scope, caller_ticket_id, scheduler, ticket_id)
        return assemble_function_group(_LOADED, handlers)
    return factory
