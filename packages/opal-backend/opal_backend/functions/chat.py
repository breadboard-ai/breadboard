# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Chat functions for the agent loop — suspend-based.

Port of ``functions/chat.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

These functions request user input by raising
``SuspendError``. The loop catches it, saves state, and closes the stream
with a suspend event. The client collects user input and POSTs back to
resume the loop.

Two functions:
- ``chat_request_user_input``: freeform text input or file upload
- ``chat_present_choices``: structured choice selection
"""

from __future__ import annotations

import uuid
from typing import Any, Callable

from ..function_definition import (
    FunctionGroup,
    load_declarations,
    assemble_function_group,
)
from ..events import WaitForInputEvent, WaitForChoiceEvent, ChoiceItem
from ..suspend import SuspendError
from ..task_tree_manager import TaskTreeManager
from ..agent_file_system import AgentFileSystem
from ..pidgin import from_pidgin_string


CHAT_REQUEST_USER_INPUT = "chat_request_user_input"
CHAT_PRESENT_CHOICES = "chat_present_choices"

VALID_INPUT_TYPES = ["any", "text", "file-upload"]
VALID_SELECTION_MODES = ["single", "multiple"]
VALID_LAYOUTS = ["list", "row", "grid"]

CHAT_LOG_PATH = "/mnt/system/chat_log.json"
SKIPPED_SENTINEL = "__skipped__"

# Maps the LLM-facing input_type parameter to the icon name sent
# on the wire in the waitForInput event.  Mirrors TS computeFormat().
_INPUT_TYPE_TO_FORMAT = {
    "any": "asterisk",
    "text": "edit_note",
    "file-upload": "upload",
}
NONE_OF_THE_ABOVE_ID = "__none_of_the_above__"

# Type alias for the optional chat log entry callback.
# Signature: (role: "agent" | "user", content: str) -> None
ChatEntryCallback = Callable[[str, str], None] | None

# Load declarations once at module level.
_LOADED = load_declarations("chat")

# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def _make_handlers(
    *,
    task_tree_manager: TaskTreeManager,
    file_system: AgentFileSystem,
    on_chat_entry: ChatEntryCallback = None,
) -> dict[str, Any]:
    """Build handler map for chat functions."""

    async def chat_request_user_input(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        task_id = args.get("task_id")
        if task_id:
            task_tree_manager.set_in_progress(task_id, "")

        user_message = args.get("user_message", "")
        input_type = args.get("input_type", "any")
        skip_label = args.get("skip_label")

        if input_type not in VALID_INPUT_TYPES:
            input_type = "any"

        request_id = str(uuid.uuid4())

        # Resolve pidgin file references in the prompt before sending
        # to the client. Mirrors TS AgentUI.chat() L151:
        #   const message = await this.translator.fromPidginString(pidginString);
        prompt_content = await from_pidgin_string(user_message, file_system)

        event = WaitForInputEvent(
            request_id=request_id,
            prompt=prompt_content,
            input_type=_INPUT_TYPE_TO_FORMAT.get(input_type, "asterisk"),
            skip_label=skip_label,
        )

        # Persist the model message to the __chat_log__ sheet if available.
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
        task_id = args.get("task_id")
        if task_id:
            task_tree_manager.set_in_progress(task_id, "")

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
        # The agent writes pidgin text (<file src="/mnt/..." />) which
        # must be resolved to inline data before sending to the client.
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

        # Persist the model message to the __chat_log__ sheet if available.
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


def get_chat_function_group(
    *,
    task_tree_manager: TaskTreeManager,
    file_system: AgentFileSystem,
    on_chat_entry: ChatEntryCallback = None,
) -> FunctionGroup:
    """Build a FunctionGroup with all chat functions.

    Args:
        task_tree_manager: For tracking task progress.
        file_system: For resolving pidgin file references in choices.
        on_chat_entry: Optional callback for persisting chat entries to
            the ``__chat_log__`` sheet. Signature: ``(role, content)``.

    Returns:
        FunctionGroup with chat_request_user_input and
        chat_present_choices functions.
    """
    handlers = _make_handlers(
        task_tree_manager=task_tree_manager,
        file_system=file_system,
        on_chat_entry=on_chat_entry,
    )
    return assemble_function_group(_LOADED, handlers)
