# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the playbook module."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
import yaml

from bees.playbook import (
    load_playbook,
    load_system_config,
    run_playbook as _real_run_playbook,
    run_event_hooks,
    stamp_child_task as _real_stamp_child_task,
)
from bees.task_store import _DEP_PATTERN
from bees.task_store import TaskStore

GLOBAL_STORE = None

def run_playbook(name: str, **kwargs):
    assert GLOBAL_STORE is not None, "GLOBAL_STORE not initialized"
    return _real_run_playbook(name, store=GLOBAL_STORE, **kwargs)

def stamp_child_task(template_name: str, *, parent_task, slug, **kwargs):
    assert GLOBAL_STORE is not None, "GLOBAL_STORE not initialized"
    return _real_stamp_child_task(template_name, parent_task=parent_task, slug=slug, store=GLOBAL_STORE, **kwargs)

@pytest.fixture(autouse=True)
def _temp_dirs(tmp_path):
    """Redirect ticket and template storage to temp directories."""
    global GLOBAL_STORE
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    GLOBAL_STORE = TaskStore(tmp_path)

    config_dir = tmp_path / "config"
    config_dir.mkdir()
    hooks_dir = config_dir / "hooks"
    hooks_dir.mkdir()
    yield


@pytest.fixture
def write_template(tmp_path):
    """Helper to write template entries to the temp TEMPLATES.yaml.

    Accepts one or more template dicts and writes them as a YAML list.
    """
    templates_path = tmp_path / "config" / "TEMPLATES.yaml"

    def _write(*templates: dict) -> Path:
        templates_path.write_text(
            yaml.dump(list(templates), default_flow_style=False)
        )
        return templates_path

    return _write


@pytest.fixture
def hooks_dir(tmp_path):
    """Return the temp hooks directory for writing hook modules."""
    return tmp_path / "config" / "hooks"


# --- run_playbook ---


class TestRunPlaybook:

    def test_single_template(self, write_template):
        write_template({
            "name": "simple",
            "title": "Main Step",
            "objective": "Do the thing.",
            "functions": ["chat.*"],
            "skills": ["interview-user"],
            "tags": ["final"],
        })

        ticket = run_playbook("simple")

        assert ticket.metadata.status == "available"
        assert ticket.metadata.title == "Main Step"
        assert ticket.metadata.functions == ["chat.*"]
        assert ticket.metadata.skills == ["interview-user"]
        assert ticket.metadata.tags == ["final"]
        assert ticket.metadata.playbook_id == "simple"
        assert ticket.metadata.playbook_run_id is not None
        assert ticket.metadata.depends_on is None
        assert ticket.objective == "Do the thing."

    def test_not_found_raises(self, write_template):
        write_template({"name": "other", "objective": "something"})
        with pytest.raises(FileNotFoundError):
            run_playbook("nonexistent")

    def test_no_templates_file_raises(self):
        with pytest.raises(FileNotFoundError):
            run_playbook("anything")

    def test_model_propagates(self, write_template):
        write_template({
            "name": "with-model",
            "objective": "Do the thing.",
            "model": "gemini-2.5-pro",
        })

        ticket = run_playbook("with-model")
        assert ticket.metadata.model == "gemini-2.5-pro"

    def test_context_attached(self, write_template):
        write_template({
            "name": "briefed",
            "title": "Research",
            "objective": "Research the topic.",
        })

        ticket = run_playbook("briefed", context="All about dinosaurs")
        assert ticket.metadata.context == "All about dinosaurs"

    def test_context_none_when_not_provided(self, write_template):
        write_template({
            "name": "plain",
            "objective": "Do it.",
        })

        ticket = run_playbook("plain")
        assert ticket.metadata.context is None

    def test_assignee_propagates(self, write_template):
        write_template({
            "name": "with-assignee",
            "objective": "Do it.",
            "assignee": "app",
        })

        ticket = run_playbook("with-assignee")
        assert ticket.metadata.assignee == "app"

    def test_owning_task_id_propagates(self, write_template):
        write_template({
            "name": "sub",
            "objective": "step a",
        })

        ticket = run_playbook("sub", owning_task_id="caller-ticket")
        assert ticket.metadata.owning_task_id == "caller-ticket"

    def test_slug_propagates(self, write_template):
        write_template({
            "name": "sub",
            "objective": "step a",
        })

        ticket = run_playbook("sub", slug="my-slug")
        assert ticket.metadata.slug == "my-slug"

    def test_tasks_allowlist_propagates(self, write_template):
        write_template({
            "name": "orchestrator",
            "objective": "Manage stuff.",
            "tasks": ["worker-a", "worker-b"],
        })

        ticket = run_playbook("orchestrator")
        assert ticket.metadata.tasks == ["worker-a", "worker-b"]


# --- run_event_hooks ---


class TestRunEventHooks:

    def test_no_playbook_passes_through(self, write_template):
        ticket = GLOBAL_STORE.create("standalone objective")
        result = run_event_hooks("some_signal", "payload", ticket, GLOBAL_STORE)
        assert result == "payload"

    def test_no_hook_passes_through(self, write_template):
        write_template({
            "name": "no-hook",
            "objective": "Do it.",
        })
        ticket = run_playbook("no-hook")
        result = run_event_hooks("some_signal", "payload", ticket, GLOBAL_STORE)
        assert result == "payload"

    def test_hook_eats_event(self, write_template, hooks_dir):
        write_template({
            "name": "eater",
            "objective": "Do it.",
        })
        (hooks_dir / "eater.py").write_text(
            "def on_event(signal_type, payload, ticket, store=None):\n"
            "    return None\n"
        )
        ticket = run_playbook("eater")
        result = run_event_hooks("any_signal", "payload", ticket, GLOBAL_STORE)
        assert result is None

    def test_hook_transforms_payload(self, write_template, hooks_dir):
        write_template({
            "name": "transformer",
            "objective": "Do it.",
        })
        (hooks_dir / "transformer.py").write_text(
            "def on_event(signal_type, payload, ticket, store=None):\n"
            "    return payload.upper()\n"
        )
        ticket = run_playbook("transformer")
        result = run_event_hooks("any_signal", "hello", ticket, GLOBAL_STORE)
        assert result == "HELLO"

    def test_hook_raises_fails_open(self, write_template, hooks_dir):
        write_template({
            "name": "crasher",
            "objective": "Do it.",
        })
        (hooks_dir / "crasher.py").write_text(
            "def on_event(signal_type, payload, ticket, store=None):\n"
            "    raise RuntimeError('boom')\n"
        )
        ticket = run_playbook("crasher")
        result = run_event_hooks("any_signal", "payload", ticket, GLOBAL_STORE)
        assert result == "payload"

    def test_hook_mutates_ticket_metadata(self, write_template, hooks_dir):
        write_template({
            "name": "renamer",
            "title": "Original Title",
            "objective": "Do it.",
        })
        (hooks_dir / "renamer.py").write_text(
            "def on_event(signal_type, payload, ticket, store):\n"
            "    if signal_type == 'update_title':\n"
            "        ticket.metadata.title = payload\n"
            "        store.save_metadata(ticket)\n"
            "        return None\n"
            "    return payload\n"
        )
        ticket = run_playbook("renamer")
        assert ticket.metadata.title == "Original Title"

        result = run_event_hooks("update_title", "New Title", ticket, GLOBAL_STORE)
        assert result is None
        assert ticket.metadata.title == "New Title"


# --- Ticket path resolution ---


class TestTicketPaths:
    """Tests for Ticket.dir and Ticket.fs_dir path resolution."""

    def test_dir_always_top_level(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata

        t = Ticket(
            id="abc-123",
            objective="test",
            dir=GLOBAL_STORE.tickets_dir / "abc-123",
            metadata=TicketMetadata(
                playbook_run_id="run-456",
                owning_task_id="run-789",
            ),
        )
        assert t.dir == GLOBAL_STORE.tickets_dir / "abc-123"

    def test_fs_dir_with_owning_task_id(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata

        t = Ticket(
            id="abc-123",
            objective="test",
            dir=GLOBAL_STORE.tickets_dir / "abc-123",
            metadata=TicketMetadata(owning_task_id="parent-ticket"),
        )
        assert t.fs_dir == GLOBAL_STORE.tickets_dir / "parent-ticket" / "filesystem"

    def test_fs_dir_plain_ticket(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata

        t = Ticket(
            id="abc-123",
            objective="test",
            dir=GLOBAL_STORE.tickets_dir / "abc-123",
            metadata=TicketMetadata(),
        )
        assert t.fs_dir == GLOBAL_STORE.tickets_dir / "abc-123" / "filesystem"

    def test_fs_dir_playbook_run_id_alone_uses_own_dir(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata

        t = Ticket(
            id="abc-123",
            objective="test",
            dir=GLOBAL_STORE.tickets_dir / "abc-123",
            metadata=TicketMetadata(playbook_run_id="pb-run"),
        )
        assert t.fs_dir == GLOBAL_STORE.tickets_dir / "abc-123" / "filesystem"

    def test_fs_dir_parent_takes_precedence(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata

        t = Ticket(
            id="abc-123",
            objective="test",
            dir=GLOBAL_STORE.tickets_dir / "abc-123",
            metadata=TicketMetadata(
                playbook_run_id="pb-run",
                owning_task_id="parent-ticket",
            ),
        )
        assert t.fs_dir == GLOBAL_STORE.tickets_dir / "parent-ticket" / "filesystem"




class TestLoadSystemConfig:

    def test_loads_config(self, tmp_path):
        system_path = tmp_path / "config" / "SYSTEM.yaml"
        system_path.write_text(yaml.dump({
            "title": "Opal",
            "description": "Personal assistant",
            "root": "opie",
        }))

        config = load_system_config(tmp_path / "config")
        assert config["title"] == "Opal"
        assert config["root"] == "opie"

    def test_returns_empty_when_missing(self, tmp_path):
        config = load_system_config(tmp_path / "config")
        assert config == {}


# --- stamp_child_task ---


class TestStampChildTask:

    def test_creates_child_with_correct_hierarchy(self, write_template):
        write_template(
            {"name": "parent", "objective": "Manage."},
            {"name": "worker", "objective": "Do work."},
        )

        parent = run_playbook("parent")
        child = stamp_child_task(
            "worker", parent_task=parent, slug="my-worker",
        )

        assert child.metadata.parent_task_id == parent.id
        assert child.metadata.owning_task_id == parent.id
        assert child.metadata.slug == "my-worker"
        assert child.metadata.playbook_id == "worker"

    def test_sandbox_instructions_appended(self, write_template):
        write_template(
            {"name": "parent", "objective": "Manage."},
            {"name": "worker", "objective": "Do work."},
        )

        parent = run_playbook("parent")
        child = stamp_child_task(
            "worker", parent_task=parent, slug="my-worker",
        )

        assert "<sandbox_environment>" in child.objective
        assert "my-worker" in child.objective
        assert "<subagent_context>" in child.objective

    def test_writable_dir_created(self, write_template):
        write_template(
            {"name": "parent", "objective": "Manage."},
            {"name": "worker", "objective": "Do work."},
        )

        parent = run_playbook("parent")
        child = stamp_child_task(
            "worker", parent_task=parent, slug="my-worker",
        )

        writable = child.fs_dir / "my-worker"
        assert writable.is_dir()

    def test_context_propagates(self, write_template):
        write_template(
            {"name": "parent", "objective": "Manage."},
            {"name": "worker", "objective": "Do {{system.context}}"},
        )

        parent = run_playbook("parent")
        child = stamp_child_task(
            "worker", parent_task=parent, slug="w",
            context="the important thing",
        )

        assert child.metadata.context == "the important thing"

    def test_title_override(self, write_template):
        write_template(
            {"name": "parent", "objective": "Manage."},
            {"name": "worker", "title": "Default Title", "objective": "Do work."},
        )

        parent = run_playbook("parent")
        child = stamp_child_task(
            "worker", parent_task=parent, slug="w",
            title="Custom Title",
        )

        assert child.metadata.title == "Custom Title"


# --- autostart ---


class TestAutostart:

    def test_autostart_creates_child_tickets(self, write_template):
        write_template(
            {"name": "boss", "objective": "Manage.", "autostart": ["helper"]},
            {"name": "helper", "objective": "Help."},
        )

        parent = run_playbook("boss")

        all_tickets = GLOBAL_STORE.query_all()
        children = [t for t in all_tickets if t.metadata.parent_task_id == parent.id]

        assert len(children) == 1
        child = children[0]
        assert child.metadata.playbook_id == "helper"
        assert child.metadata.slug == "helper"
        assert child.metadata.owning_task_id == parent.id

    def test_autostart_empty_creates_no_children(self, write_template):
        write_template(
            {"name": "solo", "objective": "Work alone."},
        )

        parent = run_playbook("solo")

        all_tickets = GLOBAL_STORE.query_all()
        children = [t for t in all_tickets if t.metadata.parent_task_id == parent.id]

        assert len(children) == 0

    def test_autostart_failed_child_does_not_block_parent(self, write_template):
        write_template(
            {"name": "boss", "objective": "Manage.", "autostart": ["nonexistent"]},
        )

        # Should not raise — the failed autostart is logged and skipped.
        parent = run_playbook("boss")
        assert parent.metadata.status == "available"

    def test_autostart_multiple_children(self, write_template):
        write_template(
            {"name": "boss", "objective": "Manage.", "autostart": ["a", "b"]},
            {"name": "a", "objective": "Do A."},
            {"name": "b", "objective": "Do B."},
        )

        parent = run_playbook("boss")

        all_tickets = GLOBAL_STORE.query_all()
        children = [t for t in all_tickets if t.metadata.parent_task_id == parent.id]

        assert len(children) == 2
        slugs = {c.metadata.slug for c in children}
        assert slugs == {"a", "b"}
