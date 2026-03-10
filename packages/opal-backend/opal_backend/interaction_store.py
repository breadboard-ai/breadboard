# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
InteractionStore — protocol for suspend/resume state management.

No direct TypeScript counterpart — this protocol was created for the Python
backend's reconnect-based suspend/resume architecture.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path.

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

from dataclasses import asdict, dataclass, field
from typing import Any, Protocol, runtime_checkable
import uuid

from .agent_file_system import FileDescriptor, FileSystemSnapshot
from .task_tree_manager import TaskTreeSnapshot

__all__ = ["InteractionState", "InteractionStore"]


@dataclass
class InteractionState:
    """Saved state for a suspended interaction.

    All fields are plain data — no live objects, closures, or service
    references. This makes the state fully serializable for database
    persistence. Use ``to_dict()`` / ``from_dict()`` for JSON round-trips.
    """

    # Conversation history up to the suspend point (includes the model's
    # function call turn).
    contents: list[dict[str, Any]]

    # The function call part that triggered the suspend. On resume,
    # the client's response is wrapped as a functionResponse for this call.
    function_call_part: dict[str, Any]

    # Snapshot of the agent file system at suspend time.
    file_system: FileSystemSnapshot

    # Snapshot of the task tree at suspend time.
    task_tree: TaskTreeSnapshot

    # Feature flags active at the time of suspend. Restored on resume
    # so the agent continues with the same configuration.
    flags: dict[str, Any] = field(default_factory=dict)

    # Lightweight graph identity (url, title) — a GraphInfo dict.
    # Stored so resume() doesn't need to re-receive it.
    graph: dict[str, Any] | None = None

    # Stable session identifier — generated once at the start of the
    # conversation and preserved across all suspend/resume cycles.
    # Used by ChatLogManager to correlate chat log entries within a
    # single conversation, and available for future session-scoped uses.
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    # True when the suspend was raised by a precondition handler rather
    # than the main handler. On resume, this tells ``resume()`` to
    # re-dispatch the function call instead of injecting the response.
    is_precondition_check: bool = False

    # Consent types that have been granted across the lifetime of this
    # run. Preconditions check this set before suspending.
    consents_granted: set[str] = field(default_factory=set)

    # ---- Serialization ----

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dict."""
        return {
            "contents": self.contents,
            "function_call_part": self.function_call_part,
            "file_system": {
                "files": {
                    path: asdict(fd)
                    for path, fd in self.file_system.files.items()
                },
                "routes": self.file_system.routes,
                "file_count": self.file_system.file_count,
            },
            "task_tree": {
                "tree": self.task_tree.tree,
            },
            "flags": self.flags,
            "graph": self.graph,
            "session_id": self.session_id,
            "is_precondition_check": self.is_precondition_check,
            "consents_granted": sorted(self.consents_granted),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "InteractionState":
        """Reconstruct from a dict produced by ``to_dict()``."""
        fs_data = data["file_system"]
        return cls(
            contents=data["contents"],
            function_call_part=data["function_call_part"],
            file_system=FileSystemSnapshot(
                files={
                    path: FileDescriptor(**fd)
                    for path, fd in fs_data["files"].items()
                },
                routes=fs_data["routes"],
                file_count=fs_data["file_count"],
            ),
            task_tree=TaskTreeSnapshot(
                tree=data["task_tree"]["tree"],
            ),
            flags=data.get("flags", {}),
            graph=data.get("graph"),
            session_id=data.get("session_id", str(uuid.uuid4())),
            is_precondition_check=data.get("is_precondition_check", False),
            consents_granted=set(data.get("consents_granted", [])),
        )


@runtime_checkable
class InteractionStore(Protocol):
    """Protocol for storing suspended interaction state.

    Implementations manage the lifecycle of ``InteractionState`` objects:
    save on suspend, load (and remove) on resume.
    """

    async def save(self, interaction_id: str, state: InteractionState) -> None:
        """Save interaction state for later resume."""
        ...

    async def load(self, interaction_id: str) -> InteractionState | None:
        """Load and remove interaction state.

        Returns None if the interaction ID is not found.
        The state is removed after loading (single-use).
        """
        ...

    async def has(self, interaction_id: str) -> bool:
        """Check if an interaction is stored."""
        ...

    async def clear(self) -> None:
        """Remove all stored interactions."""
        ...
