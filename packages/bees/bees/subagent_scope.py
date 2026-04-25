# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Subagent scope — nesting position of an agent in the hierarchy.

A ``SubagentScope`` is a frozen value object that tracks where an agent
sits in the subagent tree.  It handles slug composition, file-path
validation, directory resolution, and sandbox-instruction generation —
all as pure data transforms with no side effects.

Every ticket in the system gets a scope (constructed via ``for_ticket``).
Root agents have ``slug_path=None`` (unrestricted).  Subagents carry a
slash-delimited path like ``"research/deep-dive"`` that scopes their
writable area within the shared workspace.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from bees.ticket import Ticket

__all__ = ["SubagentScope"]


@dataclass(frozen=True)
class SubagentScope:
    """Nesting position of an agent in the subagent hierarchy.

    Attributes:
        workspace_root_id: The ticket ID that owns the shared filesystem.
            For root agents this equals their own ticket ID.
        slug_path: Full slash-delimited path from workspace root to this
            agent (e.g. ``"research/deep-dive"``).  ``None`` for root
            agents — they own the entire workspace.
    """

    workspace_root_id: str
    slug_path: str | None = None

    # -- Construction ------------------------------------------------------

    @staticmethod
    def for_ticket(ticket: Ticket) -> SubagentScope:
        """Reconstruct a scope from persisted ticket metadata."""
        return SubagentScope(
            workspace_root_id=ticket.metadata.owning_task_id or ticket.id,
            slug_path=ticket.metadata.slug,
        )

    def child(self, slug: str) -> SubagentScope:
        """Derive a child scope by appending a slug segment.

        >>> SubagentScope("root").child("a").child("b").slug_path
        'a/b'
        """
        child_path = f"{self.slug_path}/{slug}" if self.slug_path else slug
        return SubagentScope(
            workspace_root_id=self.workspace_root_id,
            slug_path=child_path,
        )

    # -- Path validation ---------------------------------------------------

    def is_writable(self, path: str) -> bool:
        """Check whether *path* falls within this agent's writable scope.

        Root agents (``slug_path is None``) can write anywhere.
        Subagents can write only to paths that are exactly their slug
        or start with ``slug_path/``.
        """
        if self.slug_path is None:
            return True
        return path == self.slug_path or path.startswith(f"{self.slug_path}/")

    def writable_dir(self, base: Path) -> Path:
        """Resolve the writable directory given a workspace root path.

        Returns *base* itself for root agents, or
        ``base / slug_path`` for subagents.
        """
        if self.slug_path is None:
            return base
        return base / self.slug_path

    # -- Instruction generation --------------------------------------------

    def sandbox_instructions(self) -> str:
        """Generate the ``<sandbox_environment>`` block for the objective.

        Returns an empty string for root agents (no restriction).
        """
        if self.slug_path is None:
            return ""
        return (
            "<sandbox_environment>\n"
            "Your current working directory is the root of the workspace.\n"
            f"You are assigned to work in the subdirectory: ./{self.slug_path}\n"
            f"CRITICAL: You must prefix all file paths with {self.slug_path}/ "
            "when creating or writing files (e.g., using files_write_file or "
            "redirection in bash). Writes to the root directory or other "
            "directories will fail.\n"
            "You can read files from anywhere in the workspace.\n"
            "</sandbox_environment>"
        )
