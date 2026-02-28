# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
InteractionStore — protocol for suspend/resume state management.

When the agent loop suspends (function needs client input), the loop's
state is saved here keyed by ``interactionId``. When the client POSTs
back with ``{interactionId, response}``, the state is loaded and the
loop is reconstructed.

Implementations:
- ``InMemoryInteractionStore`` (``local/interaction_store_impl.py``)
  — in-memory dict, suitable for local dev.
- Production uses a persistent store (Redis/Firestore).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from .agent_file_system import AgentFileSystem
from .task_tree_manager import TaskTreeManager

__all__ = ["InteractionState", "InteractionStore"]


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

    # Agent state — mutable objects that persist across resume.
    file_system: AgentFileSystem
    task_tree_manager: TaskTreeManager

    # The function groups config — needed to re-register tools on resume.
    # Stored as the raw arguments to the function group constructors so
    # groups can be rebuilt with the same file_system/task_tree references.
    function_group_args: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class InteractionStore(Protocol):
    """Protocol for storing suspended interaction state.

    Implementations manage the lifecycle of ``InteractionState`` objects:
    save on suspend, load (and remove) on resume.
    """

    def save(self, interaction_id: str, state: InteractionState) -> None:
        """Save interaction state for later resume."""
        ...

    def load(self, interaction_id: str) -> InteractionState | None:
        """Load and remove interaction state.

        Returns None if the interaction ID is not found.
        The state is removed after loading (single-use).
        """
        ...

    def has(self, interaction_id: str) -> bool:
        """Check if an interaction is stored."""
        ...

    def clear(self) -> None:
        """Remove all stored interactions."""
        ...
