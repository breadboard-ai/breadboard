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

from opal_backend.function_definition import (
    FunctionGroup,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)
from opal_backend.functions.chat import _make_handlers
from opal_backend.functions.chat import ChatEntryCallback

__all__ = ["get_chat_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("chat", declarations_dir=_DECLARATIONS_DIR)


def get_chat_function_group_factory(
    on_chat_entry: "ChatEntryCallback" = None,
    workspace_root_id: str | None = None,
) -> "FunctionGroupFactory":
    """Return a factory that builds the bees chat function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"chat"`` — replacing the built-in
    chat group entirely. The handlers are identical to the built-in
    versions, but the declarations include bees-specific
    ``context_updates`` fields in the response schemas.

    Args:
        on_chat_entry: Optional callback ``(role, content) -> None``
            invoked when the agent sends a user-facing message.
    """
    from opal_backend.function_definition import FunctionGroupFactory

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
            from opal_backend.functions.chat import SuspendError
            
            # Check for pending context updates first
            if workspace_root_id:
                from bees.ticket import load_ticket
                ticket = load_ticket(workspace_root_id)
                if ticket and ticket.metadata.pending_context_updates:
                    updates = ticket.metadata.pending_context_updates
                    ticket.metadata.pending_context_updates = []
                    ticket.save_metadata()
                    return {"context_updates": updates}

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
