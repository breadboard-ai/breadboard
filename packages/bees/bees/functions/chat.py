# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees chat function group — with bees-specific response schema.

Overrides the built-in chat group to use bees-local declarations that
include ``context_updates`` in the response schemas. The handlers are
identical to the built-in implementations — only the declared schema
is different.

This module uses the ``FunctionGroupFactory`` pattern to late-bind
against the session's file system and task tree via ``SessionHooks``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)
from bees.protocols.handler_types import (
    ChatEntryCallback,
    CONTEXT_PARTS_KEY,
    SuspendError,
)
from opal_backend.functions.chat import _make_handlers
from bees.context_updates import updates_to_context_parts

__all__ = ["get_chat_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("chat", declarations_dir=_DECLARATIONS_DIR)


def get_chat_function_group_factory(
    on_chat_entry: "ChatEntryCallback" = None,
    workspace_root_id: str | None = None,
    scheduler: Any | None = None,
) -> FunctionGroupFactory:
    """Return a factory that builds the bees chat function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"chat"`` — replacing the built-in
    chat group entirely. The handlers are identical to the built-in
    versions, but the declarations use bees-specific schemas.

    Args:
        on_chat_entry: Optional callback ``(role, content) -> None``
            invoked when the agent sends a user-facing message.
    """

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            task_tree_manager=hooks.task_tree_manager,
            file_system=hooks.file_system,
            on_chat_entry=on_chat_entry,
        )
        # chat_await_context_update reuses the same suspend/resume
        # mechanism as chat_request_user_input — it just presents a
        # cleaner semantic surface for "wait for external signals".
        # We wrap rather than alias because the upstream handler
        # hardcodes the function name in its SuspendError payload.
        _inner = handlers["chat_request_user_input"]

        async def chat_await_context_update(
            args: dict[str, Any], status_cb: Any,
        ) -> dict[str, Any]:
            # SuspendError imported at module level from bees.protocols.

            # Check for pending context updates first.
            # If updates are already buffered, return immediately
            # without suspending — the updates are emitted as text
            # parts via CONTEXT_PARTS_KEY.
            if workspace_root_id and scheduler:
                task = scheduler.store.get(workspace_root_id)
                if task and task.metadata.pending_context_updates:
                    updates = task.metadata.pending_context_updates
                    task.metadata.pending_context_updates = []
                    scheduler.store.save_metadata(task)
                    return {
                        "resumed": True,
                        CONTEXT_PARTS_KEY: updates_to_context_parts(updates),
                    }

            try:
                return await _inner(
                    {"user_message": "", "input_type": "any"}, status_cb,
                )
            except SuspendError as e:
                e.function_call_part["functionCall"]["name"] = (
                    "chat_await_context_update"
                )
                raise

        handlers["chat_await_context_update"] = chat_await_context_update
        return assemble_function_group(_LOADED, handlers)

    return factory
