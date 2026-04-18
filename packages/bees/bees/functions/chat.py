# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Bees chat function group — with bees-specific response schema.

Overrides the built-in chat group to use bees-local declarations that
include ``context_updates`` in the response schemas. The handler bodies
are inlined from ``opal_backend.functions.chat``, using bees-native
suspend/resume types from ``bees.protocols.handler_types`` and pidgin
resolution from ``bees.pidgin``.

See ``spec/handler-bodies.md`` for design rationale.

This module uses the ``FunctionGroupFactory`` pattern to late-bind
against the session's file system and task tree via ``SessionHooks``.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from bees.pidgin import from_pidgin_string
from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)
from bees.protocols.handler_types import (
    ChatEntryCallback,
    ChoiceItem,
    CONTEXT_PARTS_KEY,
    SuspendError,
    WaitForChoiceEvent,
    WaitForInputEvent,
)
from bees.context_updates import updates_to_context_parts

__all__ = ["get_chat_function_group_factory"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("chat", declarations_dir=_DECLARATIONS_DIR)

# ---------------------------------------------------------------------------
# Constants (from opal_backend.functions.chat)
# ---------------------------------------------------------------------------

CHAT_REQUEST_USER_INPUT = "chat_request_user_input"
CHAT_PRESENT_CHOICES = "chat_present_choices"

VALID_INPUT_TYPES = ["any", "text", "file-upload"]
VALID_SELECTION_MODES = ["single", "multiple"]
VALID_LAYOUTS = ["list", "row", "grid"]

# Maps the LLM-facing input_type parameter to the icon name sent
# on the wire in the waitForInput event.  Mirrors TS computeFormat().
_INPUT_TYPE_TO_FORMAT = {
    "any": "asterisk",
    "text": "edit_note",
    "file-upload": "upload",
}


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_handlers(
    *,
    file_system: Any,
    on_chat_entry: ChatEntryCallback = None,
) -> dict[str, Any]:
    """Build handler map for bees chat functions.

    Args:
        file_system: A ``FileSystem``-compatible object for pidgin
            resolution in prompts and choice labels.
        on_chat_entry: Optional callback ``(role, content) -> None``
            invoked when the agent sends a user-facing message.
    """

    async def chat_request_user_input(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        user_message = args.get("user_message", "")
        input_type = args.get("input_type", "any")
        skip_label = args.get("skip_label")

        if input_type not in VALID_INPUT_TYPES:
            input_type = "any"

        request_id = str(uuid.uuid4())

        # Resolve pidgin file references in the prompt before sending
        # to the client.
        prompt_content = await from_pidgin_string(user_message, file_system)

        event = WaitForInputEvent(
            request_id=request_id,
            prompt=prompt_content,
            input_type=_INPUT_TYPE_TO_FORMAT.get(input_type, "asterisk"),
            skip_label=skip_label,
        )

        # Persist the model message to the chat log if available.
        if on_chat_entry:
            on_chat_entry("agent", user_message)

        function_call_part = {
            "functionCall": {
                "name": CHAT_REQUEST_USER_INPUT,
                "args": args,
            }
        }

        raise SuspendError(event, function_call_part)

    async def chat_present_choices(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        user_message = args.get("user_message", "")
        choices = args.get("choices", [])
        selection_mode = args.get("selection_mode", "single")
        layout = args.get("layout", "list")
        none_of_the_above_label = args.get("none_of_the_above_label")

        if selection_mode not in VALID_SELECTION_MODES:
            selection_mode = "single"
        if layout not in VALID_LAYOUTS:
            layout = "list"

        # Resolve pidgin file references in the prompt and choice labels.
        prompt_content = await from_pidgin_string(user_message, file_system)

        choice_events = []
        for c in choices:
            label = c.get("label", "")
            choice_content = await from_pidgin_string(label, file_system)
            choice_events.append({
                "id": c.get("id", ""),
                "content": choice_content,
            })

        request_id = str(uuid.uuid4())

        event = WaitForChoiceEvent(
            request_id=request_id,
            prompt=prompt_content,
            choices=[ChoiceItem(id=c["id"], content=c["content"]) for c in choice_events],
            selection_mode=selection_mode,
            layout=layout,
            none_of_the_above_label=none_of_the_above_label,
        )

        # Persist the model message to the chat log if available.
        if on_chat_entry:
            on_chat_entry("agent", user_message)

        function_call_part = {
            "functionCall": {
                "name": CHAT_PRESENT_CHOICES,
                "args": args,
            }
        }

        raise SuspendError(event, function_call_part)

    return {
        "chat_request_user_input": chat_request_user_input,
        "chat_present_choices": chat_present_choices,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_chat_function_group_factory(
    on_chat_entry: "ChatEntryCallback" = None,
    workspace_root_id: str | None = None,
    scheduler: Any | None = None,
) -> FunctionGroupFactory:
    """Return a factory that builds the bees chat function group.

    The returned callable accepts ``SessionHooks`` and produces a
    ``FunctionGroup`` named ``"chat"`` — replacing the built-in
    chat group entirely. The handler bodies are inlined from
    opal_backend, using bees-native suspend/resume types.

    Args:
        on_chat_entry: Optional callback ``(role, content) -> None``
            invoked when the agent sends a user-facing message.
    """

    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
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
