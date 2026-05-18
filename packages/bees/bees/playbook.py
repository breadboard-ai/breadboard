# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Template loader and runner.

A template is an entry in ``hive/config/TEMPLATES.yaml`` that defines a
single agent task: an objective, tools, skills, and metadata.

Running a template creates one task and returns it.  If the template
declares ``autostart``, child tasks are stamped automatically.
"""

from __future__ import annotations

import importlib.util
import logging
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml

from bees.agent import Agent
from bees.config import HIVE_DIR
from bees.subagent_scope import SubagentScope

logger = logging.getLogger(__name__)




class PlaybookAborted(Exception):
    """Raised when a template's on_run_playbook hook declines to run."""


# ---------------------------------------------------------------------------
# Discovery and loading
# ---------------------------------------------------------------------------


def _load_templates(config_dir: Path) -> list[dict[str, Any]]:
    """Parse TEMPLATES.yaml and return the list of template dicts (legacy)."""
    templates_path = config_dir / "TEMPLATES.yaml"
    if not templates_path.exists():
        return []
    with open(templates_path) as f:
        data = yaml.safe_load(f)
    if not isinstance(data, list):
        logger.warning("TEMPLATES.yaml must be a list; got %s", type(data).__name__)
        return []
    return data


def load_all_templates(config_dir: Path, workspace_dir: Path | None = None) -> list[dict[str, Any]]:
    """Load and merge all templates from global and local sources."""
    templates: dict[str, dict[str, Any]] = {}

    def _load_file(path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        try:
            with open(path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if isinstance(data, dict):
                if "name" not in data:
                    data["name"] = path.stem
                return [data]
            elif isinstance(data, list):
                for i, item in enumerate(data):
                    if isinstance(item, dict) and "name" not in item:
                        item["name"] = f"{path.stem}_{i}"
                return [item for item in data if isinstance(item, dict)]
            else:
                logger.warning("Template file %s must be a list or dictionary; got %s", path, type(data).__name__)
        except Exception as e:
            logger.warning("Failed to load template from %s: %s", path, e)
        return []

    def _scan_dir(templates_dir: Path) -> list[dict[str, Any]]:
        items = []
        if not templates_dir.is_dir():
            return []
        for child in sorted(templates_dir.iterdir()):
            if child.is_file() and child.suffix in (".yaml", ".yml"):
                items.extend(_load_file(child))
        return items

    # 1. Global Legacy
    global_legacy = config_dir / "TEMPLATES.yaml"
    if global_legacy.exists():
        for item in _load_file(global_legacy):
            t_name = item.get("name")
            if t_name:
                templates[t_name] = item

    # 2. Local Workspace templates
    if workspace_dir:
        local_dir = workspace_dir / "templates"
        if local_dir.is_dir():
            for item in _scan_dir(local_dir):
                t_name = item.get("name")
                if t_name:
                    templates[t_name] = item



    return list(templates.values())


def list_playbooks(config_dir: Path, workspace_dir: Path | None = None) -> list[str]:
    """Return the names of all available templates."""
    return [t["name"] for t in load_all_templates(config_dir, workspace_dir) if "name" in t]


def load_playbook(name: str, config_dir: Path, workspace_dir: Path | None = None) -> dict[str, Any]:
    """Load a template by name."""
    for t in load_all_templates(config_dir, workspace_dir):
        if t.get("name") == name:
            return t
    raise FileNotFoundError(f"Template not found: {name}")




def _load_hooks(name: str, hooks_dir: Path) -> ModuleType | None:
    """Import a template's hooks module if it exists.

    Looks for ``hive/config/hooks/{name}.py``.
    """
    hooks_path = hooks_dir / f"{name}.py"
    if not hooks_path.exists():
        return None

    spec = importlib.util.spec_from_file_location(
        f"template_hooks.{name}", hooks_path,
    )
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_playbook(
    name: str,
    *,
    store: Any,
    context: str | None = None,
    owning_task_id: str | None = None,
    parent_task_id: str | None = None,
    slug: str | None = None,
    workspace_dir: Path | None = None,
    options: dict[str, Any] | None = None,
) -> Agent:
    """Create a task from a template.

    If ``owning_task_id`` is provided, the created task shares the
    parent task's workspace directory instead of getting its own.

    If the template has a hooks module with an ``on_run_playbook`` function,
    it is called before task creation. The hook receives the
    caller-supplied context and may return enriched context, or ``None``
    to abort the run (raises ``PlaybookAborted``).

    Returns the created task.
    """
    hive_dir = store.hive_dir
    config_dir = hive_dir / "config"
    hooks_dir = config_dir / "hooks"

    data = load_playbook(name, config_dir, workspace_dir)

    # Run on_run_playbook hook if present.
    hooks = _load_hooks(name, hooks_dir)
    if hooks and hasattr(hooks, "on_run_playbook"):
        context = hooks.on_run_playbook(context)
        if context is None:
            raise PlaybookAborted(
                f"Template '{name}' declined to run (on_run_playbook returned None)."
            )

    playbook_id = data.get("name", name)
    playbook_run_id = str(uuid.uuid4())

    agent = store.create(
        data.get("objective", ""),
        title=data.get("title"),
        functions=data.get("functions"),
        skills=data.get("skills"),
        tags=data.get("tags"),
        assignee=data.get("assignee"),
        model=data.get("model"),
        watch_events=data.get("watch_events"),
        tasks=data.get("tasks"),
        playbook_id=playbook_id,
        playbook_run_id=playbook_run_id,
        owning_task_id=owning_task_id,
        parent_task_id=parent_task_id,
        context=context,
        slug=slug,
        runner=data.get("runner", "generate"),
        voice=data.get("voice"),
        options=options,
    )

    # Autostart: stamp child tasks declared in the template.
    for child_name in data.get("autostart", []):
        try:
            stamp_child_task(
                child_name,
                parent=agent,
                slug=child_name,
                store=store,
            )
        except Exception as exc:
            logger.warning(
                "Autostart of '%s' for '%s' failed: %s",
                child_name, name, exc,
            )

    return agent


def stamp_child_task(
    template_name: str,
    *,
    parent: Agent,
    slug: str,
    store: Any,
    context: str | None = None,
    title: str | None = None,
    scope: SubagentScope | None = None,
    options: dict[str, Any] | None = None,
) -> Agent:
    """Create a child agent from a template under a parent.

    Handles SubagentScope composition, sandbox instructions, writable
    directory creation, and ``parent_id`` assignment — the shared
    logic for both ``autostart`` and ``tasks_create_task``.

    If *scope* is not provided, one is derived from the parent agent.
    """
    if scope is None:
        scope = SubagentScope.for_agent(parent)
    child_scope = scope.child(slug)

    child = run_playbook(
        template_name,
        store=store,
        context=context,
        owning_task_id=child_scope.workspace_root_id,
        parent_task_id=parent.id,
        slug=child_scope.slug_path,
        workspace_dir=parent.fs_dir,
        options=options,
    )

    if child_scope.slug_path:
        sandbox_block = child_scope.sandbox_instructions(child.metadata.runner)

        blocks = [
            f"<subagent_context>\n"
            f"Your parent id is: {parent.id}\n"
            f"</subagent_context>"
        ]
        if sandbox_block:
            blocks.append(sandbox_block)

        child.objective = f"{child.objective}\n\n" + "\n\n".join(blocks)
        store.save(child)
        child_scope.writable_dir(child.fs_dir).mkdir(
            parents=True, exist_ok=True,
        )

    if title:
        child.metadata.title = title

    child.metadata.parent_id = parent.id
    store.save_metadata(child)

    return child


def load_system_config(config_dir: Path) -> dict[str, Any]:
    """Load the hive system configuration from ``SYSTEM.yaml``.

    Returns a dict with keys like ``title``, ``description``, and ``root``.
    Returns an empty dict if the file doesn't exist.
    """
    system_path = config_dir / "SYSTEM.yaml"
    if not system_path.exists():
        return {}
    with open(system_path) as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        logger.warning("SYSTEM.yaml must be a mapping; got %s", type(data).__name__)
        return {}
    return data




def run_task_done_hooks(agent: Agent) -> None:
    """Run ``on_task_done`` for the template that owns this agent.

    Looks up the agent's ``playbook_id`` and, if the corresponding
    template defines an ``on_task_done(agent)`` hook, calls it.
    Agents not created by a template are silently skipped.
    """
    playbook_id = agent.metadata.playbook_id
    if not playbook_id:
        return

    hive_dir = agent.dir.parent.parent
    hooks_dir = hive_dir / "config" / "hooks"

    hooks = _load_hooks(playbook_id, hooks_dir)
    if hooks and hasattr(hooks, "on_task_done"):
        try:
            hooks.on_task_done(agent)
        except Exception as exc:
            logger.warning(
                "on_task_done hook for '%s' failed: %s", playbook_id, exc,
            )


def run_event_hooks(
    signal_type: str, payload: str, agent: Agent, store: Any,
) -> str | None:
    """Run ``on_event`` for the template that owns this agent.

    Called by the scheduler before delivering a coordination signal.
    The hook can inspect the signal, apply side effects (e.g., rename
    the agent), and decide whether to pass the signal through or eat it.

    Returns the (possibly transformed) payload to deliver, or ``None``
    to suppress delivery (eat the signal).

    Fail-open: if the hook raises, the signal is delivered as-is.
    """
    playbook_id = agent.metadata.playbook_id
    if not playbook_id:
        return payload

    hive_dir = agent.dir.parent.parent
    hooks_dir = hive_dir / "config" / "hooks"

    hooks = _load_hooks(playbook_id, hooks_dir)
    if not hooks or not hasattr(hooks, "on_event"):
        return payload

    try:
        return hooks.on_event(signal_type, payload, agent, store)
    except Exception as exc:
        logger.warning(
            "on_event hook for '%s' failed: %s", playbook_id, exc,
        )
        return payload
