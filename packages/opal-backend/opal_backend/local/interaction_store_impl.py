# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
In-memory implementation of ``InteractionStore``.

Suitable for local dev. Production uses a persistent store
(Redis/Firestore) that implements the same protocol.
"""

from __future__ import annotations

from ..interaction_store import InteractionState, InteractionStore

__all__ = ["InMemoryInteractionStore"]


class InMemoryInteractionStore:
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
