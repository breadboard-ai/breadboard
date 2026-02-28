# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
InteractionStore — in-memory state store for suspend/resume.

When the agent loop suspends (function needs client input), the loop's
state is saved here keyed by ``interactionId``. When the client POSTs
back with ``{interactionId, response}``, the state is loaded and the
loop is reconstructed.

This is an in-memory dict — suitable for local dev. Production uses
a persistent store (Redis/Firestore).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .agent_file_system import AgentFileSystem
from .task_tree_manager import TaskTreeManager


@dataclass
class InteractionState:
    """Saved state for a suspended interaction.

    Contains everything needed to reconstruct the loop on resume.
    """

    # Conversation history up to the suspend point (includes the model's
    # function call turn).
    contents: list[dict[str, Any]]

    # The function call part that triggered the suspend. On resume,
    # the client's response is wrapped as a functionResponse for this call.
    function_call_part: dict[str, Any]

    # Loop configuration — needed to reconstruct the loop.
    access_token: str
    origin: str

    # Agent state — mutable objects that persist across resume.
    file_system: AgentFileSystem
    task_tree_manager: TaskTreeManager

    # The function groups config — needed to re-register tools on resume.
    # Stored as the raw arguments to the function group constructors so
    # groups can be rebuilt with the same file_system/task_tree references.
    function_group_args: dict[str, Any] = field(default_factory=dict)


class InteractionStore:
    """In-memory store for suspended interactions.

    Thread-safe for asyncio (single-threaded event loop).
    """

    def __init__(self) -> None:
        self._store: dict[str, InteractionState] = {}

    def save(self, interaction_id: str, state: InteractionState) -> None:
        """Save interaction state for later resume."""
        self._store[interaction_id] = state

    def load(self, interaction_id: str) -> InteractionState | None:
        """Load and remove interaction state.

        Returns None if the interaction ID is not found.
        The state is removed after loading (single-use).
        """
        return self._store.pop(interaction_id, None)

    def has(self, interaction_id: str) -> bool:
        """Check if an interaction is stored."""
        return interaction_id in self._store

    def clear(self) -> None:
        """Remove all stored interactions."""
        self._store.clear()
