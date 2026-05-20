# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Agents function group — slug-based agent management with implicit creation.

Replaces the ``tasks_*`` function group with a model where agents are
persistent named entities. The parent assigns tasks by ``(type, slug)``
and the handler materializes agents on demand.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from bees.context_updates import updates_to_context_parts
from bees.protocols.handler_types import (
    CONTEXT_PARTS_KEY,
    SuspendError,
    WaitForInputEvent,
)
from bees.subagent_scope import SubagentScope

from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)

__all__ = ["get_agents_function_group_factory"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"
_LOADED = load_declarations("agents", declarations_dir=_DECLARATIONS_DIR)


def _make_handlers(
    scope: SubagentScope | None = None,
    caller_agent_id: str | None = None,
    scheduler: Any | None = None,
) -> dict[str, Any]:
    """Build the handler map for the agents function group."""

    async def _agents_list_types(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Listing available agent types")

        allowed_tasks = []
        workspace_dir = None
        if caller_agent_id:
            agent = scheduler.store.get(caller_agent_id) if scheduler else None
            if agent:
                workspace_dir = agent.fs_dir
                if agent.metadata.tasks:
                    allowed_tasks = agent.metadata.tasks

        agent_types = []
        from bees.playbook import list_playbooks, load_playbook

        config_dir = scheduler.store.hive_dir / "config"

        global_names = set(list_playbooks(config_dir))
        all_names = list_playbooks(config_dir, workspace_dir)

        for name in all_names:
            try:
                data = load_playbook(name, config_dir, workspace_dir)
                type_name = data.get("name", name)
                is_local = type_name not in global_names

                if is_local or type_name in allowed_tasks:
                    item = {
                        "name": type_name,
                        "title": data.get("title", name),
                        "description": data.get("description", ""),
                    }
                    if "options_schema" in data:
                        item["options_schema"] = data["options_schema"]
                    agent_types.append(item)
            except Exception as e:
                logger.warning("agents_list_types: skipping invalid %s: %s", name, e)

        if status_cb:
            status_cb(None, None)

        return {"agent_types": agent_types}

    async def _agents_assign_task(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        agent_type = args.get("type")
        slug = args.get("slug")
        objective = args.get("objective")
        summary = args.get("summary")
        title = args.get("title")
        options = args.get("options")

        if not all([agent_type, slug, objective, summary]):
            return {"error": "type, slug, objective, and summary are required"}

        if status_cb:
            status_cb(f"Assigning task to agent: {slug}")

        if not scheduler:
            return {"error": "Scheduler not available"}

        parent = scheduler.store.get(caller_agent_id) if caller_agent_id else None
        if not parent:
            return {"error": "Parent agent not found"}

        # Validate agent type.
        from bees.playbook import load_playbook
        config_dir = scheduler.store.hive_dir / "config"
        workspace_dir = parent.fs_dir

        try:
            playbook_data = load_playbook(agent_type, config_dir, workspace_dir)
        except FileNotFoundError:
            return {"error": f"Agent type not found: {agent_type}"}

        # Validate options if provided.
        if options:
            options_schema = playbook_data.get("options_schema")
            if not options_schema:
                return {"error": f"Agent type '{agent_type}' does not support configuration options."}

            supported_keys = set(options_schema.keys())
            provided_keys = set(options.keys())
            unknown_keys = provided_keys - supported_keys
            if unknown_keys:
                unknown_str = ", ".join(sorted(unknown_keys))
                supported_str = ", ".join(sorted(supported_keys))
                return {"error": f"Invalid option(s): {unknown_str}. Supported options for '{agent_type}' are: {supported_str}."}

            for key, value in options.items():
                prop_schema = options_schema.get(key)
                if prop_schema and "enum" in prop_schema:
                    valid_values = prop_schema["enum"]
                    if value not in valid_values:
                        valid_str = ", ".join(str(v) for v in valid_values)
                        return {"error": f"Invalid value '{value}' for option '{key}'. Valid values for '{key}' in '{agent_type}' are: {valid_str}."}

        # Resolve: does this slug already exist under this parent?
        existing = scheduler.store.find_child_by_slug(caller_agent_id, slug)

        try:
            if existing is None:
                # New agent — create from template.
                from bees.playbook import stamp_child_task
                child = stamp_child_task(
                    agent_type,
                    parent=parent,
                    slug=slug,
                    store=scheduler.store,
                    context=objective,
                    title=title or summary,
                    scope=scope,
                    options=options,
                )
                if status_cb:
                    status_cb(None, None)
                return {"agent_slug": slug, "status": "created"}

            _TERMINAL = {"completed", "failed", "cancelled"}
            if existing.metadata.status in _TERMINAL:
                # Fresh instance — reuse the agent with a new session.
                scheduler.store.reset_for_reuse(
                    existing,
                    objective,
                    title=title or summary,
                    options=options,
                )

                # Re-stamp objective with sandbox instructions.
                if scope:
                    child_scope = scope.child(slug)
                    sandbox_block = child_scope.sandbox_instructions(existing.metadata.runner)
                    blocks = [
                        f"<subagent_context>\n"
                        f"Your parent id is: {parent.id}\n"
                        f"</subagent_context>"
                    ]
                    if sandbox_block:
                        blocks.append(sandbox_block)
                    full_objective = f"{objective}\n\n" + "\n\n".join(blocks)
                    existing.objective = full_objective
                    objective_path = existing.dir / "objective.md"
                    objective_path.write_text(full_objective)
                    scheduler.store.save_metadata(existing)

                if status_cb:
                    status_cb(None, None)
                return {"agent_slug": slug, "status": "reused"}

            # Non-terminal: agent is busy or suspended.
            if existing.metadata.finite:
                # Finite agents process one task at a time via fresh instances.
                if status_cb:
                    status_cb(None, None)
                return {
                    "error": f"Agent '{slug}' is currently busy "
                    f"(status: {existing.metadata.status}). "
                    f"Wait for it to complete before assigning a new task."
                }

            # Infinite agent: queue the task for delivery.
            task_file_store = getattr(scheduler.store, '_task_file_store', None)
            if task_file_store:
                task_file_store.create(
                    objective=objective,
                    assignee=existing.id,
                    created_by=caller_agent_id,
                    kind="work",
                    title=title or summary,
                )

            # Deliver task assignment as a context update.
            task_update = {
                "type": "task_assigned",
                "objective": objective,
                "from_slug": scope.slug_path if scope else None,
            }
            scheduler.deliver_to_task(
                existing.id,
                task_update,
                expected_creator=None,  # Allow self-delivery.
            )

            if status_cb:
                status_cb(None, None)
            return {"agent_slug": slug, "status": "queued"}

        except Exception as e:
            logger.exception("agents_assign_task failed")
            return {"error": str(e)}

    async def _agents_check_status(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        if status_cb:
            status_cb("Checking agent status")

        agents: list[dict[str, Any]] = []
        if caller_agent_id:
            from collections import defaultdict

            # Build index: parent_id -> children.
            children_of: dict[str, list[Any]] = defaultdict(list)
            for a in (scheduler.store.query_all() if scheduler else []):
                if a.metadata.parent_id:
                    children_of[a.metadata.parent_id].append(a)

            def _build_tree(parent_id: str) -> list[dict[str, Any]]:
                result: list[dict[str, Any]] = []
                for a in children_of.get(parent_id, []):
                    slug = a.metadata.slug or ""
                    tail = slug.rsplit("/", 1)[-1] if "/" in slug else slug
                    node: dict[str, Any] = {
                        "agent_slug": tail or a.id[:8],
                        "type": a.metadata.type or a.metadata.playbook_id or "",
                        "status": a.metadata.status,
                    }
                    if a.metadata.outcome:
                        node["outcome"] = a.metadata.outcome
                    if a.metadata.error:
                        node["error"] = a.metadata.error
                    children = _build_tree(a.id)
                    if children:
                        node["agents"] = children
                    result.append(node)
                return result

            agents = _build_tree(caller_agent_id)

        if status_cb:
            status_cb(None, None)

        if not agents:
            return {"message": "There are no agents."}

        return {"agents": agents}

    async def _agents_cancel(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        """Cancel a named child agent."""
        slug = args.get("slug", "")

        if not slug:
            return {"error": "slug is required"}
        if not scheduler:
            return {"error": "Scheduler not available"}

        if status_cb:
            status_cb(f"Cancelling agent: {slug}")

        # Resolve slug to agent ID.
        child = scheduler.store.find_child_by_slug(caller_agent_id, slug)
        if not child:
            return {"error": f"Agent '{slug}' not found"}

        cancelled = scheduler.cancel_task(child.id)

        if status_cb:
            status_cb(None, None)

        if cancelled:
            return {"agent_slug": slug, "cancelled": True}
        else:
            return {"error": f"Agent '{slug}' could not be cancelled"}

    async def _agents_await(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
        """Suspend until a context update arrives.

        If updates are already buffered, returns them immediately without
        suspending. Otherwise raises ``SuspendError`` and the scheduler
        resumes the agent when an update is delivered.
        """
        # Check for already-buffered context updates.
        if caller_agent_id and scheduler:
            agent = scheduler.store.get(caller_agent_id)
            if agent and agent.metadata.pending_context_updates:
                updates = agent.metadata.pending_context_updates
                agent.metadata.pending_context_updates = []
                scheduler.store.save_metadata(agent)
                return {
                    "resumed": True,
                    CONTEXT_PARTS_KEY: updates_to_context_parts(updates),
                }

        # No updates pending — suspend.
        request_id = str(uuid.uuid4())
        event = WaitForInputEvent(
            request_id=request_id,
            prompt={},
            input_type="any",
        )
        function_call_part = {
            "functionCall": {
                "name": "agents_await",
                "args": args,
            }
        }
        raise SuspendError(event, function_call_part)

    return {
        "agents_list_types": _agents_list_types,
        "agents_assign_task": _agents_assign_task,
        "agents_check_status": _agents_check_status,
        "agents_cancel": _agents_cancel,
        "agents_await": _agents_await,
    }


def get_agents_function_group_factory(
    scope: SubagentScope | None = None,
    caller_agent_id: str | None = None,
    scheduler: Any | None = None,
) -> FunctionGroupFactory:
    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(scope, caller_agent_id, scheduler)
        return assemble_function_group(_LOADED, handlers)
    return factory
