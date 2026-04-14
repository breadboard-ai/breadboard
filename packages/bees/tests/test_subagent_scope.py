# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for SubagentScope."""

from __future__ import annotations

from pathlib import Path

import pytest

from bees.subagent_scope import SubagentScope


# ---- Construction ----


class TestForTicket:
    """SubagentScope.for_ticket reconstructs from ticket metadata."""

    def test_root_ticket(self):
        """Root ticket (no parent) gets scope with own ID as workspace root."""
        ticket = _fake_ticket("root-id", owning_task_id=None, slug=None)
        scope = SubagentScope.for_ticket(ticket)
        assert scope.workspace_root_id == "root-id"
        assert scope.slug_path is None

    def test_child_ticket(self):
        """Child ticket gets parent as workspace root and slug from metadata."""
        ticket = _fake_ticket(
            "child-id", owning_task_id="root-id", slug="research",
        )
        scope = SubagentScope.for_ticket(ticket)
        assert scope.workspace_root_id == "root-id"
        assert scope.slug_path == "research"

    def test_grandchild_ticket(self):
        """Grandchild ticket preserves full slug path from metadata."""
        ticket = _fake_ticket(
            "grandchild-id",
            owning_task_id="root-id",
            slug="research/deep-dive",
        )
        scope = SubagentScope.for_ticket(ticket)
        assert scope.workspace_root_id == "root-id"
        assert scope.slug_path == "research/deep-dive"


# ---- child() composition ----


class TestChild:
    """SubagentScope.child composes slug paths."""

    def test_single_level(self):
        """Root scope → child produces a single-segment slug."""
        root = SubagentScope(workspace_root_id="root-id")
        child = root.child("research")
        assert child.slug_path == "research"
        assert child.workspace_root_id == "root-id"

    def test_two_levels(self):
        """Child scope → grandchild produces two-segment slug."""
        root = SubagentScope(workspace_root_id="root-id")
        child = root.child("research")
        grandchild = child.child("deep-dive")
        assert grandchild.slug_path == "research/deep-dive"
        assert grandchild.workspace_root_id == "root-id"

    def test_three_levels(self):
        """Three levels of nesting compose correctly."""
        scope = SubagentScope(workspace_root_id="root-id")
        scope = scope.child("a").child("b").child("c")
        assert scope.slug_path == "a/b/c"
        assert scope.workspace_root_id == "root-id"

    def test_preserves_workspace_root(self):
        """child() always preserves the original workspace root."""
        scope = SubagentScope(workspace_root_id="original-root")
        deep = scope.child("x").child("y").child("z")
        assert deep.workspace_root_id == "original-root"

    def test_does_not_mutate_parent(self):
        """child() returns a new scope — parent is unchanged."""
        parent = SubagentScope(workspace_root_id="root-id", slug_path="a")
        child = parent.child("b")
        assert parent.slug_path == "a"
        assert child.slug_path == "a/b"


# ---- is_writable ----


class TestIsWritable:
    """SubagentScope.is_writable validates file paths."""

    def test_root_allows_everything(self):
        """Root scope (slug_path=None) allows all paths."""
        scope = SubagentScope(workspace_root_id="root-id")
        assert scope.is_writable("anything.txt") is True
        assert scope.is_writable("deep/nested/path.txt") is True

    def test_exact_match(self):
        """Exact slug path is writable."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        assert scope.is_writable("research") is True

    def test_prefix_match(self):
        """Paths under slug are writable."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        assert scope.is_writable("research/file.txt") is True
        assert scope.is_writable("research/deep/file.txt") is True

    def test_outside_scope(self):
        """Paths outside the slug are rejected."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        assert scope.is_writable("other/file.txt") is False
        assert scope.is_writable("file.txt") is False

    def test_prefix_not_confused_by_similar_names(self):
        """'research-extra' is not writable when slug is 'research'."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        assert scope.is_writable("research-extra/file.txt") is False

    def test_nested_slug(self):
        """Nested slug validates against full path."""
        scope = SubagentScope(
            workspace_root_id="r", slug_path="research/deep-dive",
        )
        assert scope.is_writable("research/deep-dive/file.txt") is True
        assert scope.is_writable("research/file.txt") is False
        assert scope.is_writable("research/deep-dive") is True


# ---- writable_dir ----


class TestWritableDir:
    """SubagentScope.writable_dir resolves to an absolute path."""

    def test_root_returns_base(self):
        """Root scope returns the base directory unchanged."""
        scope = SubagentScope(workspace_root_id="r")
        base = Path("/workspace")
        assert scope.writable_dir(base) == Path("/workspace")

    def test_single_slug(self):
        """Single slug appends to base."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        base = Path("/workspace")
        assert scope.writable_dir(base) == Path("/workspace/research")

    def test_nested_slug(self):
        """Nested slug appends full path to base."""
        scope = SubagentScope(
            workspace_root_id="r", slug_path="research/deep-dive",
        )
        base = Path("/workspace")
        assert scope.writable_dir(base) == Path("/workspace/research/deep-dive")


# ---- sandbox_instructions ----


class TestSandboxInstructions:
    """SubagentScope.sandbox_instructions generates objective text."""

    def test_root_returns_empty(self):
        """Root scope produces no instructions."""
        scope = SubagentScope(workspace_root_id="r")
        assert scope.sandbox_instructions() == ""

    def test_single_slug(self):
        """Single slug appears in instructions."""
        scope = SubagentScope(workspace_root_id="r", slug_path="research")
        instructions = scope.sandbox_instructions()
        assert "<sandbox_environment>" in instructions
        assert "./ research" not in instructions  # no stray spaces
        assert "./research" in instructions
        assert "research/" in instructions

    def test_nested_slug(self):
        """Nested slug uses full path in instructions."""
        scope = SubagentScope(
            workspace_root_id="r", slug_path="research/deep-dive",
        )
        instructions = scope.sandbox_instructions()
        assert "./research/deep-dive" in instructions
        assert "research/deep-dive/" in instructions


# ---- frozen ----


class TestFrozen:
    """SubagentScope is immutable."""

    def test_cannot_mutate_workspace_root_id(self):
        scope = SubagentScope(workspace_root_id="r")
        with pytest.raises(AttributeError):
            scope.workspace_root_id = "other"  # type: ignore[misc]

    def test_cannot_mutate_slug_path(self):
        scope = SubagentScope(workspace_root_id="r", slug_path="a")
        with pytest.raises(AttributeError):
            scope.slug_path = "b"  # type: ignore[misc]


# ---- Helpers ----


class _FakeMetadata:
    def __init__(
        self,
        owning_task_id: str | None = None,
        slug: str | None = None,
    ) -> None:
        self.owning_task_id = owning_task_id
        self.slug = slug


class _FakeTicket:
    def __init__(
        self,
        ticket_id: str,
        owning_task_id: str | None = None,
        slug: str | None = None,
    ) -> None:
        self.id = ticket_id
        self.metadata = _FakeMetadata(
            owning_task_id=owning_task_id,
            slug=slug,
        )


def _fake_ticket(
    ticket_id: str,
    owning_task_id: str | None = None,
    slug: str | None = None,
) -> _FakeTicket:
    return _FakeTicket(ticket_id, owning_task_id, slug)
