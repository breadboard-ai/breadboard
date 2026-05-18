# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for dynamic, workspace-scoped sub-agents and templates."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
import pytest
import yaml

from bees.playbook import (
    load_all_templates,
    list_playbooks,
    load_playbook,
    run_playbook,
    stamp_child_task,
)
from bees.unified_agent_store import UnifiedAgentStore
from bees.provisioner import provision_session
from bees.subagent_scope import SubagentScope

@pytest.fixture
def temp_hive(tmp_path):
    """Set up a temporary hive directory structure."""
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    
    # Write global legacy templates
    templates_path = config_dir / "TEMPLATES.yaml"
    global_templates = [
        {
            "name": "opie",
            "title": "Opie Assistant",
            "objective": "Help the user.",
            "tasks": ["researcher"],
        },
        {
            "name": "researcher",
            "title": "Researcher Agent",
            "objective": "Research things.",
        }
    ]
    templates_path.write_text(yaml.dump(global_templates, default_flow_style=False))
    
    return tmp_path


def test_seeding_global_templates(temp_hive):
    """Verify that provision_session seeds global templates into templates/*.yaml."""
    store = UnifiedAgentStore(temp_hive)
    parent_task = store.create(
        "Test objective",
        title="Test Task",
        playbook_id="opie",
        tasks=["researcher"],
    )
    
    # Provision the session
    config = provision_session(
        segments=[],
        ticket_id=parent_task.id,
        ticket_dir=parent_task.dir,
        hive_dir=temp_hive,
        scope=SubagentScope.for_agent(parent_task),
    )
    
    # Verify that templates are seeded in workspace/templates/
    templates_dir = parent_task.fs_dir / "templates"
    assert templates_dir.is_dir()
    assert (templates_dir / "opie.yaml").is_file()
    assert (templates_dir / "researcher.yaml").is_file()
    
    # Verify contents
    opie_data = yaml.safe_load((templates_dir / "opie.yaml").read_text())
    assert opie_data["name"] == "opie"
    assert opie_data["title"] == "Opie Assistant"


def test_dynamic_template_loading(temp_hive):
    """Verify that load_all_templates loads both global and local workspace templates."""
    store = UnifiedAgentStore(temp_hive)
    parent_task = store.create(
        "Test objective",
        title="Test Task",
        playbook_id="opie",
    )
    
    config_dir = temp_hive / "config"
    workspace_dir = parent_task.fs_dir
    
    # 1. Initially, only global templates are loaded
    all_templates = load_all_templates(config_dir, workspace_dir)
    global_names = {t["name"] for t in all_templates}
    assert "opie" in global_names
    assert "researcher" in global_names
    assert "custom-worker" not in global_names
    
    # 2. Write a custom template directly in the workspace
    local_templates_dir = workspace_dir / "templates"
    local_templates_dir.mkdir(parents=True, exist_ok=True)
    custom_template = {
        "name": "custom-worker",
        "title": "Custom Worker",
        "objective": "Execute custom task.",
    }
    (local_templates_dir / "custom-worker.yaml").write_text(yaml.dump(custom_template))
    
    # 3. Re-load templates and verify the custom one is included
    all_templates_scoped = load_all_templates(config_dir, workspace_dir)
    names_scoped = {t["name"] for t in all_templates_scoped}
    assert "opie" in names_scoped
    assert "researcher" in names_scoped
    assert "custom-worker" in names_scoped
    
    # 4. Verify override capability: overwrite researcher locally
    override_template = {
        "name": "researcher",
        "title": "Overridden Researcher",
        "objective": "Supercharged research objective.",
    }
    (local_templates_dir / "researcher.yaml").write_text(yaml.dump(override_template))
    
    loaded_override = load_playbook("researcher", config_dir, workspace_dir)
    assert loaded_override["title"] == "Overridden Researcher"
    assert loaded_override["objective"] == "Supercharged research objective."


@pytest.mark.asyncio
async def test_tasks_list_types_dynamic_allowed(temp_hive):
    """Verify tasks_list_types handles dynamic allowed and local workspace templates."""
    from bees.functions.tasks import get_tasks_function_group_factory
    
    store = UnifiedAgentStore(temp_hive)
    parent_task = store.create(
        "Test objective",
        title="Test Task",
        playbook_id="opie",
        tasks=["researcher"], # only researcher is statically allowed globally
    )
    
    # Ensure templates folder exists and write a custom worker
    workspace_dir = parent_task.fs_dir
    local_templates_dir = workspace_dir / "templates"
    local_templates_dir.mkdir(parents=True, exist_ok=True)
    
    custom_template = {
        "name": "custom-worker",
        "title": "Custom Worker",
        "objective": "Execute custom task.",
    }
    (local_templates_dir / "custom-worker.yaml").write_text(yaml.dump(custom_template))
    
    # Mock scheduler and hooks
    class MockScheduler:
        def __init__(self, store):
            self.store = store
    
    scheduler = MockScheduler(store)
    
    factory = get_tasks_function_group_factory(
        scope=SubagentScope.for_agent(parent_task),
        caller_ticket_id=parent_task.id,
        scheduler=scheduler,
        ticket_id=parent_task.id,
    )
    
    # Duck-typed class satisfying SessionHooks
    class MockHooks:
        @property
        def controller(self):
            return None
        @property
        def file_system(self):
            return None
        @property
        def task_tree_manager(self):
            return None
        
    group = factory(MockHooks())
    
    # Retrieve function handlers from definitions
    list_types = next(d.handler for name, d in group.definitions if name == "tasks_list_types")
    
    # Call tasks_list_types
    result = await list_types({}, None)
    task_types = result.get("task_types", [])
    
    # Verify that:
    # - 'researcher' is included (statically allowed global)
    # - 'custom-worker' is included (dynamically allowed workspace template)
    # - 'opie' is filtered out (global but not in tasks allowlist)
    names = {t["name"] for t in task_types}
    assert "researcher" in names
    assert "custom-worker" in names
    assert "opie" not in names


@pytest.mark.asyncio
async def test_tasks_create_task_dynamic(temp_hive):
    """Verify tasks_create_task successfully creates task from dynamically authored templates."""
    from bees.functions.tasks import get_tasks_function_group_factory
    
    store = UnifiedAgentStore(temp_hive)
    parent = store.create(
        "Test objective",
        title="Test Task",
        playbook_id="opie",
        tasks=["researcher"],
    )
    
    # Add dynamic template
    workspace_dir = parent.fs_dir
    local_templates_dir = workspace_dir / "templates"
    local_templates_dir.mkdir(parents=True, exist_ok=True)
    
    custom_template = {
        "name": "custom-worker",
        "title": "Custom Worker",
        "objective": "Execute custom task for {{system.context}}.",
    }
    (local_templates_dir / "custom-worker.yaml").write_text(yaml.dump(custom_template))
    
    class MockScheduler:
        def __init__(self, store):
            self.store = store
            self.tasks_delivered = []
        async def wait_for_task(self, task_id, wait_ms):
            return "completed"
            
    scheduler = MockScheduler(store)
    
    factory = get_tasks_function_group_factory(
        scope=SubagentScope.for_agent(parent),
        caller_ticket_id=parent.id,
        scheduler=scheduler,
        ticket_id=parent.id,
    )
    
    class MockHooks:
        @property
        def controller(self):
            return None
        @property
        def file_system(self):
            return None
        @property
        def task_tree_manager(self):
            return None

    group = factory(MockHooks())
    create_task = next(d.handler for name, d in group.definitions if name == "tasks_create_task")
    
    # Spawn child task using custom template
    args = {
        "type": "custom-worker",
        "summary": "My Custom Run",
        "objective": "some custom parameters",
        "slug": "custom-run",
    }
    
    result = await create_task(args, None)
    assert "error" not in result
    
    # Verify child was written to store successfully
    all_agents = store.query_all()
    child_agents = [a for a in all_agents if a.metadata.parent_id == parent.id]
    assert len(child_agents) == 1
    
    child = child_agents[0]
    assert child.metadata.playbook_id == "custom-worker"
    assert child.metadata.slug == "custom-run"
    assert child.metadata.context == "some custom parameters"


def test_templates_protection_during_hydration(tmp_path):
    """Verify that hydrate_from_snapshot protects the templates folder from being unlinked."""
    from bees.disk_file_system import DiskFileSystem
    
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    
    fs = DiskFileSystem(work_dir)
    
    # 1. Create a simple text file in workspace
    fs.write("notes.txt", "hello")
    
    # 2. Capture snapshot (only contains notes.txt)
    snapshot = fs.snapshot
    assert "notes.txt" in snapshot.files
    assert "templates/my-template.yaml" not in snapshot.files
    
    # 3. Simulate writing a template file from the outside
    templates_dir = work_dir / "templates"
    templates_dir.mkdir()
    (templates_dir / "my-template.yaml").write_text("name: my-template", encoding="utf-8")
    assert (templates_dir / "my-template.yaml").is_file()
    
    # 4. Call hydrate_from_snapshot
    fs.hydrate_from_snapshot(snapshot)
    
    # 5. Assert notes.txt is restored and my-template.yaml survives!
    assert (work_dir / "notes.txt").is_file()
    assert (templates_dir / "my-template.yaml").is_file()
    assert (templates_dir / "my-template.yaml").read_text(encoding="utf-8") == "name: my-template"
