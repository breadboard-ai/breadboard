# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Node handlers — per-node-type execution logic.

Each handler receives inputs and config; returns outputs.
Only stdlib + typing — no external deps (synced to production).

Phase 2 scope:
- ``passthrough_handler`` — returns inputs as outputs (output nodes)
- ``text_gen_handler`` — stub for direct Gemini text generation

Later phases will add:
- ``agent_handler`` — full agent loop via ``run_agent()``
- ``asset_handler`` — resolve storedData/fileData
- ``input_handler`` — emit inputRequired, save state
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "dispatch_handler",
    "passthrough_handler",
    "text_gen_handler",
]


async def dispatch_handler(
    node_type: str,
    inputs: dict[str, list[Any]],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Dispatch to the appropriate handler based on node type.

    Returns node outputs.
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

    Phase 2 scope: returns a mock response. Full implementation in
    Phase 4 will call ``BackendClient.stream_generate_content()``.
    """
    # For Phase 2 testing, produce a deterministic output.
    context_parts = []
    for port, values in inputs.items():
        for value in values:
            if isinstance(value, list):
                context_parts.extend(value)
            elif isinstance(value, dict):
                context_parts.append(value)

    return {
        "context": [
            {
                "role": "model",
                "parts": [{"text": "[generated response]"}],
            }
        ],
    }
