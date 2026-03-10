# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Generate function group for the agent loop.

Port of ``functions/generate.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Provides all generation functions:
- ``generate_text`` — sub-call to Gemini for text generation
- ``generate_and_execute_code`` — Gemini with code execution tool
- ``generate_images`` — executeStep with the ``ai_image_tool`` model API
- ``generate_speech_from_text`` — executeStep with the ``tts`` model API
- ``generate_music_from_text`` — executeStep with the ``generate_music``
  model API
- ``generate_video`` — executeStep with the ``generate_video`` model API

The first two return text; the remaining four produce media files saved
to the agent file system.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from ..agent_file_system import AgentFileSystem
from ..conform_body import conform_body
from ..backend_client import BackendClient
from ..error_classifier import to_error_or_response

from ..function_definition import (
    FunctionGroup,
    StatusUpdateCallback,
    load_declarations,
    assemble_function_group,
)
from ..events import QueryConsentEvent
from ..gemini_client import stream_generate_content
from ..pidgin import content_to_pidgin_string, from_pidgin_string, merge_text_parts
from ..step_executor import (
    execute_step,
    resolve_part_to_chunk,
    encode_base64,
)
from ..suspend import SuspendError
from ..task_tree_manager import TaskTreeManager

logger = logging.getLogger(__name__)

export = [
    "get_generate_function_group",
    "get_image_function_group",
    "get_audio_function_group",
    "get_video_function_group",
    "GENERATE_TEXT_FUNCTION",
    "GENERATE_AND_EXECUTE_CODE_FUNCTION",
    "GENERATE_IMAGES_FUNCTION",
    "GENERATE_SPEECH_FUNCTION",
    "GENERATE_MUSIC_FUNCTION",
    "GENERATE_VIDEO_FUNCTION",
]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GENERATE_TEXT_FUNCTION = "generate_text"
GENERATE_AND_EXECUTE_CODE_FUNCTION = "generate_and_execute_code"
GENERATE_IMAGES_FUNCTION = "generate_images"
GENERATE_SPEECH_FUNCTION = "generate_speech_from_text"
GENERATE_MUSIC_FUNCTION = "generate_music_from_text"
GENERATE_VIDEO_FUNCTION = "generate_video"

# Text model names
FLASH_MODEL_NAME = "gemini-3-flash-preview"
PRO_MODEL_NAME = "gemini-3.1-pro-preview"
LITE_MODEL_NAME = "gemini-2.5-flash-lite"

# Image model names
IMAGE_PRO_MODEL_NAME = "gemini-3-pro-image-preview"
IMAGE_FLASH_MODEL_NAME = "gemini-2.5-flash-image"

# Video model name
VIDEO_MODEL_NAME = "veo-3.1-generate-preview"

# Voice map — port of VoiceMap from audio-generator/main.ts
VOICE_MAP: dict[str, str] = {
    "Male (English)": "en-US-male",
    "Female (English)": "en-US-female",
}
VOICES = list(VOICE_MAP.keys())
DEFAULT_VOICE = "Female (English)"

# The default system instruction for generate_text sub-calls.
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

# System instruction for the code generation sub-agent.
_CODE_SYSTEM_INSTRUCTION = {
    "parts": [
        {
            "text": (
                "Your job is to generate and execute code to fulfill "
                "your objective.\n\n"
                "You are working as part of an AI system, so no chit-chat "
                "and no explaining what you're doing and why.\n"
                'DO NOT start with "Okay", or "Alright" or any preambles. '
                "Just the output, please."
            )
        }
    ],
    "role": "user",
}

# Load declarations once at module level.
_LOADED = load_declarations("generate")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _resolve_text_model(model: str) -> str:
    """Resolve a model shorthand to a full model name."""
    if model == "pro":
        return PRO_MODEL_NAME
    if model == "flash":
        return FLASH_MODEL_NAME
    if model == "lite":
        return LITE_MODEL_NAME
    return LITE_MODEL_NAME  # default — matches TS fallback


# ---------------------------------------------------------------------------
# Veo safety-code expansion
# ---------------------------------------------------------------------------

SUPPORT_CODES: dict[int, str] = {
    58061214: "child",
    17301594: "child",
    29310472: "celebrity",
    15236754: "celebrity",
    64151117: "unsafe",
    42237218: "unsafe",
    62263041: "dangerous",
    57734940: "hate",
    22137204: "hate",
    74803281: "other",
    29578790: "other",
    42876398: "other",
    39322892: "face",
    92201652: "pii",
    89371032: "prohibited",
    49114662: "prohibited",
    72817394: "prohibited",
    90789179: "sexual",
    63429089: "sexual",
    43188360: "sexual",
    78610348: "toxic",
    61493863: "violence",
    56562880: "violence",
    32635315: "vulgar",
}

_SUPPORT_CODE_RE = re.compile(r"Support codes: ([\d, ]+)")


def expand_veo_error(error_message: str, model: str) -> dict[str, Any]:
    """Expand a Veo error message with safety reason metadata."""
    match = _SUPPORT_CODE_RE.search(error_message)
    reasons: set[str] = set()

    if match:
        codes = [int(c.strip()) for c in match.group(1).split(",")]
        for code in codes:
            reasons.add(SUPPORT_CODES.get(code, "other"))

    if reasons:
        return {
            "error": error_message,
            "metadata": {
                "origin": "server",
                "kind": "safety",
                "reasons": sorted(reasons),
                "model": model,
            },
        }

    return {"error": error_message}


# ---------------------------------------------------------------------------
# Text generation handlers
# ---------------------------------------------------------------------------


def _make_text_handlers(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    backend: BackendClient | None = None,
    graph_url: str = "",
    consents_granted: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build handler map and preconditions for text generation functions.

    Returns (handlers, preconditions) tuple.
    """
    granted = consents_granted or set()

    async def generate_text_precondition(args: dict[str, Any]) -> None:
        """Gate: require user consent before enabling url_context."""
        if args.get("url_context"):
            consent_key = "GET_ANY_WEBPAGE"
            if consent_key not in granted:
                raise SuspendError(
                    QueryConsentEvent(
                        request_id=str(uuid.uuid4()),
                        consent_type=consent_key,
                        scope={},
                        graph_url=graph_url,
                    ),
                    {"functionCall": {
                        "name": GENERATE_TEXT_FUNCTION,
                        "args": args,
                    }},
                    is_precondition_check=True,
                )

    async def generate_text(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        model = args.get("model", "flash")
        search_grounding = args.get("search_grounding", False)
        maps_grounding = args.get("maps_grounding", False)
        url_context = args.get("url_context", False)
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        task_tree_manager.set_in_progress(task_id, status_update)

        if status_update:
            status_cb(status_update, {"expected_duration_in_sec": 20})
        elif search_grounding or maps_grounding:
            status_cb("Researching", {"expected_duration_in_sec": 30})
        else:
            status_cb("Generating Text", {"expected_duration_in_sec": 20})

        translated = await from_pidgin_string(prompt, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        tools: list[dict[str, Any]] = []
        if search_grounding:
            tools.append({"googleSearch": {}})
        if maps_grounding:
            tools.append({"googleMaps": {}})
        if url_context:
            tools.append({"urlContext": {}})

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

        try:
            if backend:
                body = await conform_body(body, backend=backend)
        except Exception as e:
            logger.error("generate_text conform_body error: %s", e)
            return {"error": f"Failed to resolve data parts: {e}"}

        resolved_model = _resolve_text_model(model)
        result_parts: list[dict[str, Any]] = []

        try:
            async for chunk in stream_generate_content(
                resolved_model, body, backend=backend,
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
                        if part.get("thought"):
                            status_cb(part["text"], {"is_thought": True})
                        else:
                            result_parts.append(part)
        except Exception as e:
            logger.error("generate_text streaming error: %s", e)
            return to_error_or_response({"error": str(e)})

        status_cb(None, None)

        text_parts = merge_text_parts(result_parts, separator="")
        if not text_parts:
            return {"error": "No text was generated. Please try again"}
        merged = {"parts": text_parts}
        return {"text": content_to_pidgin_string(merged, file_system)}

    async def generate_and_execute_code(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        search_grounding = args.get("search_grounding", False)
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        task_tree_manager.set_in_progress(task_id, status_update)

        if status_update:
            status_cb(status_update, {"expected_duration_in_sec": 40})
        elif search_grounding:
            status_cb("Researching", {"expected_duration_in_sec": 50})
        else:
            status_cb("Generating Code", {"expected_duration_in_sec": 40})

        translated = await from_pidgin_string(prompt, file_system)
        if isinstance(translated, dict) and "$error" in translated:
            return {"error": translated["$error"]}

        tools: list[dict[str, Any]] = []
        if search_grounding:
            tools.append({"googleSearch": {}})
        tools.append({"codeExecution": {}})

        body: dict[str, Any] = {
            "systemInstruction": _CODE_SYSTEM_INSTRUCTION,
            "contents": [translated],
        }
        if tools:
            body["tools"] = tools

        try:
            if backend:
                body = await conform_body(body, backend=backend)
        except Exception as e:
            logger.error("generate_code conform_body error: %s", e)
            return {"error": f"Failed to resolve data parts: {e}"}

        result_parts: list[dict[str, Any]] = []
        last_code_execution_error: str | None = None

        try:
            async for chunk in stream_generate_content(
                FLASH_MODEL_NAME, body, backend=backend,
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
                        if part.get("thought"):
                            status_cb(part["text"], {"is_thought": True})
                        else:
                            result_parts.append(part)
                    elif "inlineData" in part:
                        file_path = file_system.add_part(part)
                        if isinstance(file_path, dict) and "$error" in file_path:
                            return {
                                "error": (
                                    "Code generation failed due to "
                                    "invalid file output."
                                )
                            }
                        result_parts.append({"text": f'<file src="{file_path}" />'})
                    elif "codeExecutionResult" in part:
                        outcome = part["codeExecutionResult"].get("outcome", "")
                        output = part["codeExecutionResult"].get("output", "")
                        if outcome != "OUTCOME_OK":
                            last_code_execution_error = output
                        else:
                            last_code_execution_error = None
        except Exception as e:
            logger.error("generate_code streaming error: %s", e)
            return to_error_or_response({"error": str(e)})

        if last_code_execution_error:
            return {
                "error": (
                    "The code generator tried and failed with the "
                    f"following error:\n\n{last_code_execution_error}"
                )
            }

        status_cb(None, None)

        text_parts = merge_text_parts(result_parts, separator="")
        if not text_parts:
            return {"error": "No text was generated. Please try again"}
        if len(text_parts) > 1:
            logger.warning("More than one part generated: %s", text_parts)
        merged = "".join(p["text"] for p in text_parts if "text" in p)
        return {"result": merged}

    handlers = {
        "generate_text": generate_text,
        "generate_and_execute_code": generate_and_execute_code,
    }
    preconditions = {
        "generate_text": generate_text_precondition,
    }
    return handlers, preconditions


# ---------------------------------------------------------------------------
# Image generation handler
# ---------------------------------------------------------------------------

_IMAGE_STEP_NAME = "AI Image Tool"
_IMAGE_OUTPUT_NAME = "generated_image"
_IMAGE_API_NAME = "ai_image_tool"


def _make_image_handler(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> dict[str, Any]:
    """Build handler map for generate_images."""

    async def generate_images(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        model = args.get("model", "flash")
        input_images = args.get("images", [])
        aspect_ratio = args.get("aspect_ratio", "16:9")
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Image(s)", None)

        image_parts = await file_system.get_many(input_images)
        if isinstance(image_parts, dict) and "$error" in image_parts:
            return {"error": image_parts["$error"]}

        image_chunks: list[dict[str, Any]] = []
        for data_part in image_parts:
            try:
                chunk = await resolve_part_to_chunk(data_part, backend=backend)
                image_chunks.append(chunk)
            except ValueError as e:
                return {"error": str(e)}

        model_name = (
            IMAGE_PRO_MODEL_NAME if model == "pro" else IMAGE_FLASH_MODEL_NAME
        )

        execution_inputs: dict[str, Any] = {
            "input_instruction": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(prompt),
                }]
            },
            "aspect_ratio_key": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(aspect_ratio),
                }]
            },
        }

        input_parameters = ["input_instruction"]
        if image_chunks:
            execution_inputs["input_image"] = {"chunks": image_chunks}
            input_parameters.append("input_image")

        body = {
            "planStep": {
                "stepName": _IMAGE_STEP_NAME,
                "modelApi": _IMAGE_API_NAME,
                "inputParameters": input_parameters,
                "systemPrompt": "",
                "options": {
                    "modelName": model_name,
                    "disablePromptRewrite": True,
                },
                "output": _IMAGE_OUTPUT_NAME,
            },
            "execution_inputs": execution_inputs,
            **({"enableG1Quota": True} if enable_g1_quota else {}),
        }

        try:
            result = await execute_step(body, backend=backend)
        except ValueError as e:
            logger.error("generate_images executeStep error: %s", e)
            return to_error_or_response({"error": str(e)})

        status_cb(None, None)

        output_chunks = result.get("chunks", [])
        if not output_chunks:
            return {"error": "No images were generated. Please try again"}

        all_parts: list[dict[str, Any]] = []
        for llm_content in output_chunks:
            for part in llm_content.get("parts", []):
                all_parts.append(part)

        errors: list[str] = []
        image_paths: list[str] = []

        for i, part in enumerate(all_parts):
            name = file_name
            if name and len(all_parts) > 1:
                name = f"{name}_{i + 1}"
            result_path = file_system.add_part(part, name)
            if isinstance(result_path, dict) and "$error" in result_path:
                errors.append(result_path["$error"])
            elif isinstance(result_path, str):
                image_paths.append(result_path)

        if errors:
            return {"error": ", ".join(errors)}
        return {"images": image_paths}

    return {"generate_images": generate_images}


# ---------------------------------------------------------------------------
# Audio generation handlers
# ---------------------------------------------------------------------------


def _make_audio_handlers(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> dict[str, Any]:
    """Build handler map for generate_speech_from_text and
    generate_music_from_text."""

    async def generate_speech_from_text(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        text = args.get("text", "")
        voice = args.get("voice", DEFAULT_VOICE)
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Speech", None)

        voice_param = VOICE_MAP.get(voice, "en-US-female")

        execution_inputs: dict[str, Any] = {
            "text_to_speak": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(text),
                }]
            },
            "voice_key": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(voice_param),
                }]
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

        try:
            result = await execute_step(body, backend=backend)
        except ValueError as e:
            logger.error("generate_speech executeStep error: %s", e)
            return to_error_or_response({"error": str(e)})

        status_cb(None, None)

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

    async def generate_music_from_text(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Music", None)

        execution_inputs: dict[str, Any] = {
            "prompt": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(prompt),
                }]
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

        try:
            result = await execute_step(body, backend=backend)
        except ValueError as e:
            logger.error("generate_music executeStep error: %s", e)
            return to_error_or_response({"error": str(e)})

        status_cb(None, None)

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

    return {
        "generate_speech_from_text": generate_speech_from_text,
        "generate_music_from_text": generate_music_from_text,
    }


# ---------------------------------------------------------------------------
# Video generation handler
# ---------------------------------------------------------------------------

ASPECT_RATIOS = ["16:9", "9:16"]


def _make_video_handler(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> dict[str, Any]:
    """Build handler map for generate_video."""

    async def generate_video(
        args: dict[str, Any], status_cb: StatusUpdateCallback
    ) -> dict[str, Any]:
        prompt = args.get("prompt", "")
        reference_images = args.get("images", [])
        aspect_ratio = args.get("aspect_ratio", "16:9")
        file_name = args.get("file_name")
        task_id = args.get("task_id")
        status_update = args.get("status_update")

        if task_tree_manager and task_id:
            task_tree_manager.set_in_progress(task_id, status_update)

        status_cb(status_update or "Generating Video", None)

        if aspect_ratio not in ASPECT_RATIOS:
            aspect_ratio = "16:9"

        image_chunks: list[dict[str, Any]] = []
        for image_path in reference_images:
            result = await file_system.get(image_path)
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}
            if not result:
                return {"error": f'Empty file: "{image_path}"'}
            data_part = result[0]

            try:
                chunk = await resolve_part_to_chunk(data_part, backend=backend)
                image_chunks.append(chunk)
            except ValueError as e:
                return {"error": str(e)}

        execution_inputs: dict[str, Any] = {
            "text_instruction": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(prompt),
                }]
            },
            "aspect_ratio_key": {
                "chunks": [{
                    "mimetype": "text/plain",
                    "data": encode_base64(aspect_ratio),
                }]
            },
        }

        input_parameters = ["text_instruction"]
        if image_chunks:
            execution_inputs["reference_image"] = {"chunks": image_chunks}
            input_parameters.append("reference_image")

        body = {
            "planStep": {
                "stepName": "GenerateVideo",
                "modelApi": "generate_video",
                "inputParameters": input_parameters,
                "systemPrompt": "",
                "options": {
                    "modelName": VIDEO_MODEL_NAME,
                    "disablePromptRewrite": False,
                },
                "output": "generated_video",
            },
            "execution_inputs": execution_inputs,
            **({"enableG1Quota": True} if enable_g1_quota else {}),
        }

        try:
            result = await execute_step(body, backend=backend)
        except ValueError as e:
            logger.error("generate_video executeStep error: %s", e)
            error_msg = str(e)
            expanded = expand_veo_error(error_msg, VIDEO_MODEL_NAME)
            return to_error_or_response(expanded)

        status_cb(None, None)

        output_chunks = result.get("chunks", [])
        if not output_chunks:
            return {"error": "No video was generated. Please try again"}

        first_content = output_chunks[0]
        parts = first_content.get("parts", [])
        if not parts:
            return {"error": "No video was generated. Please try again"}

        part = parts[0]
        result_path = file_system.add_part(part, file_name)
        if isinstance(result_path, dict) and "$error" in result_path:
            return {"error": result_path["$error"]}

        return {"video": result_path}

    return {"generate_video": generate_video}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_generate_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager,
    backend: BackendClient | None = None,
    graph_url: str = "",
    consents_granted: set[str] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with generate_text and
    generate_and_execute_code."""
    handlers, preconditions = _make_text_handlers(
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        backend=backend,
        graph_url=graph_url,
        consents_granted=consents_granted,
    )
    return assemble_function_group(
        _LOADED, handlers, preconditions=preconditions
    )


def get_image_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with generate_images."""
    handlers = _make_image_handler(
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        backend=backend,
        enable_g1_quota=enable_g1_quota,
    )
    return assemble_function_group(
        _LOADED, handlers, instruction_override=""
    )


def get_audio_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with generate_speech_from_text and
    generate_music_from_text."""
    handlers = _make_audio_handlers(
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        backend=backend,
        enable_g1_quota=enable_g1_quota,
    )
    return assemble_function_group(
        _LOADED, handlers, instruction_override=""
    )


def get_video_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with generate_video."""
    handlers = _make_video_handler(
        file_system=file_system,
        task_tree_manager=task_tree_manager,
        backend=backend,
        enable_g1_quota=enable_g1_quota,
    )
    return assemble_function_group(
        _LOADED, handlers, instruction_override=""
    )
