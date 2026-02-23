# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Generate function group for the agent loop.

Port of ``functions/generate.ts``. Currently provides ``generate_text``,
the core text-generation function that makes a sub-call to Gemini.

The handler flow:
1. ``from_pidgin_string(prompt)`` — resolve ``<file>`` tags to data parts
2. Build Gemini body with system instruction, contents, and grounding tools
3. ``conform_body(body)`` — resolve ``storedData``/``fileData`` parts
4. ``stream_generate_content(model, body)`` — stream from Gemini
5. Merge text parts from the response
6. Return the merged text
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from ..agent_file_system import AgentFileSystem
from ..conform_body import conform_body
from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from ..gemini_client import stream_generate_content
from ..pidgin import from_pidgin_string
from ..task_tree_manager import TaskTreeManager

logger = logging.getLogger(__name__)

export = ["get_generate_function_group", "GENERATE_TEXT_FUNCTION"]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GENERATE_TEXT_FUNCTION = "generate_text"

FLASH_MODEL_NAME = "gemini-3-flash-preview"
PRO_MODEL_NAME = "gemini-3-pro-preview"
LITE_MODEL_NAME = "gemini-2.5-flash-lite"

# The default system instruction for generate_text sub-calls.
# Matches ``defaultSystemInstruction()`` from generate-text/system-instruction.ts.
DEFAULT_SYSTEM_INSTRUCTION = {
    "parts": [
        {
            "text": (
                "You are working as part of an AI system, so no chit-chat "
                "and no explaining what you're doing and why.\n"
                'DO NOT start with "Okay", or "Alright" or any preambles. '
                "Just the output, please."
            )
        }
    ],
    "role": "user",
}

# The instruction that tells the outer agent when to use generate_text.
# Port of the ``instruction`` template literal from generate.ts.
_INSTRUCTION = f"""

## When to call "{GENERATE_TEXT_FUNCTION}" function

When evaluating the objective, make sure to determine whether calling \
"{GENERATE_TEXT_FUNCTION}" function is warranted. The key tradeoff here is \
latency: because it's an additional model call, the "generate_text" will \
take longer to finish.

Your job is to fulfill the objective as efficiently as possible, so weigh \
the need to invoke "{GENERATE_TEXT_FUNCTION}" carefully.

Here is the rules of thumb:

- For shorter responses like a chat conversation, just do the text \
generation yourself. You are an LLM and you can do it without calling \
"{GENERATE_TEXT_FUNCTION}" function.
- For longer responses like generating a chapter of a book or analyzing a \
large and complex set of files, use "{GENERATE_TEXT_FUNCTION}" function.
"""


# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------


def _resolve_text_model(model: str) -> str:
    """Resolve a model shorthand to a full model name."""
    if model == "pro":
        return PRO_MODEL_NAME
    if model == "lite":
        return LITE_MODEL_NAME
    return FLASH_MODEL_NAME  # default


# ---------------------------------------------------------------------------
# generate_text function definition
# ---------------------------------------------------------------------------


def _define_generate_text(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionDefinition:
    """Port of the ``generate_text`` function from generate.ts.

    Makes a Gemini sub-call with the user's prompt, optional grounding
    tools, and returns the generated text.
    """

    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        model = args.get("model", "flash")
        search_grounding = args.get("search_grounding", False)
        maps_grounding = args.get("maps_grounding", False)
        url_context = args.get("url_context", False)
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        if status_update:
            status_cb(status_update)
        elif search_grounding or maps_grounding:
            status_cb("Researching")
        else:
            status_cb("Generating Text")

        # 1. Resolve pidgin <file> tags in the prompt
        translated = from_pidgin_string(prompt, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        # 2. Build grounding tools
        tools: list[dict[str, Any]] = []
        if search_grounding:
            tools.append({"googleSearch": {}})
        if maps_grounding:
            tools.append({"googleMaps": {}})
        if url_context:
            # Auto-approved in dev backend (no consent flow)
            tools.append({"urlContext": {}})

        # 3. Build the Gemini body
        generation_config: dict[str, Any] = {}
        if model == "pro":
            generation_config["thinkingConfig"] = {
                "includeThoughts": True,
                "thinkingLevel": "high",
            }

        body: dict[str, Any] = {
            "systemInstruction": DEFAULT_SYSTEM_INSTRUCTION,
            "contents": [translated],
            "generationConfig": generation_config,
        }
        if tools:
            body["tools"] = tools

        # 4. Resolve storedData/fileData parts
        try:
            if upstream_base:
                body = await conform_body(
                    body,
                    access_token=access_token,
                    upstream_base=upstream_base,
                    origin=origin,
                )
        except Exception as e:
            logger.error("generate_text conform_body error: %s", e)
            return {"error": f"Failed to resolve data parts: {e}"}

        # 5. Stream from Gemini
        resolved_model = _resolve_text_model(model)
        result_texts: list[str] = []

        try:
            async for chunk in stream_generate_content(
                resolved_model,
                body,
                access_token=access_token,
            ):
                candidates = chunk.get("candidates", [])
                if not candidates:
                    continue
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                for part in parts:
                    if not part:
                        continue
                    if "text" in part:
                        # Skip thinking/thought parts
                        if part.get("thought"):
                            continue
                        result_texts.append(part["text"])
        except Exception as e:
            logger.error("generate_text streaming error: %s", e)
            return {"error": str(e)}

        status_cb(None)

        # 6. Merge and return
        if not result_texts:
            return {"error": "No text was generated. Please try again"}
        return {"text": "".join(result_texts)}

    return FunctionDefinition(
        name=GENERATE_TEXT_FUNCTION,
        description=(
            "An extremely versatile text generator, powered by Gemini. "
            "Use it for any tasks that involve generation of text. "
            "Supports multimodal content input."
        ),
        handler=handler,
        icon="text_analysis",
        title="Generating Text",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed prompt to use for text generation. The "
                        "prompt may include references to files. For "
                        'instance, if you have an existing file at '
                        '"/mnt/text3.md", you can reference it as '
                        '<file src="/mnt/text3.md" /> in the prompt. If '
                        "you do not use <file> tags, the text generator "
                        "will not be able to access the file.\n\n"
                        "These references can point to files of any type, "
                        "such as images, audio, videos, etc."
                    ),
                },
                "model": {
                    "type": "string",
                    "enum": ["pro", "flash", "lite"],
                    "description": (
                        "The Gemini model to use for text generation. "
                        '"pro" for complex reasoning, "flash" for '
                        'general use, "lite" for speed.'
                    ),
                },
                "search_grounding": {
                    "type": "boolean",
                    "description": (
                        "Whether to use Google Search grounding for "
                        "real-time web content."
                    ),
                },
                "maps_grounding": {
                    "type": "boolean",
                    "description": (
                        "Whether to use Google Maps grounding."
                    ),
                },
                "url_context": {
                    "type": "boolean",
                    "description": (
                        "Set to true to allow Gemini to retrieve "
                        "context from URLs specified in the prompt."
                    ),
                },
                "task_id": {
                    "type": "string",
                    "description": (
                        "The task ID for progress tracking."
                    ),
                },
                "status_update": {
                    "type": "string",
                    "description": (
                        "Brief status text shown in the UI."
                    ),
                },
            },
            "required": ["prompt", "model"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": (
                        "If an error occurred, a description of the error"
                    ),
                },
                "text": {
                    "type": "string",
                    "description": "The output of the text generator.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_generate_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionGroup:
    """Build a FunctionGroup with the generate_text function.

    This is the Python equivalent of ``getGenerateFunctionGroup`` from
    generate.ts.

    Args:
        file_system: The AgentFileSystem for resolving file references.
        task_tree_manager: Optional TaskTreeManager for progress tracking.
        access_token: OAuth2 access token for Gemini and upload endpoints.
        upstream_base: Base URL for One Platform upload endpoints.

    Returns:
        A FunctionGroup with the generate_text declaration, definition,
        and instruction.
    """
    functions: list[FunctionDefinition] = [
        _define_generate_text(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            upstream_base=upstream_base,
            origin=origin,
        ),
    ]

    mapped = map_definitions(functions)
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction=_INSTRUCTION,
    )
