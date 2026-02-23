# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Audio generation function group for the agent loop.

Contains two functions:
- ``generate_speech_from_text`` — port of the speech agent function from
  ``generate.ts`` + ``callAudioGen`` from ``audio-generator/main.ts``.
  Uses executeStep with the ``tts`` model API.
- ``generate_music_from_text`` — port of the music agent function from
  ``generate.ts`` + ``callMusicGen`` from ``music-generator/main.ts``.
  Uses executeStep with the ``generate_music`` model API.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from ..agent_file_system import AgentFileSystem
from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from ..step_executor import (
    execute_step,
    encode_base64,
)
from ..task_tree_manager import TaskTreeManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GENERATE_SPEECH_FUNCTION = "generate_speech_from_text"
GENERATE_MUSIC_FUNCTION = "generate_music_from_text"

# Voice map — port of VoiceMap from audio-generator/main.ts
VOICE_MAP: dict[str, str] = {
    "Male (English)": "en-US-male",
    "Female (English)": "en-US-female",
}

VOICES = list(VOICE_MAP.keys())
DEFAULT_VOICE = "Female (English)"

_INSTRUCTION = f"""

## When to call "{GENERATE_SPEECH_FUNCTION}" function

Use this function to generate speech from text. It converts written text
into spoken audio using text-to-speech.

## When to call "{GENERATE_MUSIC_FUNCTION}" function

Use this function to generate instrumental music and audio soundscapes
based on a text prompt.
"""


# ---------------------------------------------------------------------------
# generate_speech_from_text
# ---------------------------------------------------------------------------


def _define_generate_speech(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionDefinition:
    """Port of the speech agent function from generate.ts + callAudioGen."""

    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        text = args.get("text", "")
        voice = args.get("voice", DEFAULT_VOICE)
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Speech")

        # Resolve voice parameter.
        voice_param = VOICE_MAP.get(voice, "en-US-female")

        # Build ExecuteStepRequest — port of callAudioGen.
        execution_inputs: dict[str, Any] = {
            "text_to_speak": {
                "chunks": [
                    {
                        "mimetype": "text/plain",
                        "data": encode_base64(text),
                    }
                ]
            },
            "voice_key": {
                "chunks": [
                    {
                        "mimetype": "text/plain",
                        "data": encode_base64(voice_param),
                    }
                ]
            },
        }

        body = {
            "planStep": {
                "stepName": "GenerateAudio",
                "modelApi": "tts",
                "inputParameters": ["text_to_speak"],
                "systemPrompt": "",
                "output": "generated_speech",
            },
            "execution_inputs": execution_inputs,
        }

        # Call executeStep.
        try:
            result = await execute_step(
                body,
                access_token=access_token,
                upstream_base=upstream_base,
                origin=origin,
            )
        except ValueError as e:
            logger.error("generate_speech executeStep error: %s", e)
            return {"error": str(e)}

        status_cb(None)

        # Save output audio to agent FS — single output.
        output_chunks = result.get("chunks", [])
        if not output_chunks:
            return {"error": "No speech was generated"}

        first_content = output_chunks[0]
        parts = first_content.get("parts", [])
        if not parts:
            return {"error": "No speech was generated"}

        part = parts[0]
        result_path = file_system.add_part(part, file_name)
        if isinstance(result_path, dict) and "$error" in result_path:
            return {"error": result_path["$error"]}

        return {"speech": result_path}

    return FunctionDefinition(
        name=GENERATE_SPEECH_FUNCTION,
        description="Generates speech from text",
        handler=handler,
        icon="audio_magic_eraser",
        title="Generating Speech",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The verbatim text to turn into speech.",
                },
                "voice": {
                    "type": "string",
                    "enum": VOICES,
                    "description": "The voice to use for speech generation.",
                },
                "file_name": {
                    "type": "string",
                    "description": "Optional file name for the output.",
                },
                "task_id": {
                    "type": "string",
                    "description": "Task ID for progress tracking.",
                },
                "status_update": {
                    "type": "string",
                    "description": "Brief status text shown in the UI.",
                },
            },
            "required": ["text"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": "Error description if generation failed.",
                },
                "speech": {
                    "type": "string",
                    "description": "Generated speech file path.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# generate_music_from_text
# ---------------------------------------------------------------------------


def _define_generate_music(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionDefinition:
    """Port of the music agent function from generate.ts + callMusicGen."""

    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Music")

        # Build ExecuteStepRequest — port of callMusicGen.
        execution_inputs: dict[str, Any] = {
            "prompt": {
                "chunks": [
                    {
                        "mimetype": "text/plain",
                        "data": encode_base64(prompt),
                    }
                ]
            },
        }

        body = {
            "planStep": {
                "stepName": "GenerateMusic",
                "modelApi": "generate_music",
                "inputParameters": ["prompt"],
                "systemPrompt": "",
                "output": "generated_music",
            },
            "execution_inputs": execution_inputs,
        }

        # Call executeStep.
        try:
            result = await execute_step(
                body,
                access_token=access_token,
                upstream_base=upstream_base,
                origin=origin,
            )
        except ValueError as e:
            logger.error("generate_music executeStep error: %s", e)
            return {"error": str(e)}

        status_cb(None)

        # Save output audio to agent FS — single output.
        output_chunks = result.get("chunks", [])
        if not output_chunks:
            return {"error": "No music was generated"}

        first_content = output_chunks[0]
        parts = first_content.get("parts", [])
        if not parts:
            return {"error": "No music was generated"}

        part = parts[0]
        result_path = file_system.add_part(part, file_name)
        if isinstance(result_path, dict) and "$error" in result_path:
            return {"error": result_path["$error"]}

        return {"music": result_path}

    return FunctionDefinition(
        name=GENERATE_MUSIC_FUNCTION,
        description=(
            "Generates instrumental music and audio soundscapes "
            "based on the provided prompt"
        ),
        handler=handler,
        icon="audio_magic_eraser",
        title="Generating Music",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The prompt from which to generate music.",
                },
                "file_name": {
                    "type": "string",
                    "description": "Optional file name for the output.",
                },
                "task_id": {
                    "type": "string",
                    "description": "Task ID for progress tracking.",
                },
                "status_update": {
                    "type": "string",
                    "description": "Brief status text shown in the UI.",
                },
            },
            "required": ["prompt"],
        },
        response_json_schema={
            "type": "object",
            "properties": {
                "error": {
                    "type": "string",
                    "description": "Error description if generation failed.",
                },
                "music": {
                    "type": "string",
                    "description": "Generated music file path.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_audio_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionGroup:
    """Build a FunctionGroup with speech and music generation functions."""
    functions = [
        _define_generate_speech(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            access_token=access_token,
            upstream_base=upstream_base,
            origin=origin,
        ),
        _define_generate_music(
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
