# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the playbook module."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from unittest import mock

import pytest
import yaml

from bees.playbook import load_playbook, topological_sort, run_playbook, PLAYBOOKS_DIR
from bees.ticket import TICKETS_DIR, list_tickets, _DEP_PATTERN


@pytest.fixture(autouse=True)
def _temp_tickets(tmp_path, monkeypatch):
    """Redirect ticket storage to a temp directory for each test."""
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
    monkeypatch.setattr("bees.playbook.PLAYBOOKS_DIR", tmp_path / "playbooks")
    (tmp_path / "playbooks").mkdir()
    yield tickets_dir


@pytest.fixture
def write_playbook(tmp_path):
    """Helper to write a playbook YAML to the temp playbooks dir."""
    def _write(name: str, data: dict) -> Path:
        pb_dir = tmp_path / "playbooks" / name
        pb_dir.mkdir(parents=True, exist_ok=True)
        path = pb_dir / "PLAYBOOK.yaml"
        path.write_text(yaml.dump(data, default_flow_style=False))
        return path
    return _write


# --- topological_sort ---


class TestTopologicalSort:

    def test_linear_chain(self):
        steps = {
            "a": {"objective": "do a"},
            "b": {"objective": "do b with {{a}}"},
            "c": {"objective": "do c with {{b}}"},
        }
        order = topological_sort(steps)
        assert order.index("a") < order.index("b") < order.index("c")

    def test_diamond(self):
        steps = {
            "root": {"objective": "root"},
            "left": {"objective": "left from {{root}}"},
            "right": {"objective": "right from {{root}}"},
            "join": {"objective": "join {{left}} and {{right}}"},
        }
        order = topological_sort(steps)
        assert order.index("root") < order.index("left")
        assert order.index("root") < order.index("right")
        assert order.index("left") < order.index("join")
        assert order.index("right") < order.index("join")

    def test_no_deps(self):
        steps = {
            "x": {"objective": "do x"},
            "y": {"objective": "do y"},
        }
        # Both are independent — both should appear (deterministic order).
        order = topological_sort(steps)
        assert set(order) == {"x", "y"}

    def test_cycle_raises(self):
        steps = {
            "a": {"objective": "{{b}}"},
            "b": {"objective": "{{a}}"},
        }
        with pytest.raises(ValueError, match="Cycle"):
            topological_sort(steps)

    def test_external_refs_ignored(self):
        """Refs that don't match a step name are not treated as deps."""
        steps = {
            "a": {"objective": "use {{some-external-id}} here"},
        }
        order = topological_sort(steps)
        assert order == ["a"]


# --- run_playbook ---


class TestRunPlaybook:

    def test_single_step_no_deps(self, write_playbook):
        write_playbook("simple", {
            "name": "simple",
            "steps": {
                "main": {
                    "title": "Main Step",
                    "objective": "Do the thing.",
                    "functions": ["chat.*"],
                    "skills": ["interview-user"],
                    "tags": ["final"],
                },
            },
        })

        tickets = run_playbook("simple")
        assert len(tickets) == 1

        t = tickets[0]
        assert t.metadata.status == "available"
        assert t.metadata.title == "Main Step"
        assert t.metadata.functions == ["chat.*"]
        assert t.metadata.skills == ["interview-user"]
        assert t.metadata.tags == ["final"]
        assert t.metadata.playbook_id == "simple"
        assert t.metadata.playbook_run_id is not None
        assert t.metadata.depends_on is None
        assert t.objective == "Do the thing."

    def test_two_steps_with_dep(self, write_playbook):
        write_playbook("chain", {
            "name": "chain",
            "steps": {
                "first": {
                    "objective": "Do first thing.",
                },
                "second": {
                    "objective": "Do second with {{first}}.",
                },
            },
        })

        tickets = run_playbook("chain")
        assert len(tickets) == 2

        first = next(t for t in tickets if t.metadata.title is None and "first" not in (t.metadata.depends_on or []))
        second = next(t for t in tickets if t.metadata.depends_on)

        # First ticket should be available.
        assert first.metadata.status == "available"

        # Second should be blocked, depending on first.
        assert second.metadata.status == "blocked"
        assert second.metadata.depends_on == [first.id]

        # The objective should have the ticket ID, not the step name.
        assert first.id in second.objective
        assert "{{first}}" not in second.objective

    def test_playbook_run_id_shared(self, write_playbook):
        write_playbook("multi", {
            "name": "multi",
            "steps": {
                "a": {"objective": "step a"},
                "b": {"objective": "step b with {{a}}"},
            },
        })

        tickets = run_playbook("multi")
        run_ids = {t.metadata.playbook_run_id for t in tickets}
        assert len(run_ids) == 1  # All share the same run ID.

    def test_assignee_propagates(self, write_playbook):
        write_playbook("with-assignee", {
            "name": "with-assignee",
            "steps": {
                "main": {
                    "objective": "Do it.",
                    "assignee": "app",
                },
            },
        })

        tickets = run_playbook("with-assignee")
        assert tickets[0].metadata.assignee == "app"

    def test_diamond_deps(self, write_playbook):
        write_playbook("diamond", {
            "name": "diamond",
            "steps": {
                "root": {"objective": "start"},
                "left": {"objective": "left {{root}}"},
                "right": {"objective": "right {{root}}"},
                "join": {"objective": "combine {{left}} and {{right}}"},
            },
        })

        tickets = run_playbook("diamond")
        assert len(tickets) == 4

        by_playbook_order = {t.objective: t for t in tickets}
        root = next(t for t in tickets if t.objective == "start")
        join = next(t for t in tickets if "combine" in t.objective)

        assert join.metadata.depends_on is not None
        assert len(join.metadata.depends_on) == 2
        assert root.id not in join.metadata.depends_on  # root is indirect

    def test_not_found_raises(self):
        with pytest.raises(FileNotFoundError):
            run_playbook("nonexistent")

    def test_missing_steps_raises(self, write_playbook):
        write_playbook("bad", {"name": "bad"})
        with pytest.raises(ValueError, match="steps"):
            run_playbook("bad")

    def test_model_propagates(self, write_playbook):
        write_playbook("with-model", {
            "name": "with-model",
            "steps": {
                "main": {
                    "objective": "Do the thing.",
                    "model": "gemini-2.5-pro",
                },
            },
        })

        tickets = run_playbook("with-model")
        assert len(tickets) == 1
        assert tickets[0].metadata.model == "gemini-2.5-pro"

    def test_context_attached_to_root_only(self, write_playbook):
        """Context briefing is only attached to root tickets."""
        write_playbook("briefed", {
            "name": "briefed",
            "steps": {
                "research": {
                    "title": "Research",
                    "objective": "Research the topic.",
                },
                "summarise": {
                    "title": "Summarise",
                    "objective": "Summarise {{research}}.",
                },
            },
        })

        tickets = run_playbook("briefed", context="All about dinosaurs")
        assert len(tickets) == 2

        research = next(t for t in tickets if t.metadata.title == "Research")
        summarise = next(t for t in tickets if t.metadata.title == "Summarise")

        assert research.metadata.context == "All about dinosaurs"
        assert summarise.metadata.context is None

    def test_context_none_when_not_provided(self, write_playbook):
        """No context field created when not supplied."""
        write_playbook("plain", {
            "name": "plain",
            "steps": {
                "step": {"objective": "Do it."},
            },
        })

        tickets = run_playbook("plain")
        assert tickets[0].metadata.context is None


# --- run_event_hooks ---


from bees.playbook import run_event_hooks


class TestRunEventHooks:

    def test_no_playbook_passes_through(self, tmp_path):
        """Tickets without a playbook_id get the signal unmodified."""
        from bees.ticket import create_ticket
        ticket = create_ticket("standalone objective")
        result = run_event_hooks("some_signal", "payload", ticket)
        assert result == "payload"

    def test_no_hook_passes_through(self, write_playbook):
        """Playbook exists but hooks.py has no on_event — pass through."""
        write_playbook("no-hook", {
            "name": "no-hook",
            "steps": {"main": {"objective": "Do it."}},
        })
        tickets = run_playbook("no-hook")
        ticket = tickets[0]
        result = run_event_hooks("some_signal", "payload", ticket)
        assert result == "payload"

    def test_hook_eats_event(self, tmp_path, write_playbook):
        """Hook returns None — signal is eaten."""
        write_playbook("eater", {
            "name": "eater",
            "steps": {"main": {"objective": "Do it."}},
        })
        hooks_path = tmp_path / "playbooks" / "eater" / "hooks.py"
        hooks_path.write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    return None\n"
        )
        tickets = run_playbook("eater")
        result = run_event_hooks("any_signal", "payload", tickets[0])
        assert result is None

    def test_hook_transforms_payload(self, tmp_path, write_playbook):
        """Hook returns a modified payload string."""
        write_playbook("transformer", {
            "name": "transformer",
            "steps": {"main": {"objective": "Do it."}},
        })
        hooks_path = tmp_path / "playbooks" / "transformer" / "hooks.py"
        hooks_path.write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    return payload.upper()\n"
        )
        tickets = run_playbook("transformer")
        result = run_event_hooks("any_signal", "hello", tickets[0])
        assert result == "HELLO"

    def test_hook_raises_fails_open(self, tmp_path, write_playbook):
        """Hook crash delivers the signal as-is (fail-open)."""
        write_playbook("crasher", {
            "name": "crasher",
            "steps": {"main": {"objective": "Do it."}},
        })
        hooks_path = tmp_path / "playbooks" / "crasher" / "hooks.py"
        hooks_path.write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    raise RuntimeError('boom')\n"
        )
        tickets = run_playbook("crasher")
        result = run_event_hooks("any_signal", "payload", tickets[0])
        assert result == "payload"

    def test_hook_mutates_ticket_metadata(self, tmp_path, write_playbook):
        """Hook can mutate ticket metadata (e.g., rename title)."""
        write_playbook("renamer", {
            "name": "renamer",
            "steps": {"main": {"title": "Original Title", "objective": "Do it."}},
        })
        hooks_path = tmp_path / "playbooks" / "renamer" / "hooks.py"
        hooks_path.write_text(
            "def on_event(signal_type, payload, ticket):\n"
            "    if signal_type == 'update_title':\n"
            "        ticket.metadata.title = payload\n"
            "        ticket.save_metadata()\n"
            "        return None\n"
            "    return payload\n"
        )
        tickets = run_playbook("renamer")
        ticket = tickets[0]
        assert ticket.metadata.title == "Original Title"

        result = run_event_hooks("update_title", "New Title", ticket)
        assert result is None
        assert ticket.metadata.title == "New Title"


# --- Ticket path resolution ---


class TestTicketPaths:
    """Tests for Ticket.dir and Ticket.fs_dir path resolution."""

    def test_dir_always_top_level(self, _temp_tickets):
        """Ticket.dir is always tickets/{id}/, regardless of run metadata."""
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

    def test_fs_dir_with_parent_ticket_id(self, _temp_tickets):
        """fs_dir resolves to tickets/{parent_ticket_id}/filesystem/."""
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(parent_ticket_id="parent-ticket"),
        )
        assert t.fs_dir == TICKETS_DIR / "parent-ticket" / "filesystem"

    def test_fs_dir_plain_ticket(self, _temp_tickets):
        """Plain tickets get fs_dir at tickets/{id}/filesystem/."""
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(id="abc-123", objective="test", metadata=TicketMetadata())
        assert t.fs_dir == TICKETS_DIR / "abc-123" / "filesystem"

    def test_fs_dir_playbook_run_id_alone_uses_own_dir(self, _temp_tickets):
        """playbook_run_id alone does NOT create a shared workspace dir."""
        from bees.ticket import Ticket, TicketMetadata, TICKETS_DIR

        t = Ticket(
            id="abc-123",
            objective="test",
            metadata=TicketMetadata(playbook_run_id="pb-run"),
        )
        # Without parent_ticket_id, falls through to own directory.
        assert t.fs_dir == TICKETS_DIR / "abc-123" / "filesystem"

    def test_fs_dir_parent_takes_precedence(self, _temp_tickets):
        """parent_ticket_id determines fs_dir regardless of playbook_run_id."""
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

    def test_sibling_tickets_get_parent_ticket_id(self, _temp_tickets, write_playbook):
        """Non-root tickets in a playbook get parent_ticket_id = root ticket ID."""
        write_playbook("siblings", {
            "name": "siblings",
            "steps": {
                "root": {"objective": "I am root"},
                "child": {"objective": "I depend on {{root}}"},
            },
        })

        tickets = run_playbook("siblings")
        assert len(tickets) == 2

        root = next(t for t in tickets if t.metadata.parent_ticket_id is None)
        child = next(t for t in tickets if t.metadata.parent_ticket_id is not None)

        assert child.metadata.parent_ticket_id == root.id
        assert root.fs_dir == child.fs_dir

    def test_list_tickets_no_orphan_run_dirs(self, _temp_tickets, write_playbook):
        """Running a playbook should not create non-ticket directories."""
        from bees.ticket import list_tickets, TICKETS_DIR

        write_playbook("clean", {
            "name": "clean",
            "steps": {
                "a": {"objective": "do a"},
                "b": {"objective": "do b with {{a}}"},
            },
        })

        tickets = run_playbook("clean")
        ticket_ids = {t.id for t in tickets}

        # Every directory under tickets/ should be a real ticket.
        for d in TICKETS_DIR.iterdir():
            if d.is_dir():
                assert d.name in ticket_ids, f"Orphan directory: {d.name}"


# --- validate_task_template ---


from bees.playbook import validate_task_template


class TestValidateTaskTemplate:

    def test_valid_template(self):
        playbook_data = {
            "type": "task-template",
            "steps": {
                "main": {"objective": "Do it."}
            }
        }
        assert validate_task_template(playbook_data) is True

    def test_missing_type(self):
        playbook_data = {
            "steps": {
                "main": {"objective": "Do it."}
            }
        }
        assert validate_task_template(playbook_data) is False

    def test_wrong_type(self):
        playbook_data = {
            "type": "standard",
            "steps": {
                "main": {"objective": "Do it."}
            }
        }
        assert validate_task_template(playbook_data) is False

    def test_multi_step_template_fails_and_warns(self, caplog):
        playbook_data = {
            "type": "task-template",
            "steps": {
                "step1": {"objective": "Do 1"},
                "step2": {"objective": "Do 2"}
            }
        }
        assert validate_task_template(playbook_data) is False
        assert "marked as 'task-template' but has 2 steps" in caplog.text

    def test_empty_steps(self):
        playbook_data = {
            "type": "task-template",
            "steps": {}
        }
        assert validate_task_template(playbook_data) is False
