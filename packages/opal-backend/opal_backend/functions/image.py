# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Image generation function group for the agent loop.

Port of ``generate_images`` from ``functions/generate.ts``. Uses the
``executeStep`` API with the ``ai_image_tool`` model API to generate
images via One Platform.

The handler flow:
1. Resolve input image paths from agent FS
2. Convert parts to executeStep chunks (inlineData / GCS paths)
3. Build ExecuteStepRequest with prompt + images
4. Call ``execute_step`` → One Platform
5. Save output images to agent FS
6. Return file paths
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
    resolve_part_to_chunk,
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

GENERATE_IMAGES_FUNCTION = "generate_images"

IMAGE_PRO_MODEL_NAME = "gemini-3-pro-image-preview"
IMAGE_FLASH_MODEL_NAME = "gemini-2.5-flash-image"

STEP_NAME = "AI Image Tool"
OUTPUT_NAME = "generated_image"
API_NAME = "ai_image_tool"

_INSTRUCTION = ""


# ---------------------------------------------------------------------------
# generate_images function definition
# ---------------------------------------------------------------------------


def _define_generate_images(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionDefinition:
    """Port of the ``generate_images`` function from generate.ts."""

    StatusUpdateCallback = Callable[[str | None], None]

    async def handler(
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

        status_cb(status_update or "Generating Image(s)")

        # 1. Resolve input image paths from agent FS
        image_chunks: list[dict[str, Any]] = []
        for image_path in input_images:
            result = file_system.get(image_path)
            if isinstance(result, dict) and "$error" in result:
                return {"error": result["$error"]}
            # result is a list of data parts
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
        model_name = (
            IMAGE_PRO_MODEL_NAME if model == "pro" else IMAGE_FLASH_MODEL_NAME
        )

        execution_inputs: dict[str, Any] = {
            "input_instruction": {
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

        input_parameters = ["input_instruction"]
        if image_chunks:
            execution_inputs["input_image"] = {"chunks": image_chunks}
            input_parameters.append("input_image")

        body = {
            "planStep": {
                "stepName": STEP_NAME,
                "modelApi": API_NAME,
                "inputParameters": input_parameters,
                "systemPrompt": "",
                "options": {
                    "modelName": model_name,
                    "disablePromptRewrite": True,
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
            logger.error("generate_images executeStep error: %s", e)
            return {"error": str(e)}

        status_cb(None)

        # 5. Save output images to agent FS
        output_chunks = result.get("chunks", [])
        if not output_chunks:
            return {"error": "No images were generated. Please try again"}

        errors: list[str] = []
        image_paths: list[str] = []

        for i, llm_content in enumerate(output_chunks):
            parts = llm_content.get("parts", [])
            for part in parts:
                name = file_name
                if name and len(output_chunks) > 1:
                    name = f"{name}_{i + 1}"
                result_path = file_system.add_part(part, name)
                if isinstance(result_path, dict) and "$error" in result_path:
                    errors.append(result_path["$error"])
                elif isinstance(result_path, str):
                    image_paths.append(result_path)

        if errors:
            return {"error": ", ".join(errors)}
        return {"images": image_paths}

    return FunctionDefinition(
        name=GENERATE_IMAGES_FUNCTION,
        description=(
            "Generates one or more images based on a prompt and optionally, "
            "one or more images"
        ),
        handler=handler,
        icon="photo_spark",
        title="Generating Image(s)",
        parameters_json_schema={
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed prompt to use for image generation. "
                        "This model can generate multiple images from a "
                        "single prompt. Especially when looking for "
                        "consistency across images (for instance, when "
                        "generating video keyframes), this is a very useful "
                        "capability. Be specific about how many images to "
                        "generate. "
                        "When composing the prompt, be as descriptive as "
                        "possible. Describe the scene, don't just list "
                        "keywords. The model's core strength is its deep "
                        "language understanding. A narrative, descriptive "
                        "paragraph will almost always produce a better, more "
                        "coherent image than a list of disconnected words. "
                        "This function allows you to use multiple input "
                        "images to compose a new scene or transfer the style "
                        "from one image to another. "
                        "Here are some possible applications: "
                        "Text-to-Image: Generate high-quality images from "
                        "simple or complex text descriptions. Provide a text "
                        "prompt and no images as input. "
                        "Image + Text-to-Image (Editing): Provide an image "
                        "and use the text prompt to add, remove, or modify "
                        "elements, change the style, or adjust the color "
                        "grading. "
                        "Multi-Image to Image (Composition & style transfer): "
                        "Use multiple input images to compose a new scene or "
                        "transfer the style from one image to another. "
                        "High-Fidelity text rendering: Accurately generate "
                        "images that contain legible and well-placed text, "
                        "ideal for logos, diagrams, and posters."
                    ),
                },
                "model": {
                    "type": "string",
                    "enum": ["pro", "flash"],
                    "default": "flash",
                    "description": (
                        "The Gemini model to use for image generation. "
                        "How to choose the right model: "
                        'choose "pro" to accurately generate images that '
                        "contain legible and well-placed text, ideal for "
                        "logos, diagrams, and posters. This model is designed "
                        "for professional asset production and complex "
                        "instructions. "
                        'Choose "flash" for speed and efficiency. This model '
                        "is optimized for high-volume, low-latency tasks."
                    ),
                },
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "A list of input images, specified as file paths."
                    ),
                },
                "aspect_ratio": {
                    "type": "string",
                    "enum": ["1:1", "9:16", "16:9", "4:3", "3:4"],
                    "description": "The aspect ratio for generated images.",
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
                "images": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Generated image file paths.",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_image_function_group(
    *,
    file_system: AgentFileSystem,
    task_tree_manager: TaskTreeManager | None = None,
    backend: BackendClient | None = None,
    enable_g1_quota: bool = False,
) -> FunctionGroup:
    """Build a FunctionGroup with the generate_images function."""
    functions = [
        _define_generate_images(
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
