# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the playbooks function group handlers."""

from __future__ import annotations

import asyncio
import textwrap

import pytest
import yaml

from bees.functions.playbooks import _make_handlers


@pytest.fixture(autouse=True)
def playbooks_and_tickets_dir(tmp_path, monkeypatch):
    """Point PLAYBOOKS_DIR and TICKETS_DIR to a temp directory."""
    pb_dir = tmp_path / "playbooks"
    pb_dir.mkdir()
    monkeypatch.setattr("bees.playbook.PLAYBOOKS_DIR", pb_dir)
    monkeypatch.setattr("bees.functions.playbooks.PLAYBOOKS_DIR", pb_dir)
    
    tickets_dir = tmp_path / "tickets"
    tickets_dir.mkdir()
    monkeypatch.setattr("bees.ticket.TICKETS_DIR", tickets_dir)
    
    return pb_dir


def write_playbook(pb_dir, name, data):
    """Helper to write a playbook YAML."""
    path = pb_dir / f"{name}.yaml"
    path.write_text(yaml.dump(data, default_flow_style=False))


# ---------------------------------------------------------------------------
# playbooks_list
# ---------------------------------------------------------------------------


class TestPlaybooksList:
    def test_empty_dir(self, playbooks_and_tickets_dir):
        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_list"]({}, None)
        )
        assert result == {"playbooks": []}

    def test_lists_valid_playbooks(self, playbooks_and_tickets_dir):
        write_playbook(playbooks_and_tickets_dir, "alpha", {
            "name": "alpha",
            "title": "Alpha Playbook",
            "description": "Does alpha things",
            "steps": {
                "step1": {"objective": "Do the thing"},
            },
        })
        write_playbook(playbooks_and_tickets_dir, "beta", {
            "name": "beta",
            "title": "Beta Playbook",
            "description": "Does beta things",
            "steps": {
                "step1": {"objective": "Do another thing"},
            },
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_list"]({}, None)
        )
        names = [p["name"] for p in result["playbooks"]]
        assert names == ["alpha", "beta"]
        assert result["playbooks"][0]["title"] == "Alpha Playbook"
        assert result["playbooks"][1]["description"] == "Does beta things"

    def test_skips_hidden_playbooks(self, playbooks_and_tickets_dir):
        write_playbook(playbooks_and_tickets_dir, "visible", {
            "name": "visible",
            "title": "Visible",
            "steps": {"s": {"objective": "ok"}},
        })
        write_playbook(playbooks_and_tickets_dir, "hidden", {
            "name": "hidden",
            "hidden": True,
            "title": "Hidden",
            "steps": {"s": {"objective": "ok"}},
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_list"]({}, None)
        )
        names = [p["name"] for p in result["playbooks"]]
        assert names == ["visible"]

    def test_skips_invalid_yaml(self, playbooks_and_tickets_dir):
        # Valid playbook
        write_playbook(playbooks_and_tickets_dir, "good", {
            "name": "good",
            "title": "Good",
            "description": "Works fine",
            "steps": {"s1": {"objective": "ok"}},
        })
        # Invalid: missing steps
        (playbooks_and_tickets_dir / "bad.yaml").write_text("not_a_playbook: true\n")

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_list"]({}, None)
        )
        assert len(result["playbooks"]) == 1
        assert result["playbooks"][0]["name"] == "good"

    def test_missing_dir(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            "bees.functions.playbooks.PLAYBOOKS_DIR",
            tmp_path / "nonexistent",
        )
        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_list"]({}, None)
        )
        assert result == {"playbooks": []}


# ---------------------------------------------------------------------------
# playbooks_run_playbook
# ---------------------------------------------------------------------------


class TestPlaybooksRunPlaybook:
    def test_run_simple_playbook(self, playbooks_and_tickets_dir):
        write_playbook(playbooks_and_tickets_dir, "simple", {
            "name": "simple",
            "title": "Simple",
            "description": "One step",
            "steps": {
                "only": {
                    "title": "Only Step",
                    "objective": "Do the one thing",
                },
            },
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"]({"name": "simple"}, None)
        )
        assert result["playbook"] == "simple"
        assert result["tickets_created"] == 1
        assert len(result["tickets"]) == 1
        assert result["tickets"][0]["title"] == "Only Step"
        assert "id" in result["tickets"][0]

    def test_run_nonexistent(self, playbooks_and_tickets_dir):
        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"]({"name": "nope"}, None)
        )
        assert "error" in result
        assert "not found" in result["error"].lower()

    def test_missing_name(self, playbooks_and_tickets_dir):
        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"]({}, None)
        )
        assert result == {"error": "name is required"}

    def test_multi_step_playbook(self, playbooks_and_tickets_dir):
        write_playbook(playbooks_and_tickets_dir, "multi", {
            "name": "multi",
            "title": "Multi",
            "description": "Two steps",
            "steps": {
                "first": {
                    "title": "First",
                    "objective": "Do first",
                },
                "second": {
                    "title": "Second",
                    "objective": "Do second after {{first}}",
                },
            },
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"]({"name": "multi"}, None)
        )
        assert result["tickets_created"] == 2
        titles = [t["title"] for t in result["tickets"]]
        assert "First" in titles
        assert "Second" in titles

    def test_context_passed_to_tickets(self, playbooks_and_tickets_dir):
        """Context from the handler should appear on the created ticket."""
        write_playbook(playbooks_and_tickets_dir, "ctx", {
            "name": "ctx",
            "title": "Context Test",
            "steps": {
                "only": {
                    "title": "Only",
                    "objective": "Do the thing",
                },
            },
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"](
                {"name": "ctx", "context": "The user wants dinosaurs"},
                None,
            )
        )
        assert result["tickets_created"] == 1

        # Verify the ticket on disk has the context.
        from bees.ticket import load_ticket
        ticket = load_ticket(result["tickets"][0]["id"])
        assert ticket is not None
        assert ticket.metadata.context == "The user wants dinosaurs"

    def test_context_only_on_root_tickets(self, playbooks_and_tickets_dir):
        """Context is only attached to root tickets, not downstream ones."""
        write_playbook(playbooks_and_tickets_dir, "chain", {
            "name": "chain",
            "title": "Chain",
            "steps": {
                "root": {
                    "title": "Root",
                    "objective": "Research the topic",
                },
                "leaf": {
                    "title": "Leaf",
                    "objective": "Summarise {{root}}",
                },
            },
        })

        handlers = _make_handlers()
        result = asyncio.get_event_loop().run_until_complete(
            handlers["playbooks_run_playbook"](
                {"name": "chain", "context": "Dinosaurs please"},
                None,
            )
        )
        assert result["tickets_created"] == 2

        from bees.ticket import load_ticket
        tickets = {
            t["title"]: load_ticket(t["id"]) for t in result["tickets"]
        }
        assert tickets["Root"].metadata.context == "Dinosaurs please"
        assert tickets["Leaf"].metadata.context is None
