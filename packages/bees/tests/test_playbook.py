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
    run_playbook,
    run_event_hooks,
)
from bees.ticket import TICKETS_DIR, _DEP_PATTERN


@pytest.fixture(autouse=True)
def _temp_dirs(tmp_path, monkeypatch):
    """Redirect ticket and template storage to temp directories."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)

    config_dir = tmp_path / "config"
    config_dir.mkdir()
    templates_path = config_dir / "TEMPLATES.yaml"
    hooks_dir = config_dir / "hooks"
    hooks_dir.mkdir()

    monkeypatch.setattr("bees.playbook.CONFIG_DIR", config_dir)
    monkeypatch.setattr("bees.playbook.TEMPLATES_PATH", templates_path)
    monkeypatch.setattr("bees.playbook.HOOKS_DIR", hooks_dir)
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

    def test_parent_ticket_id_propagates(self, write_template):
        write_template({
            "name": "sub",
            "objective": "step a",
        })

        ticket = run_playbook("sub", parent_ticket_id="caller-ticket")
        assert ticket.metadata.parent_ticket_id == "caller-ticket"

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
        from bees.ticket import create_ticket
        ticket = create_ticket("standalone objective")
        result = run_event_hooks("some_signal", "payload", ticket)
        assert result == "payload"

    def test_no_hook_passes_through(self, write_template):
        write_template({
            "name": "no-hook",
            "objective": "Do it.",
        })
        ticket = run_playbook("no-hook")
        result = run_event_hooks("some_signal", "payload", ticket)
        assert result == "payload"

    def test_hook_eats_event(self, write_template, hooks_dir):
        write_template({
            "name": "eater",
            "objective": "Do it.",
        })
        (hooks_dir / "eater.py").write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    return None\n"
        )
        ticket = run_playbook("eater")
        result = run_event_hooks("any_signal", "payload", ticket)
        assert result is None

    def test_hook_transforms_payload(self, write_template, hooks_dir):
        write_template({
            "name": "transformer",
            "objective": "Do it.",
        })
        (hooks_dir / "transformer.py").write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    return payload.upper()\n"
        )
        ticket = run_playbook("transformer")
        result = run_event_hooks("any_signal", "hello", ticket)
        assert result == "HELLO"

    def test_hook_raises_fails_open(self, write_template, hooks_dir):
        write_template({
            "name": "crasher",
            "objective": "Do it.",
        })
        (hooks_dir / "crasher.py").write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    raise RuntimeError('boom')\n"
        )
        ticket = run_playbook("crasher")
        result = run_event_hooks("any_signal", "payload", ticket)
        assert result == "payload"

    def test_hook_mutates_ticket_metadata(self, write_template, hooks_dir):
        write_template({
            "name": "renamer",
            "title": "Original Title",
            "objective": "Do it.",
        })
        (hooks_dir / "renamer.py").write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    if signal_type == 'update_title':\n"
            "        ticket.metadata.title = payload\n"
            "        ticket.save_metadata()\n"
            "        return None\n"
            "    return payload\n"
        )
        ticket = run_playbook("renamer")
        assert ticket.metadata.title == "Original Title"

        result = run_event_hooks("update_title", "New Title", ticket)
        assert result is None
        assert ticket.metadata.title == "New Title"


# --- Ticket path resolution ---


class TestTicketPaths:
    """Tests for Ticket.dir and Ticket.fs_dir path resolution."""

    def test_dir_always_top_level(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(
                playbook_run_id="run-456",
                parent_ticket_id="run-789",
            ),
        )
        assert t.dir == TICKETS_DIR / "abc-123"

    def test_fs_dir_with_parent_ticket_id(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(parent_ticket_id="parent-ticket"),
        )
        assert t.fs_dir == TICKETS_DIR / "parent-ticket" / "filesystem"

    def test_fs_dir_plain_ticket(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(id="abc-123", objective="test", metadata=TicketMetadata())
        assert t.fs_dir == TICKETS_DIR / "abc-123" / "filesystem"

    def test_fs_dir_playbook_run_id_alone_uses_own_dir(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(playbook_run_id="pb-run"),
        )
        assert t.fs_dir == TICKETS_DIR / "abc-123" / "filesystem"

    def test_fs_dir_parent_takes_precedence(self, _temp_dirs):
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(
                playbook_run_id="pb-run",
                parent_ticket_id="parent-ticket",
            ),
        )
        assert t.fs_dir == TICKETS_DIR / "parent-ticket" / "filesystem"



