# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Prefix payload builder for singleton content caching.

Assembles the ``cachedContent`` payload (system instruction + tool
declarations) from the canonical JSON/MD declaration files. The payload
is fully determined by which function groups are active, making it
shareable across clients with the same flag combination.

Used by both the dev server's in-memory singleton cache and the
production backend's cache management.
"""

from __future__ import annotations

import json
from typing import Any

from .function_definition import load_declarations
from .loop import AGENT_MODEL

__all__ = ["build_prefix_payload"]

# Gemini cached content TTL in seconds (30 minutes).
CACHE_TTL_SECONDS = 30 * 60


def build_prefix_payload(
    *,
    use_memory: bool = False,
    use_notebooklm: bool = False,
    use_google_drive: bool = False,
) -> dict[str, Any]:
    """Build the cachedContent payload for a given flag combination.

    Assembles declarations and instructions from the canonical JSON/MD
    files — the same source of truth used by the agent loop.
    """
    # Always-on groups.
    groups = ["system", "generate", "chat"]

    # Conditional groups.
    if use_memory:
        groups.append("memory")
    if use_notebooklm:
        groups.append("notebooklm")
    if use_google_drive:
        groups.append("google-drive")

    all_declarations: list[dict[str, Any]] = []
    instruction_parts: list[str] = []

    for group_name in groups:
        loaded = load_declarations(group_name)
        all_declarations.extend(loaded.declarations)
        if loaded.instruction:
            instruction_parts.append(loaded.instruction)

    system_instruction_text = "\n\n".join(instruction_parts)

    return {
        "model": f"models/{AGENT_MODEL}",
        "systemInstruction": {
            "parts": [{"text": system_instruction_text}],
            "role": "user",
        },
        "tools": [{"functionDeclarations": all_declarations}],
        "toolConfig": {"functionCallingConfig": {"mode": "ANY"}},
        "contents": [],
        "ttl": f"{CACHE_TTL_SECONDS}s",
    }
