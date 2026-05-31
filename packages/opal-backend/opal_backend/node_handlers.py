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
    # Subgraph nodes (type starts with "#") are passthrough for now.
    if node_type.startswith("#"):
        return await passthrough_handler(inputs, config)

    match node_type:
        case "output" | "render-outputs":
            return await passthrough_handler(inputs, config)
        case "input":
            return await passthrough_handler(inputs, config)
        case "generate":
            mode = config.get("mode", "text")
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
    ``run_agent()`` expects.
    """
    segments: list[dict[str, Any]] = []

    # System instruction from config.
    system_instruction = config.get("systemInstruction")
    if system_instruction:
        segments.append({
            "kind": "text",
            "parts": [{"text": system_instruction}],
        })

    # Input context from upstream nodes.
    for port, values in inputs.items():
        for value in values:
            if isinstance(value, list):
                # Already a list of LLMContent.
                for item in value:
                    segments.append({
                        "kind": "text",
                        "parts": item.get("parts", []) if isinstance(item, dict) else [],
                    })
            elif isinstance(value, dict):
                segments.append({
                    "kind": "text",
                    "parts": value.get("parts", []),
                })
            elif isinstance(value, str):
                segments.append({
                    "kind": "text",
                    "parts": [{"text": value}],
                })

    return segments
