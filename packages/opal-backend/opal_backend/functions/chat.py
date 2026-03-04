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

from ..function_definition import FunctionDefinition, FunctionGroup
from ..events import WaitForInputEvent, WaitForChoiceEvent, ChoiceItem
from ..suspend import SuspendError
from ..task_tree_manager import TaskTreeManager
from ..agent_file_system import AgentFileSystem
from ..pidgin import from_pidgin_string
from ..shared_schemas import TASK_ID_SCHEMA


CHAT_REQUEST_USER_INPUT = "chat_request_user_input"
CHAT_PRESENT_CHOICES = "chat_present_choices"

VALID_INPUT_TYPES = ["any", "text", "file-upload"]
VALID_SELECTION_MODES = ["single", "multiple"]
VALID_LAYOUTS = ["list", "row", "grid"]

CHAT_LOG_PATH = "/mnt/system/chat_log.json"
SKIPPED_SENTINEL = "__skipped__"
NONE_OF_THE_ABOVE_ID = "__none_of_the_above__"

# Type alias for the optional chat log entry callback.
# Signature: (role: "agent" | "user", content: str) -> None
ChatEntryCallback = Callable[[str, str], None] | None

INSTRUCTION = f"""

## Interacting with the User

Use the "chat_present_choices" function when you have a discrete set of options \
for the user to choose from. This provides a better user experience than asking \
them to type their selection.

Use the "chat_request_user_input" function for freeform text input or file uploads.

Prefer structured choices over freeform input when the answer space is bounded.

The chat log is maintained automatically at the file "{CHAT_LOG_PATH}".

If the user input requires multiple entries, split the conversation into \
multiple turns. For example, if you have three questions to ask, ask them \
over three full conversation turns rather than in one call.

"""


def _define_request_user_input(
    task_tree_manager: TaskTreeManager,
    file_system: AgentFileSystem,
    on_chat_entry: ChatEntryCallback = None,
) -> FunctionDefinition:
    """Port of ``chat_request_user_input`` from chat.ts.

    Raises ``SuspendError`` with a ``waitForInput`` event so the client
    can show an input UI and post the user's response back.
    """

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
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
            input_type=input_type,
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

    return FunctionDefinition(
        name=CHAT_REQUEST_USER_INPUT,
        description=(
            "Requests input from user. Call this function to hold a "
            "conversation with the user. Each call corresponds to a "
            "conversation turn. Use only when necessary to fulfill "
            "the objective."
        ),
        handler=handler,
        icon="chat_bubble",
        title="Asking the user",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "user_message": {
                    "type": "string",
                    "description": (
                        "Message to display to the user when requesting "
                        'input. The content may include references to files '
                        'using <file src="/mnt/name.ext" /> tags.'
                    ),
                },
                "input_type": {
                    "type": "string",
                    "enum": VALID_INPUT_TYPES,
                    "default": "any",
                    "description": (
                        "Input type hint for the chat UI. "
                        '"any" accepts all inputs, "text" constrains to text '
                        'only, "file-upload" only allows uploading files.'
                    ),
                },
                "skip_label": {
                    "type": "string",
                    "description": (
                        "If provided, adds a Skip button above the input "
                        "with this label. When the user taps skip, the "
                        "function returns { skipped: true }."
                    ),
                },
                **TASK_ID_SCHEMA,
            },
            "required": ["user_message"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "user_input": {
                    "type": "string",
                    "description": "Response from the user.",
                },
                "skipped": {
                    "type": "boolean",
                    "description": (
                        "True when the user tapped the skip button."
                    ),
                },
                "error": {
                    "type": "string",
                    "description": "Error description if something failed.",
                },
            },
        },
    )


def _define_present_choices(
    task_tree_manager: TaskTreeManager,
    file_system: AgentFileSystem,
    on_chat_entry: ChatEntryCallback = None,
) -> FunctionDefinition:
    """Port of ``chat_present_choices`` from chat.ts.

    Raises ``SuspendError`` with a ``waitForChoice`` event so the client
    can show a choice UI and post the user's selection back.
    """

    async def handler(args: dict[str, Any], status_cb: Any) -> dict[str, Any]:
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

    return FunctionDefinition(
        name=CHAT_PRESENT_CHOICES,
        description=(
            "Presents the user with a set of choices to select from. "
            "Use when you need the user to make a decision from a "
            "predefined set of options."
        ),
        handler=handler,
        icon="list",
        title="Presenting Choices to the User",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "user_message": {
                    "type": "string",
                    "description": (
                        "Message explaining what the user should choose. "
                        "The content may include references to files using "
                        '<file src="/mnt/name.ext" /> tags.'
                    ),
                },
                "choices": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Unique identifier for this choice.",
                            },
                            "label": {
                                "type": "string",
                                "description": (
                                    "Display text for the choice. The content "
                                    "may include references to files using "
                                    '<file src="/mnt/name.ext" /> tags.'
                                ),
                            },
                        },
                        "required": ["id", "label"],
                    },
                    "description": "The choices to present to the user.",
                },
                "selection_mode": {
                    "type": "string",
                    "enum": VALID_SELECTION_MODES,
                    "description": (
                        '"single" for choose-one, '
                        '"multiple" for any-of.'
                    ),
                },
                "layout": {
                    "type": "string",
                    "enum": VALID_LAYOUTS,
                    "default": "list",
                    "description": (
                        'Layout hint for displaying choices: '
                        '"list" (default): Vertical stack, best for longer '
                        'choice labels. '
                        '"row": Horizontal inline, best for short choices '
                        'like "Yes/No" or side-by-side comparisons '
                        '(e.g. images). '
                        '"grid": Wrapping grid that adapts to available space.'
                    ),
                },
                "none_of_the_above_label": {
                    "type": "string",
                    "description": (
                        "If provided, adds a visually distinct 'none of the "
                        "above' escape option with this label (e.g., 'Exit', "
                        "'Skip', 'Try Again'). Rendered below a separator "
                        "with secondary styling. When selected, returns ID "
                        '"__none_of_the_above__". Best suited for single '
                        "selection mode; in multiple mode it behaves as a "
                        "regular checkbox."
                    ),
                },
                **TASK_ID_SCHEMA,
            },
            "required": ["user_message", "choices", "selection_mode"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "selected": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Array of selected choice IDs.",
                },
                "error": {
                    "type": "string",
                    "description": "Error description if something failed.",
                },
            },
        },
    )


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
    request_input = _define_request_user_input(
        task_tree_manager, file_system, on_chat_entry
    )
    present_choices = _define_present_choices(
        task_tree_manager, file_system, on_chat_entry
    )

    return FunctionGroup(
        instruction=INSTRUCTION,
        definitions=[
            (request_input.name, request_input),
            (present_choices.name, present_choices),
        ],
        declarations=[
            {
                "name": request_input.name,
                "description": request_input.description,
                **(
                    {"parametersJsonSchema": request_input.parameters_json_schema}
                    if request_input.parameters_json_schema
                    else {}
                ),
                **(
                    {"responseJsonSchema": request_input.response_json_schema}
                    if request_input.response_json_schema
                    else {}
                ),
            },
            {
                "name": present_choices.name,
                "description": present_choices.description,
                **(
                    {"parametersJsonSchema": present_choices.parameters_json_schema}
                    if present_choices.parameters_json_schema
                    else {}
                ),
                **(
                    {"responseJsonSchema": present_choices.response_json_schema}
                    if present_choices.response_json_schema
                    else {}
                ),
            },
        ],
    )
