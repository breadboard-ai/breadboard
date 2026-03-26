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
        path = tmp_path / "playbooks" / f"{name}.yaml"
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
