# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Node handlers — per-node-type execution logic.

Each handler receives inputs, config, and optional dependencies;
returns either outputs (complete) or raises ``NodeSuspended`` to
signal that the node needs user input.

Only stdlib + typing — no external deps (synced to production).

Handler types by phase:
- ``passthrough_handler`` — returns inputs as outputs (output nodes)
- ``text_gen_handler`` — stub for direct Gemini text generation
- ``agent_handler`` — full agent loop via ``run_agent()``
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Coroutine

from .events import SUSPEND_TYPES, AgentEvent

__all__ = [
    "NodeSuspended",
    "consume_agent_events",
    "dispatch_handler",
    "passthrough_handler",
    "text_gen_handler",
    "input_handler",
    "agent_handler",
]


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

    # Agent runner — async iterator factory.
    # Returns an async iterator of AgentEvent.
    run_agent_fn: Callable[..., AsyncIterator[AgentEvent]] | None = None

    # For building agent run kwargs.
    backend: Any = None
    interaction_store: Any = None
    graph_info: dict[str, Any] | None = None


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


def _get_system_instruction(config: dict[str, Any]) -> str:
    """Extract system instruction text from config.

    Handles both:
    - Simple string: ``{"systemInstruction": "Be helpful"}``
    - LLMContent: ``{"b-system-instruction": {"parts": [{"text": "..."}]}}``
    """
    # Simple string format.
    simple = config.get("systemInstruction")
    if isinstance(simple, str):
        return simple

    # Real Breadboard LLMContent format.
    llm_content = config.get("b-system-instruction")
    if isinstance(llm_content, dict):
        return _extract_text_from_content(llm_content)

    return ""


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
            return await passthrough_handler(inputs, config)
        case "input":
            return await input_handler(inputs, config)
        case "generate":
            mode = _get_mode(config)
            if mode == "agent" and deps and deps.run_agent_fn:
                return await agent_handler(inputs, config, deps)
            return await text_gen_handler(inputs, config)
        case _:
            # Default passthrough for unknown types.
            return await passthrough_handler(inputs, config)


async def passthrough_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Return inputs as outputs.

    Flattens multi-value input ports: if a port has a single value,
    unwrap it. This is the behavior for output/render-outputs nodes.
    """
    outputs: dict[str, Any] = {}
    for port, values in inputs.items():
        if len(values) == 1:
            outputs[port] = values[0]
        else:
            outputs[port] = values
    return outputs


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
) -> dict[str, Any]:
    """Stub text generation handler.

    Returns a mock response. Full implementation will call
    ``BackendClient.stream_generate_content()``.
    """
    return {
        "context": [
            {
                "role": "model",
                "parts": [{"text": "[generated response]"}],
            }
        ],
    }


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
    segments = _build_segments_from_inputs(inputs, config)

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
        # Substitute template placeholders with upstream input values.
        prompt = _substitute_template(prompt, inputs)
        segments.append({"type": "text", "text": prompt})

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
# Template substitution — port of Template.substitute() from template.ts
# ---------------------------------------------------------------------------

# Matches {{...}} where the inner {...} is JSON.
# Mirrors PARSING_REGEX in template.ts:
#   /{(?<json>{(?:.*?)})}/gim
_TEMPLATE_RE = re.compile(r"\{(\{(?:.*?)\})\}", re.IGNORECASE | re.DOTALL)


def _substitute_template(
    text: str,
    inputs: dict[str, list[Any]],
) -> str:
    """Replace template placeholders in prompt text with input values.

    Mirrors ``Template.substitute()`` + ``#replaceParam()`` from
    ``template.ts``. For ``{"type": "in", "path": "<node-id>"}``
    placeholders, looks up the input port ``p-z-<node-id>`` and
    substitutes the text content of the upstream node's output.
    """
    def replace_match(m: re.Match[str]) -> str:
        inner_json = m.group(1)
        try:
            param = json.loads(inner_json)
        except (json.JSONDecodeError, TypeError):
            return m.group(0)  # Not valid JSON — leave as-is.

        if not isinstance(param, dict) or param.get("type") != "in":
            return m.group(0)  # Not an "in" param — leave as-is.

        path = param.get("path", "")
        title = param.get("title", "")
        port_name = f"p-z-{path}"

        if port_name not in inputs:
            # Fallback to title, same as TS #replaceParam.
            return title

        return _extract_input_text(inputs[port_name])

    return _TEMPLATE_RE.sub(replace_match, text)


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
