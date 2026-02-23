# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Video generation function group for the agent loop.

Port of ``callVideoGen`` from ``video-generator/main.ts``. Uses the
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
from ..task_tree_manager import TaskTreeManager

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

_INSTRUCTION = f"""

## When to call "{GENERATE_VIDEO_FUNCTION}" function

Use this function to generate videos. It supports:
- Text-to-Video: Generate videos from text descriptions
- Image-to-Video: Animate a reference image with a text prompt
"""


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
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
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
            result = file_system.get(image_path)
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}
            if not result:
                return {"error": f'Empty file: "{image_path}"'}
            data_part = result[0]

            # 2. Convert to executeStep chunk
            try:
                chunk = await resolve_part_to_chunk(
                    data_part,
                    access_token=access_token,
                    upstream_base=upstream_base,
                    origin=origin,
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
        }

        # 4. Call executeStep
        try:
            result = await execute_step(
                body,
                access_token=access_token,
                upstream_base=upstream_base,
                origin=origin,
            )
        except ValueError as e:
            logger.error("generate_video executeStep error: %s", e)
            error_msg = str(e)
            expanded = expand_veo_error(error_msg, VIDEO_MODEL_NAME)
            return expanded

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
            "Generates a video based on a text prompt and optionally "
            "a reference image"
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
                        "Detailed prompt describing the video to generate. "
                        "Be descriptive — describe the scene, motion, "
                        "camera angles, and mood."
                    ),
                },
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional reference image file paths for "
                        "image-to-video generation."
                    ),
                },
                "aspect_ratio": {
                    "type": "string",
                    "enum": ASPECT_RATIOS,
                    "description": "The aspect ratio for the generated video.",
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
    access_token: str = "",
    upstream_base: str = "",
    origin: str = "",
) -> FunctionGroup:
    """Build a FunctionGroup with the generate_video function."""
    functions = [
        _define_generate_video(
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
