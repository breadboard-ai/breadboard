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

import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Coroutine

from .events import SUSPEND_TYPES, AgentEvent

__all__ = [
    "NodeSuspended",
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


async def input_handler(
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Suspend the node to request user input.

    Raises ``NodeSuspended`` with the node's input schema so the
    graph runner can emit an ``inputRequired`` event. The resume
    endpoint later provides the user's input as the node output.
    """
    interaction_id = str(uuid.uuid4())

    # Build the suspend event payload from config.
    schema = config.get("schema", {})
    prompt_text = config.get("prompt", "Please provide input")

    raise NodeSuspended(
        interaction_id=interaction_id,
        context={"inputs": inputs, "config": config},
        suspend_event={
            "inputNode": {
                "schema": schema,
                "prompt": prompt_text,
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

    # Run the agent loop.
    last_event = None
    result_content: list[dict[str, Any]] = []

    agent_iter = deps.run_agent_fn(
        segments=segments,
        backend=deps.backend,
        store=deps.interaction_store,
        graph=deps.graph_info or {},
    )

    async for event in agent_iter:
        event_dict = event.to_dict()
        last_event = event

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
                context={"segments": segments},
                suspend_event=event_dict,
            )

        # Accumulate content events for final output.
        if event.type == "content":
            content = getattr(event, "content", None)
            if content:
                result_content.append(content)

    # Agent completed — build outputs.
    if result_content:
        return {"context": result_content}

    return {
        "context": [
            {
                "role": "model",
                "parts": [{"text": "[agent completed]"}],
            }
        ],
    }


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
        segments.append({"type": "text", "text": prompt})

    # Input context from upstream nodes — extract text from LLMContent.
    for _port, values in inputs.items():
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

