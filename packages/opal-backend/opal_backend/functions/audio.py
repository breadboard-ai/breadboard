# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Audio generation function group for the agent loop.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Contains two functions, both ported from ``functions/generate.ts``:
- ``generate_speech_from_text`` — uses executeStep with the ``tts`` model API.
- ``generate_music_from_text`` — uses executeStep with the ``generate_music``
  model API.
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
from ..backend_client import BackendClient
from ..task_tree_manager import TaskTreeManager
from ..shared_schemas import (
    STATUS_UPDATE_SCHEMA,
    TASK_ID_SCHEMA,
    FILE_NAME_SCHEMA,
)

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

_INSTRUCTION = ""


# ---------------------------------------------------------------------------
# generate_speech_from_text
# ---------------------------------------------------------------------------


def _define_generate_speech(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
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
            **({"enableG1Quota": True} if enable_g1_quota else {}),
        }

        # Call executeStep.
        try:
            result = await execute_step(
                body,
                backend=backend,
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
                    "default": DEFAULT_VOICE,
                    "description": "The voice to use for speech generation.",
                },
                **FILE_NAME_SCHEMA,
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
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
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
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
            **({"enableG1Quota": True} if enable_g1_quota else {}),
        }

        # Call executeStep.
        try:
            result = await execute_step(
                body,
                backend=backend,
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
            "Generates instrumental music and audio soundscapes based on "
            "the provided prompt. "
            "To get your generated music closer to what you want, start "
            "with identifying your core musical idea and then refine your "
            "idea by adding keywords and modifiers. "
            "The following elements should be considered for your prompt: "
            "Genre & Style: The primary musical category (e.g., electronic "
            "dance, classical, jazz, ambient) and stylistic characteristics "
            "(e.g., 8-bit, cinematic, lo-fi). "
            "Mood & Emotion: The desired feeling the music should evoke "
            "(e.g., energetic, melancholy, peaceful, tense). "
            "Instrumentation: Key instruments you want to hear (e.g., "
            "piano, synthesizer, acoustic guitar, string orchestra, "
            "electronic drums). "
            "Tempo & Rhythm: The pace (e.g., fast tempo, slow ballad, "
            "120 BPM) and rhythmic character (e.g., driving beat, "
            "syncopated rhythm, gentle waltz). "
            "(Optional) Arrangement/Structure: How the music progresses "
            "or layers (e.g., starts with a solo piano, then strings "
            "enter, crescendo into a powerful chorus). "
            "(Optional) Soundscape/Ambiance: Background sounds or overall "
            "sonic environment (e.g., rain falling, city nightlife, "
            "spacious reverb, underwater feel). "
            "(Optional) Production Quality: Desired audio fidelity or "
            "recording style (e.g., high-quality production, clean mix, "
            "vintage recording, raw demo feel). "
            "For example: "
            "An energetic (mood) electronic dance track (genre) with a "
            "fast tempo (tempo) and a driving beat (rhythm), featuring "
            "prominent synthesizers (instrumentation) and electronic "
            "drums (instrumentation). High-quality production (production "
            "quality). "
            "A calm and dreamy (mood) ambient soundscape (genre/style) "
            "featuring layered synthesizers (instrumentation) and soft, "
            "evolving pads (instrumentation/arrangement). Slow tempo "
            "(tempo) with a spacious reverb (ambiance/production). Starts "
            "with a simple synth melody, then adds layers of atmospheric "
            "pads (arrangement)."
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
                **FILE_NAME_SCHEMA,
                **TASK_ID_SCHEMA,
                **STATUS_UPDATE_SCHEMA,
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
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with speech and music generation functions."""
    functions = [
        _define_generate_speech(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
        _define_generate_music(
            file_system=file_system,
            task_tree_manager=task_tree_manager,
            backend=backend,
            enable_g1_quota=enable_g1_quota,
        ),
    ]

    mapped = map_definitions(functions)
    return FunctionGroup(
        definitions=mapped.definitions,
        declarations=mapped.declarations,
        instruction=_INSTRUCTION,
    )
