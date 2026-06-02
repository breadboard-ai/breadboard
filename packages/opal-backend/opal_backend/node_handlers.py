# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Node handlers — per-node-type execution logic.

Each handler receives inputs, config, and optional dependencies;
returns either outputs (complete) or raises ``NodeSuspended`` to
signal that the node needs user input.

Only stdlib + typing — no external deps (synced to production).

Handler types by phase:
- ``output_handler`` — mode-aware output (output/render-outputs nodes)
- ``text_gen_handler`` — direct Gemini text generation
- ``media_gen_handler`` — executeStep-based media generation
  (image, audio, video, music)
- ``agent_handler`` — full agent loop via ``run_agent()``
"""

from __future__ import annotations

import base64
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable, Coroutine

from .backend_client import BackendClient
from .conform_body import conform_body
from .events import SUSPEND_TYPES, AgentEvent
from .step_executor import execute_step, resolve_part_to_chunk, encode_base64

__all__ = [
    "NodeSuspended",
    "consume_agent_events",
    "dispatch_handler",
    "output_handler",
    "text_gen_handler",
    "media_gen_handler",
    "input_handler",
    "agent_handler",
]

logger = logging.getLogger(__name__)

# Default model — same as AGENT_MODEL in loop.py.
DEFAULT_MODEL = "gemini-3-flash-preview"

# Default system instruction for text generation — port of
# defaultSystemInstruction() from system-instruction.ts.
_DEFAULT_SYSTEM_INSTRUCTION = (
    "You are working as part of an AI system, so no chit-chat "
    "and no explaining what you're doing and why.\n"
    'DO NOT start with "Okay", or "Alright" or any preambles. '
    "Just the output, please."
)

@dataclass
class NodeSuspended(Exception):
    """Raised by a handler when the node needs user input.

    The graph runner catches this and calls
    ``GraphSessionStore.suspend_node()``.
    """

    interaction_id: str
    context: dict[str, Any] = field(default_factory=dict)
    suspend_event: dict[str, Any] = field(default_factory=dict)


@dataclass
class NodeHandlerDeps:
    """Dependencies injected into handlers that need external services.

    Optional — passthrough and stub handlers don't need these.
    ``GraphRunner`` populates this from its own injected deps.
    """

    # Called for each agent event during agent node execution.
    # Signature: (event_dict) -> None
    on_agent_event: Callable[
        [dict[str, Any]], Coroutine[Any, Any, None],
    ] | None = None

    # Called for each thought event during webpage generation.
    # Signature: (text) -> None
    on_thought_event: Callable[
        [str], Awaitable[None]
    ] | None = None

    # Agent runner — async iterator factory.
    # Returns an async iterator of AgentEvent.
    run_agent_fn: Callable[..., AsyncIterator[AgentEvent]] | None = None

    # For building agent run kwargs.
    backend: Any = None
    interaction_store: Any = None
    graph_info: dict[str, Any] | None = None

    # Graph-level assets — {path: {data: LLMContent[], metadata: ...}}.
    # Used by template substitution to resolve asset references.
    assets: dict[str, Any] | None = None


def _extract_text_from_content(content: dict[str, Any]) -> str:
    """Extract plain text from an LLMContent dict."""
    parts = content.get("parts", [])
    texts = []
    for part in parts:
        if isinstance(part, dict) and "text" in part:
            texts.append(part["text"])
    return "\n".join(texts)

# ---------------------------------------------------------------------------
# Config normalization helpers
# ---------------------------------------------------------------------------

# Explicit map of known Breadboard embed URLs to canonical node types.
# The URL structure isn't guaranteed to be semantic, so we map each one
# explicitly rather than parsing the path.
_EMBED_URL_MAP: dict[str, str] = {
    "embed://a2/generate.bgl.json#module:main": "generate",
    "embed://a2/generate-text.bgl.json#daf082ca-c1aa-4aff-b2c8-abeb984ab66c": "generate",
    "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c": "input",
    "embed://a2/ask-user.bgl.json#module:main": "input",
    "embed://a2/a2.bgl.json#module:render-outputs": "output",
    # Media generators — generate nodes with specialized output types.
    "embed://a2/a2.bgl.json#module:image-generator": "generate",
    "embed://a2/a2.bgl.json#module:image-editor": "generate",
    "embed://a2/audio-generator.bgl.json#module:main": "generate",
    "embed://a2/video-generator.bgl.json#module:main": "generate",
    "embed://a2/music-generator.bgl.json#module:main": "generate",
    # Compound nodes — run as subgraphs.
    "embed://a2/go-over-list.bgl.json#module:main": "generate",
    "embed://a2/deep-research.bgl.json#module:main": "generate",
}


def _effective_node_type(raw_type: str) -> str:
    """Map a raw node type to a canonical handler type.

    Real Breadboard graphs use embed URLs like
    ``embed://a2/generate.bgl.json#module:main``.  Subgraph nodes
    start with ``#``.  Simple types like ``"generate"`` pass through.
    """
    # Subgraph nodes.
    if raw_type.startswith("#"):
        return "subgraph"

    # Explicit URL lookup.
    if raw_type in _EMBED_URL_MAP:
        return _EMBED_URL_MAP[raw_type]

    return raw_type


def _get_mode(config: dict[str, Any]) -> str:
    """Read the generation mode from config.

    Real Breadboard uses ``generation-mode``; simplified test format
    uses ``mode``.
    """
    return config.get("generation-mode", config.get("mode", "text"))


def _get_model(config: dict[str, Any]) -> str:
    """Read the Gemini model name from config.

    Real Breadboard stores the model in ``model``; falls back to
    ``DEFAULT_MODEL``.
    """
    return config.get("model", DEFAULT_MODEL)


def _get_system_instruction(config: dict[str, Any]) -> str:
    """Extract system instruction text from config.

    Handles both:
    - Simple string: ``{"systemInstruction": "Do X"}``
    - LLMContent: ``{"b-system-instruction": {"parts": [{"text": "..."}]}}``

    When no system instruction is present, falls back to the default
    from ``system-instruction.ts#defaultSystemInstruction()``.

    Always prepends the current date, matching
    ``system-instruction.ts#createSystemInstruction()``.
    """
    instruction = ""

    # Simple string format.
    simple = config.get("systemInstruction")
    if isinstance(simple, str):
        instruction = simple

    # Real Breadboard LLMContent format.
    if not instruction:
        llm_content = config.get("b-system-instruction")
        if isinstance(llm_content, dict):
            instruction = _extract_text_from_content(llm_content)

    # Default — port of defaultSystemInstruction() from system-instruction.ts.
    if not instruction:
        instruction = _DEFAULT_SYSTEM_INSTRUCTION

    # Prepend date — port of createSystemInstruction() from
    # system-instruction.ts.
    from datetime import datetime
    now = datetime.now()
    date_str = now.strftime("%B %-d, %Y, %-I:%M %p")
    return f"\nToday is {date_str}\n    \n{instruction}"


def _get_prompt(config: dict[str, Any]) -> str:
    """Extract the initial prompt text from config.

    Real Breadboard uses ``config$prompt`` (LLMContent format).
    """
    prompt = config.get("config$prompt")
    if isinstance(prompt, dict):
        return _extract_text_from_content(prompt)
    if isinstance(prompt, str):
        return prompt
    return ""


async def dispatch_handler(
    node_type: str,
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None = None,
) -> dict[str, Any]:
    """Dispatch to the appropriate handler based on node type.

    Returns node outputs. May raise ``NodeSuspended`` if the node
    needs user input.
    """
    # Normalize node type — real Breadboard embeds use URLs like
    # "embed://a2/generate.bgl.json#module:main".
    effective_type = _effective_node_type(node_type)

    match effective_type:
        case "output" | "render-outputs":
            return await output_handler(inputs, config, deps)
        case "input":
            return await input_handler(inputs, config)
        case "generate":
            mode = _get_mode(config)
            if mode == "agent" and deps and deps.run_agent_fn:
                return await agent_handler(inputs, config, deps)
            if mode in MEDIA_MODES:
                return await media_gen_handler(
                    inputs, config, deps, MEDIA_MODES[mode],
                )
            return await text_gen_handler(inputs, config, deps)
        case _:
            # Default passthrough for unknown types.
            return _passthrough(inputs)


def _passthrough(inputs: dict[str, list[Any]]) -> dict[str, Any]:
    """Simple passthrough — returns inputs as outputs (legacy behavior).

    Flattens multi-value input ports: if a port has a single value,
    unwrap it.
    """
    outputs: dict[str, Any] = {}
    for port, values in inputs.items():
        if len(values) == 1:
            outputs[port] = values[0]
        else:
            outputs[port] = values
    return outputs


async def output_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None = None,
) -> dict[str, Any]:
    """Handle output / render-outputs nodes with mode dispatch.

    Reads ``p-render-mode`` from config and dispatches to the
    appropriate handler. Modes:

    * ``"Manual layout"`` (default) — passthrough with template substitution.
    * ``"Auto"`` / ``"consistent-ui"`` — HTML auto-layout via AppCatalyst
      ``generateWebpageStream``.
    * ``"google-doc"`` — save to Google Docs (TODO).
    * ``"google-sheets"`` — save to Google Sheets (TODO).
    * ``"google-slides"`` — save to Google Slides (TODO).
    """
    mode = config.get("p-render-mode", "Manual layout")

    if mode in ("Auto", "consistent-ui"):
        return await _html_auto_layout_handler(inputs, config, deps)
    elif mode == "google-doc":
        # TODO(Phase 9): Implement Google Docs handler.
        return _manual_output_handler(inputs, config, deps)
    elif mode == "google-sheets":
        # TODO(Phase 9): Implement Google Sheets handler.
        return _manual_output_handler(inputs, config, deps)
    elif mode == "google-slides":
        # TODO(Phase 9): Implement Google Slides handler.
        return _manual_output_handler(inputs, config, deps)
    else:
        # "Manual layout" or unknown — passthrough.
        return _manual_output_handler(inputs, config, deps)


def _manual_output_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None = None,
) -> dict[str, Any]:
    """Manual output mode — passthrough with template substitution.

    The ``text`` template (with ``{{type: "in", ...}}`` placeholders)
    lives in ``config`` — it's part of the node configuration, not an
    edge-connected input.  ``inputs`` only contains the upstream port
    values (``p-z-*``).
    """
    # The text template is a config value, not an edge input.
    text_config = config.get("text")
    if text_config is None:
        # Fall back to old passthrough behavior for backward compat.
        return _passthrough(inputs)

    # Extract the raw text from the config value (may be LLMContent dict).
    if isinstance(text_config, str):
        raw_text = text_config
    elif isinstance(text_config, dict):
        raw_text = _extract_text_from_content(text_config)
    else:
        return _passthrough(inputs)

    # Apply template substitution using edge inputs as params.
    assets = deps.assets if deps else None
    substituted = _substitute_template(raw_text, inputs, assets)
    return {"context": substituted}


async def _html_auto_layout_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None = None,
) -> dict[str, Any]:
    """HTML auto-layout via AppCatalyst ``generateWebpageStream``.

    Builds a request body matching the TS ``buildStreamingRequestBody()``
    and streams the response. Thought chunks are forwarded via
    ``deps.on_thought_event`` for frontend progress display.

    The ``text`` template lives in ``config`` (node configuration), not
    in ``inputs`` (edge-connected ports).  We first substitute the
    template to get concrete text, then build the webpage request body.
    """
    # The text template is a config value, not an edge input.
    text_config = config.get("text")
    if text_config is None:
        return _manual_output_handler(inputs, config, deps)

    # Extract raw text and run template substitution.
    if isinstance(text_config, str):
        raw_text = text_config
    elif isinstance(text_config, dict):
        raw_text = _extract_text_from_content(text_config)
    else:
        return _manual_output_handler(inputs, config, deps)

    assets = deps.assets if deps else None

    # Use multimodal-aware substitution that preserves storedData /
    # inlineData parts from inputs (e.g. images), matching the TS
    # Template.substitute() behavior.
    parts = _substitute_template_parts(raw_text, inputs, assets)

    # Wrap as LLMContent for the request body.
    content: list[dict[str, Any]] = [
        {"role": "user", "parts": parts}
    ]

    # Extract system instruction for the request.
    si = config.get("b-system-instruction", "")
    if isinstance(si, list) and si:
        # System instruction may be LLMContent — extract text.
        si_parts = si[0].get("parts", []) if isinstance(si[0], dict) else []
        si = " ".join(p.get("text", "") for p in si_parts if "text" in p)
    elif isinstance(si, dict):
        si = _extract_text_from_content(si)
    elif not isinstance(si, str):
        si = ""

    body = _build_webpage_request_body(content, si)

    if not deps or not deps.backend:
        # No backend — fall back to manual mode.
        return _manual_output_handler(inputs, config, deps)

    # Stream from AppCatalyst generateWebpageStream.
    html_result = ""
    async for chunk in deps.backend.stream_generate_webpage(body):
        for part in chunk.get("parts", []):
            chunk_type = part.get("partMetadata", {}).get("chunk_type")
            if chunk_type == "thought" and deps.on_thought_event:
                await deps.on_thought_event(part.get("text", ""))
            elif chunk_type == "html":
                html_result = part.get("text", "")
            elif chunk_type == "error":
                raise ValueError(
                    part.get("text", "Webpage generation failed")
                )

    if not html_result:
        # Fallback: return raw content via manual mode.
        return _manual_output_handler(inputs, config, deps)

    # Return as inlineData text/html (matching TS toLLMContentInline).
    encoded = base64.b64encode(html_result.encode()).decode()
    return {
        "context": [
            {
                "role": "model",
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "text/html",
                            "data": encoded,
                        }
                    }
                ],
            }
        ]
    }


def _build_webpage_request_body(
    content: list[dict[str, Any]], user_instruction: str,
) -> dict[str, Any]:
    """Build generateWebpageStream request body.

    Ports ``buildStreamingRequestBody`` from
    ``visual-editor/src/a2/a2/generate-webpage-stream.ts``.
    """
    contents: list[dict[str, Any]] = []
    text_count = 0
    media_count = 0

    for item in content:
        if not isinstance(item, dict):
            continue
        for part in item.get("parts", []):
            if "text" in part:
                text_count += 1
                contents.append({
                    "parts": [{
                        "text": part["text"],
                        "partMetadata": {"input_name": f"text_{text_count}"},
                    }],
                    "role": "user",
                })
            elif "inlineData" in part:
                media_count += 1
                contents.append({
                    "parts": [{
                        "inlineData": {
                            "mimeType": part["inlineData"]["mimeType"],
                            "data": part["inlineData"]["data"],
                        },
                        "partMetadata": {"input_name": f"media_{media_count}"},
                    }],
                    "role": "user",
                })
            elif "storedData" in part:
                media_count += 1
                handle = part["storedData"].get("handle", "")
                mime_type = part["storedData"].get("mimeType", "")
                file_uri = _parse_stored_data_url(handle)
                contents.append({
                    "parts": [{
                        "fileData": {
                            "mimeType": mime_type,
                            "fileUri": file_uri,
                        },
                        "partMetadata": {"input_name": f"media_{media_count}"},
                    }],
                    "role": "user",
                })

    return {
        "intent": "",
        "userInstruction": user_instruction,
        "contents": contents,
    }


def _parse_stored_data_url(handle: str) -> str:
    """Parse a stored data URL into the appropriate fileUri format.

    Ports ``parseStoredDataUrl`` from ``generate-webpage-stream.ts``.
    """
    # Handle drive:/ prefix.
    if handle.startswith("drive:/"):
        drive_id = re.sub(r"^drive:/+", "", handle)
        return f"drive://{drive_id}"

    # Handle Google Drive preview URLs.
    drive_match = re.search(
        r"https?://drive\.google\.com/file/d/([^/]+)", handle,
    )
    if drive_match:
        return f"drive://{drive_match.group(1)}"

    # Handle blob URLs.
    blob_match = re.search(r"/board/blobs/([^/?#]+)", handle)
    if blob_match:
        return f"gs://{blob_match.group(1)}"

    return handle


# Maps input node modality config → format icon for the frontend.
# Mirrors ICONS in packages/visual-editor/src/a2/ask-user/main.ts.
_MODALITY_ICONS: dict[str, str] = {
    "Any": "asterisk",
    "Audio": "mic",
    "Video": "videocam",
    "Image": "image",
    "Upload File": "upload",
    "Text": "edit_note",
}


def _extract_title(description: Any) -> str:
    """Extract plain text from an LLMContent description value.

    Returns empty string if no meaningful text is found — the
    frontend falls back to the node's metadata title.
    """
    if isinstance(description, dict):
        parts = description.get("parts", [])
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        if texts:
            result = " ".join(t for t in texts if t)
            if result:
                return result
    if isinstance(description, str) and description:
        return description
    return ""


def _build_input_schema(config: dict[str, Any]) -> dict[str, Any]:
    """Build the UI input schema from node config.

    Mirrors ``createInputSchema()`` in the TypeScript ask-user module.
    """
    title = _extract_title(config.get("description"))
    modality = config.get("p-modality")
    required = config.get("p-required", False)

    behavior = ["transient", "llm-content"]
    if required:
        behavior.append("hint-required")

    icon = _MODALITY_ICONS.get(modality or "", "asterisk")

    return {
        "type": "object",
        "properties": {
            "request": {
                "type": "object",
                "title": title,
                "behavior": behavior,
                "examples": [
                    '{"parts":[{"text":""}],"role":"user"}',
                ],
                "format": icon,
            },
        },
    }


async def input_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Suspend the node to request user input.

    Raises ``NodeSuspended`` with a schema built from the node's
    configuration (description, modality, required). The frontend
    uses this schema to render the appropriate input form. The
    resume endpoint later provides the user's input as the node
    output.
    """
    interaction_id = str(uuid.uuid4())

    schema = _build_input_schema(config)

    raise NodeSuspended(
        interaction_id=interaction_id,
        context={"inputs": inputs, "config": config},
        suspend_event={
            "inputNode": {
                "schema": schema,
            },
        },
    )

async def text_gen_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None = None,
) -> dict[str, Any]:
    """Text generation handler.

    Builds a Gemini request body from inputs and config, resolves
    data parts via ``conform_body()``, then streams the response
    via ``BackendClient.stream_generate_content()``.

    Falls back to a stub response if no backend is available
    (e.g. in unit tests).
    """
    # Build segments the same way as agent mode.
    assets = deps.assets if deps else None
    segments = _build_segments_from_inputs(inputs, config, assets)

    # Assemble a minimal Gemini body.
    contents: list[dict[str, Any]] = []
    for seg in segments:
        if seg.get("type") == "text" and seg.get("text"):
            contents.append({
                "role": "user",
                "parts": [{"text": seg["text"]}],
            })
        elif seg.get("type") == "asset" and seg.get("content"):
            contents.append(seg["content"])

    if not contents:
        return {
            "context": [
                {"role": "model", "parts": [{"text": ""}]},
            ],
        }

    body: dict[str, Any] = {"contents": contents}

    # System instruction from config.
    system_instruction = _get_system_instruction(config)
    if system_instruction:
        body["systemInstruction"] = {
            "parts": [{"text": system_instruction}],
            "role": "user",
        }

    # Resolve storedData/fileData/json parts.
    backend = deps.backend if deps else None
    if backend:
        try:
            body = await conform_body(body, backend=backend)
        except Exception as exc:
            logger.error("text_gen_handler conform_body error: %s", exc)
            # Continue with untransformed body — may fail at API level.

        # Stream from Gemini.
        model = _get_model(config)
        result_text = ""
        async for chunk in backend.stream_generate_content(model, body):
            # Accumulate text from streaming chunks.
            candidates = chunk.get("candidates", [])
            for candidate in candidates:
                content = candidate.get("content", {})
                for part in content.get("parts", []):
                    if "text" in part:
                        result_text += part["text"]

        return {
            "context": [
                {"role": "model", "parts": [{"text": result_text}]},
            ],
        }

    # No backend — stub response (unit tests).
    return {
        "context": [
            {
                "role": "model",
                "parts": [{"text": "[generated response]"}],
            }
        ],
    }


# ---------------------------------------------------------------------------
# Media generation modes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MediaModeConfig:
    """Per-mode config for executeStep-based media generation.

    Each media mode (image, audio, video, music) calls the same
    backend executeStep API with different parameters.
    """

    model_api: str
    step_name: str
    output_key: str
    prompt_input_key: str


# Mode registry — maps mode ID to executeStep config.
# Mirrors the ALL_MODES entries in generate/main.ts.
MEDIA_MODES: dict[str, MediaModeConfig] = {
    "image": MediaModeConfig(
        model_api="ai_image_tool",
        step_name="EditImage",
        output_key="edited_image",
        prompt_input_key="input_instruction",
    ),
    "image-pro": MediaModeConfig(
        model_api="ai_image_tool",
        step_name="EditImage",
        output_key="edited_image",
        prompt_input_key="input_instruction",
    ),
    "audio": MediaModeConfig(
        model_api="tts",
        step_name="GenerateAudio",
        output_key="generated_speech",
        prompt_input_key="text_to_speak",
    ),
    "video": MediaModeConfig(
        model_api="generate_video",
        step_name="GenerateVideo",
        output_key="generated_video",
        prompt_input_key="text_instruction",
    ),
    "music": MediaModeConfig(
        model_api="generate_music",
        step_name="GenerateMusic",
        output_key="generated_music",
        prompt_input_key="prompt",
    ),
}


async def media_gen_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps | None,
    mode_config: MediaModeConfig,
) -> dict[str, Any]:
    """Media generation handler (image, audio, video, music).

    All media modes go through the One Platform ``/v1beta1/executeStep``
    API with mode-specific ``planStep`` parameters.

    Port of ``image-editor.ts``, ``audio-generator/main.ts``,
    ``video-generator/main.ts``, and ``music-generator/main.ts`` —
    all of which funnel into ``step-executor.ts``.
    """
    # Build the text prompt from template substitution + upstream context.
    # Note: we use _build_segments_from_inputs for template substitution
    # and context extraction, but SKIP system instruction segments.
    # The TS media generators don't include system instruction — it's only
    # for Gemini text/agent modes. Including it causes TTS failures
    # ("Model tried to generate text, but it should only be used for TTS").
    assets = deps.assets if deps else None
    segments = _build_segments_from_inputs(inputs, config, assets)

    # Filter: skip the first segment if it's the system instruction.
    # _build_segments_from_inputs prepends system instruction as the first
    # text segment when present in config.
    system_instruction = _get_system_instruction(config)
    prompt_parts = []
    for seg in segments:
        if seg.get("type") == "text" and seg.get("text"):
            # Skip system instruction (exact match with first segment).
            if seg["text"] == system_instruction:
                system_instruction = None  # Only skip once.
                continue
            prompt_parts.append(seg["text"])
    prompt = "\n\n".join(prompt_parts).strip()

    if not prompt:
        return {
            "context": [
                {"role": "model", "parts": [{"text": ""}]},
            ],
        }

    # Build execution_inputs.
    execution_inputs: dict[str, Any] = {
        mode_config.prompt_input_key: {
            "chunks": [{
                "mimetype": "text/plain",
                "data": encode_base64(prompt),
            }],
        },
    }

    input_parameters = [mode_config.prompt_input_key]

    # Image/video modes: collect reference images from upstream context
    # and asset segments for i2i/i2v support.
    if mode_config.model_api in ("ai_image_tool", "generate_video"):
        image_chunks = await _collect_reference_image_chunks(
            inputs, segments, deps,
        )
        if image_chunks:
            ref_key = (
                "input_image"
                if mode_config.model_api == "ai_image_tool"
                else "reference_image"
            )
            execution_inputs[ref_key] = {"chunks": image_chunks}
            input_parameters.append(ref_key)

        # Aspect ratio (image and video).
        aspect_ratio = config.get("p-aspect-ratio", "1:1")
        execution_inputs["aspect_ratio_key"] = {
            "chunks": [{
                "mimetype": "text/plain",
                "data": encode_base64(aspect_ratio),
            }],
        }

    # Audio mode: voice selection.
    if mode_config.model_api == "tts":
        voice = config.get("voice", "en-US-female")
        execution_inputs["voice_key"] = {
            "chunks": [{
                "mimetype": "text/plain",
                "data": encode_base64(voice),
            }],
        }

    # Build executeStep request body.
    model_name = config.get("p-model-name", config.get("model", ""))
    body: dict[str, Any] = {
        "planStep": {
            "stepName": mode_config.step_name,
            "modelApi": mode_config.model_api,
            "inputParameters": input_parameters,
            "systemPrompt": "",
            "output": mode_config.output_key,
        },
        "execution_inputs": execution_inputs,
    }
    if model_name:
        body["planStep"]["options"] = {"modelName": model_name}

    backend = deps.backend if deps else None
    if not backend:
        # No backend — stub response (unit tests).
        return {
            "context": [
                {"role": "model", "parts": [{"text": "[generated media]"}]},
            ],
        }

    result = await execute_step(body, backend=backend)
    # result is {chunks: [LLMContent, ...], requestedModel?, executedModel?}
    chunks = result.get("chunks", [])
    if not chunks:
        return {
            "context": [
                {"role": "model", "parts": [{"text": ""}]},
            ],
        }

    return {"context": chunks}


async def _collect_reference_image_chunks(
    inputs: dict[str, list[Any]],
    segments: list[dict[str, Any]],
    deps: NodeHandlerDeps | None,
) -> list[dict[str, Any]]:
    """Collect reference image chunks for i2i/i2v modes.

    Extracts inline image data and storedData references from upstream
    context and asset segments. Mirrors ``extractMediaData`` +
    ``driveFileToBlob`` + ``toGcsAwareChunk`` from image-utils.ts.
    """
    backend = deps.backend if deps else None
    chunks: list[dict[str, Any]] = []

    # Collect from upstream input context.
    for values in inputs.values():
        for value in values:
            items = value if isinstance(value, list) else [value]
            for item in items:
                if not isinstance(item, dict):
                    continue
                for part in item.get("parts", []):
                    chunk = await _part_to_image_chunk(part, backend)
                    if chunk:
                        chunks.append(chunk)

    # Collect from asset segments.
    for seg in segments:
        if seg.get("type") != "asset" or not seg.get("content"):
            continue
        content = seg["content"]
        for part in content.get("parts", []):
            chunk = await _part_to_image_chunk(part, backend)
            if chunk:
                chunks.append(chunk)

    return chunks


async def _part_to_image_chunk(
    part: dict[str, Any],
    backend: BackendClient | None,
) -> dict[str, Any] | None:
    """Convert a single LLMContent part to an executeStep image chunk.

    Returns None for non-image parts (text, etc.).
    """
    if "inlineData" in part:
        inline = part["inlineData"]
        mime = inline.get("mimeType", "")
        if mime.startswith("image/"):
            return {
                "mimetype": mime,
                "data": inline.get("data", ""),
            }
        return None

    if "storedData" in part and backend:
        try:
            return await resolve_part_to_chunk(part, backend=backend)
        except Exception as exc:
            logger.warning("Failed to resolve storedData for media: %s", exc)
            return None

    return None


async def agent_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    deps: NodeHandlerDeps,
) -> dict[str, Any]:
    """Run the agent loop for a generate node in agent mode.

    Streams ``AgentEvent`` objects from ``run_agent()``, forwarding
    each one via ``deps.on_agent_event()`` wrapped with the node ID.
    If the agent yields a suspend event (waitForInput, etc.), raises
    ``NodeSuspended`` so the graph runner can save state.

    On completion, extracts the agent's final output.
    """
    if not deps.run_agent_fn:
        raise RuntimeError("agent_handler requires run_agent_fn in deps")

    # Build segments from inputs.
    segments = _build_segments_from_inputs(inputs, config, deps.assets)

    agent_iter = deps.run_agent_fn(
        segments=segments,
        backend=deps.backend,
        store=deps.interaction_store,
        graph=deps.graph_info or {},
    )

    return await consume_agent_events(
        agent_iter, deps, suspend_context={"segments": segments},
    )


async def consume_agent_events(
    agent_iter: AsyncIterator[AgentEvent],
    deps: NodeHandlerDeps,
    suspend_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Consume an agent event iterator, forwarding events and collecting output.

    Shared by ``agent_handler`` (initial run) and ``GraphRunner.resume_node``
    (resumed run). Both iterate the same event stream and need the same
    forward/suspend/accumulate logic.

    Returns node outputs on completion. Raises ``NodeSuspended`` if
    the agent needs more input.
    """
    result_content: list[dict[str, Any]] = []

    async for event in agent_iter:
        event_dict = event.to_dict()

        # Forward to SSE stream.
        if deps.on_agent_event:
            await deps.on_agent_event(event_dict)

        # Check for suspend events.
        if event.type in SUSPEND_TYPES:
            interaction_id = getattr(event, "interaction_id", None)
            if not interaction_id:
                interaction_id = str(uuid.uuid4())
            raise NodeSuspended(
                interaction_id=interaction_id,
                context=suspend_context or {},
                suspend_event=event_dict,
            )

        # Accumulate content events for final output.
        if event.type == "content":
            content = getattr(event, "content", None)
            if content:
                result_content.append(content)

    if result_content:
        return {"context": result_content}

    return {"context": []}


def _build_segments_from_inputs(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
    assets: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Build agent segments from node inputs and config.

    Converts upstream outputs into the ``segments`` format that
    ``run_agent()`` → ``to_pidgin()`` expects.

    Wire format (flat):  ``{"type": "text", "text": "hello"}``
    """
    segments: list[dict[str, Any]] = []

    # System instruction from config (supports both simple string
    # and real Breadboard LLMContent format).
    system_instruction = _get_system_instruction(config)
    if system_instruction:
        segments.append({"type": "text", "text": system_instruction})

    # Initial prompt from config (real Breadboard config$prompt).
    prompt = _get_prompt(config)
    if prompt:
        # Substitute template placeholders with upstream input values
        # and text-based assets.
        prompt = _substitute_template(prompt, inputs, assets)
        segments.append({"type": "text", "text": prompt})

        # Collect multimodal asset segments (images, PDFs, etc.).
        # These are resolved from template placeholders with
        # {"type": "asset"} — text substitution returns the text
        # part, but binary parts need to be sent as separate
        # asset segments for `to_pidgin()` to handle.
        asset_segments = _collect_asset_segments(prompt, config, assets)
        segments.extend(asset_segments)

    # Input context from upstream nodes — extract text from LLMContent.
    # Only include ports that were NOT consumed by template substitution.
    consumed_ports = _template_consumed_ports(config)
    for port, values in inputs.items():
        if port in consumed_ports:
            continue
        for value in values:
            if isinstance(value, list):
                # List of LLMContent dicts.
                for item in value:
                    if isinstance(item, dict):
                        text = _extract_text_from_content(item)
                        if text:
                            segments.append({"type": "text", "text": text})
            elif isinstance(value, dict):
                text = _extract_text_from_content(value)
                if text:
                    segments.append({"type": "text", "text": text})
            elif isinstance(value, str):
                segments.append({"type": "text", "text": value})

    return segments


# ---------------------------------------------------------------------------
# Asset resolution — port of Template.loadAsset() from template.ts
# ---------------------------------------------------------------------------


def _get_last_non_metadata(content_list: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the last LLMContent item whose role is not 'metadata'.

    Mirrors ``#getLastNonMetadata()`` in template.ts.
    """
    for item in reversed(content_list):
        if isinstance(item, dict) and item.get("role") != "$metadata":
            return item
    return None


def _resolve_asset_text(
    param: dict[str, Any],
    assets: dict[str, Any] | None,
) -> str:
    """Resolve an asset placeholder to its text content.

    For text assets, returns the extracted text. For binary assets
    (images, PDFs), returns empty string — the binary parts are
    handled separately by ``_collect_asset_segments()``.

    Mirrors ``Template.loadAsset()`` + the text extraction in
    ``Template.substitute()`` from template.ts.
    """
    if not assets:
        return param.get("title", "")

    path = param.get("path", "")
    asset = assets.get(path)
    if not asset or not asset.get("data"):
        return param.get("title", "")

    data = asset["data"]
    if not isinstance(data, list):
        return param.get("title", "")

    last = _get_last_non_metadata(data)
    if not last:
        return param.get("title", "")

    return _extract_text_from_content(last)


def _collect_asset_segments(
    raw_prompt: str,
    config: dict[str, Any],
    assets: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Collect asset segments for multimodal content in the prompt.

    Scans the original (pre-substitution) prompt for ``"asset"``
    placeholders and builds structured ``assetSegment`` objects for
    any assets that contain non-text parts (inlineData, storedData).
    These segments are consumed by ``to_pidgin()`` which already
    knows how to handle ``"asset"`` type segments.

    Text-only assets are already handled by ``_substitute_template``
    and don't need separate segments.
    """
    if not assets:
        return []

    # Re-scan the raw prompt text from config for asset references.
    # We use the original config$prompt (pre-substitution) because
    # _substitute_template has already replaced the placeholders.
    raw_text = _get_prompt(config)
    if not raw_text:
        return []

    segments: list[dict[str, Any]] = []
    for m in _TEMPLATE_RE.finditer(raw_text):
        try:
            param = json.loads(m.group(1))
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(param, dict) or param.get("type") != "asset":
            continue

        path = param.get("path", "")
        asset = assets.get(path)
        if not asset or not asset.get("data"):
            continue

        data = asset["data"]
        if not isinstance(data, list):
            continue

        last = _get_last_non_metadata(data)
        if not last:
            continue

        # Check if this asset has any non-text parts (binary data).
        parts = last.get("parts", [])
        has_binary = any(
            isinstance(p, dict) and ("inlineData" in p or "storedData" in p)
            for p in parts
        )
        if has_binary:
            title = param.get("title", "asset")
            segments.append({
                "type": "asset",
                "title": title,
                "content": last,
            })

    return segments


# ---------------------------------------------------------------------------
# Template substitution — port of Template.substitute() from template.ts
# ---------------------------------------------------------------------------

# Matches {{...}} where the inner {...} is JSON.
# Mirrors PARSING_REGEX in template.ts:
#   /{(?<json>{(?:.*?)})}/gim
_TEMPLATE_RE = re.compile(r"\{(\{(?:.*?)\})\}", re.IGNORECASE | re.DOTALL)


def _substitute_template(
    text: str,
    inputs: dict[str, list[Any]],
    assets: dict[str, Any] | None = None,
) -> str:
    """Replace template placeholders in prompt text with input values.

    Text-only variant: returns a flat string.  Used by text_gen_handler
    and _manual_output_handler where multimodal parts aren't needed.

    Mirrors ``Template.substitute()`` + ``#replaceParam()`` from
    ``template.ts``.

    - ``{"type": "in", ...}`` — upstream node outputs
    - ``{"type": "asset", ...}`` — graph-level assets
    """
    def replace_match(m: re.Match[str]) -> str:
        inner_json = m.group(1)
        try:
            param = json.loads(inner_json)
        except (json.JSONDecodeError, TypeError):
            return m.group(0)  # Not valid JSON — leave as-is.

        if not isinstance(param, dict):
            return m.group(0)

        param_type = param.get("type")

        if param_type == "in":
            path = param.get("path", "")
            title = param.get("title", "")
            port_name = f"p-z-{path}"
            if port_name not in inputs:
                return title
            return _extract_input_text(inputs[port_name])

        if param_type == "asset":
            return _resolve_asset_text(param, assets)

        return m.group(0)  # Unknown param type — leave as-is.

    return _TEMPLATE_RE.sub(replace_match, text)


def _substitute_template_parts(
    text: str,
    inputs: dict[str, list[Any]],
    assets: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Replace template placeholders, preserving multimodal parts.

    Multimodal variant of ``_substitute_template``.  Returns a flat list
    of LLMContent parts (``{"text": ...}``, ``{"storedData": ...}``,
    ``{"inlineData": ...}``, etc.) instead of a plain string.

    Mirrors the TS ``Template.substitute()`` which spreads
    ``LLMContent.parts`` into the result, preserving images and other
    binary data alongside text.
    """
    parts: list[dict[str, Any]] = []
    last_end = 0

    for m in _TEMPLATE_RE.finditer(text):
        # Text before this placeholder.
        before = text[last_end:m.start()]
        if before:
            parts.append({"text": before})
        last_end = m.end()

        inner_json = m.group(1)
        try:
            param = json.loads(inner_json)
        except (json.JSONDecodeError, TypeError):
            parts.append({"text": m.group(0)})
            continue

        if not isinstance(param, dict):
            parts.append({"text": m.group(0)})
            continue

        param_type = param.get("type")

        if param_type == "in":
            path = param.get("path", "")
            title = param.get("title", "")
            port_name = f"p-z-{path}"
            if port_name not in inputs:
                parts.append({"text": title})
            else:
                parts.extend(_get_input_parts(inputs[port_name]))
        elif param_type == "asset":
            # Assets are text-only for now.
            parts.append({"text": _resolve_asset_text(param, assets)})
        else:
            parts.append({"text": m.group(0)})

    # Trailing text after last placeholder.
    trailing = text[last_end:]
    if trailing:
        parts.append({"text": trailing})

    return _merge_adjacent_text_parts(parts)


def _get_input_parts(values: list[Any]) -> list[dict[str, Any]]:
    """Extract parts from an input port's values, preserving all part types.

    Mirrors the TS ``Template.substitute()`` logic:
    - ``LLMContent`` → spread its ``.parts``
    - ``LLMContent[]`` → spread last non-$metadata item's ``.parts``
    - ``string`` → ``[{"text": value}]``
    """
    if not values:
        return []

    value = values[0]

    if isinstance(value, str):
        return [{"text": value}]

    if isinstance(value, dict) and "parts" in value:
        # Single LLMContent.
        return list(value.get("parts", []))

    if isinstance(value, list):
        # LLMContent[] — get last non-metadata item.
        last = _get_last_non_metadata(value)
        if last:
            return list(last.get("parts", []))

    return [{"text": json.dumps(value) if value is not None else ""}]


def _merge_adjacent_text_parts(
    parts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge consecutive text parts into single parts.

    Mirrors ``Template.#mergeTextParts()`` from template.ts.
    """
    if not parts:
        return parts

    merged: list[dict[str, Any]] = []
    for part in parts:
        if (
            "text" in part
            and merged
            and "text" in merged[-1]
        ):
            merged[-1] = {"text": merged[-1]["text"] + part["text"]}
        else:
            merged.append(part)
    return merged


def _template_consumed_ports(
    config: dict[str, Any],
) -> set[str]:
    """Return the set of input port names consumed by template placeholders.

    These ports are inlined into the prompt text and should not also
    be appended as separate context segments.
    """
    prompt = config.get("config$prompt")
    if not isinstance(prompt, dict):
        return set()

    text = _extract_text_from_content(prompt)
    consumed: set[str] = set()
    for m in _TEMPLATE_RE.finditer(text):
        try:
            param = json.loads(m.group(1))
            if isinstance(param, dict) and param.get("type") == "in":
                consumed.add(f"p-z-{param.get('path', '')}")
        except (json.JSONDecodeError, TypeError):
            continue
    return consumed


def _extract_input_text(values: list[Any]) -> str:
    """Extract text from an input port's values for template substitution.

    Mirrors the value-type handling in ``Template.substitute()``:
    - string → use directly
    - LLMContent (dict with parts) → extract text from parts
    - LLMContent[] (list) → get last non-$metadata item's text
    """
    if not values:
        return ""

    value = values[0]

    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        return _extract_text_from_content(value)

    if isinstance(value, list):
        # LLMContent[] — get last non-metadata item.
        last = _get_last_non_metadata(value)
        if last:
            return _extract_text_from_content(last)

    return json.dumps(value) if value is not None else ""


def _get_last_non_metadata(items: list[Any]) -> dict[str, Any] | None:
    """Get the last non-$metadata LLMContent from a list.

    Mirrors ``Template.#getLastNonMetadata()`` in template.ts.
    """
    for item in reversed(items):
        if isinstance(item, dict) and item.get("role") != "$metadata":
            return item
    return None
