# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Video generation function group for the agent loop.

Port of ``generate_video`` from ``functions/generate.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Uses the
``executeStep`` API with the ``generate_video`` model API to generate
video via One Platform (Veo models).

The handler flow:
1. Resolve optional reference image paths from agent FS
2. Convert parts to executeStep chunks (inlineData / GCS paths)
3. Build ExecuteStepRequest with prompt + optional reference images
4. Call ``execute_step`` → One Platform
5. Save first output video to agent FS
6. Return file path
"""

from __future__ import annotations

import logging
import re
from typing import Any, Callable

from ..agent_file_system import AgentFileSystem
from ..function_definition import (
    FunctionDefinition,
    FunctionGroup,
    map_definitions,
)
from ..step_executor import (
    execute_step,
    resolve_part_to_chunk,
    encode_base64,
)
from ..backend_client import BackendClient
from ..error_classifier import to_error_or_response
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

GENERATE_VIDEO_FUNCTION = "generate_video"

STEP_NAME = "GenerateVideo"
OUTPUT_NAME = "generated_video"
API_NAME = "generate_video"

ASPECT_RATIOS = ["16:9", "9:16"]

VIDEO_MODEL_NAME = "veo-3.1-generate-preview"

_INSTRUCTION = ""


# ---------------------------------------------------------------------------
# Veo safety-code expansion
# ---------------------------------------------------------------------------

# Maps Veo support codes to semantic error reason categories.
# Port of ``SUPPORT_CODES`` + ``expandVeoError`` from video-generator/main.ts.
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
    """Expand a Veo error message with safety reason metadata.

    If the error contains known support codes, returns an enriched error
    dict with ``metadata.kind = "safety"`` and a list of ``reasons``.
    Otherwise returns a plain ``{error: message}`` dict.

    Port of ``expandVeoError`` from video-generator/main.ts.
    """
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
# generate_video function definition
# ---------------------------------------------------------------------------


def _define_generate_video(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionDefinition:
    """Port of ``callVideoGen`` from video-generator/main.ts."""

    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
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

        status_cb(status_update or "Generating Video")

        # Validate aspect ratio.
        if aspect_ratio not in ASPECT_RATIOS:
            aspect_ratio = "16:9"

        # 1. Resolve optional reference image paths from agent FS
        image_chunks: list[dict[str, Any]] = []
        for image_path in reference_images:
            result = await file_system.get(image_path)
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}
            if not result:
                return {"error": f'Empty file: "{image_path}"'}
            data_part = result[0]

            # 2. Convert to executeStep chunk
            try:
                chunk = await resolve_part_to_chunk(
                    data_part,
                    backend=backend,
                )
                image_chunks.append(chunk)
            except ValueError as e:
                return {"error": str(e)}

        # 3. Build ExecuteStepRequest
        execution_inputs: dict[str, Any] = {
            "text_instruction": {
                "chunks": [
                    {
                        "mimetype": "text/plain",
                        "data": encode_base64(prompt),
                    }
                ]
            },
            "aspect_ratio_key": {
                "chunks": [
                    {
                        "mimetype": "text/plain",
                        "data": encode_base64(aspect_ratio),
                    }
                ]
            },
        }

        input_parameters = ["text_instruction"]
        if image_chunks:
            execution_inputs["reference_image"] = {"chunks": image_chunks}
            input_parameters.append("reference_image")

        body = {
            "planStep": {
                "stepName": STEP_NAME,
                "modelApi": API_NAME,
                "inputParameters": input_parameters,
                "systemPrompt": "",
                "options": {
                    "modelName": VIDEO_MODEL_NAME,
                    "disablePromptRewrite": False,
                },
                "output": OUTPUT_NAME,
            },
            "execution_inputs": execution_inputs,
            **({"enableG1Quota": True} if enable_g1_quota else {}),
        }

        # 4. Call executeStep
        try:
            result = await execute_step(
                body,
                backend=backend,
            )
        except ValueError as e:
            logger.error("generate_video executeStep error: %s", e)
            error_msg = str(e)
            expanded = expand_veo_error(error_msg, VIDEO_MODEL_NAME)
            return to_error_or_response(expanded)

        status_cb(None)

        # 5. Save output video to agent FS
        # Veo produces one video — take the first chunk only.
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

    return FunctionDefinition(
        name=GENERATE_VIDEO_FUNCTION,
        description=(
            "Generating high-fidelity, 8-second videos featuring stunning "
            "realism and natively generated audio"
        ),
        handler=handler,
        icon="videocam_auto",
        title="Generating Video",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "The prompt to generate the video. "
                        "Good prompts are descriptive and clear. Start with "
                        "identifying your core idea, refine your idea by "
                        "adding keywords and modifiers, and incorporate "
                        "video-specific terminology into your prompts. "
                        "The following elements should be included in your "
                        "prompt: "
                        "Subject: The object, person, animal, or scenery "
                        "that you want in your video, such as cityscape, "
                        "nature, vehicles, or puppies. "
                        "Action: What the subject is doing (for example, "
                        "walking, running, or turning their head). "
                        "Style: Specify creative direction using specific "
                        "film style keywords, such as sci-fi, horror film, "
                        "film noir, or animated styles like cartoon. "
                        "Camera positioning and motion: [Optional] Control "
                        "the camera's location and movement using terms like "
                        "aerial view, eye-level, top-down shot, dolly shot, "
                        "or worms eye. "
                        "Composition: [Optional] How the shot is framed, "
                        "such as wide shot, close-up, single-shot or "
                        "two-shot. "
                        "Focus and lens effects: [Optional] Use terms like "
                        "shallow focus, deep focus, soft focus, macro lens, "
                        "and wide-angle lens to achieve specific visual "
                        "effects. "
                        "Ambiance: [Optional] How the color and light "
                        "contribute to the scene, such as blue tones, "
                        "night, or warm tones."
                    ),
                },
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "A list of input reference images, specified as "
                        "file paths. Use reference images only when you "
                        "need to start with a particular image."
                    ),
                },
                "aspect_ratio": {
                    "type": "string",
                    "enum": ASPECT_RATIOS,
                    "default": "16:9",
                    "description": "The aspect ratio of the video.",
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
                "video": {
                    "type": "string",
                    "description": "Generated video file path.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_video_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with the generate_video function."""
    functions = [
        _define_generate_video(
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
