# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Pidgin translation utilities for the agent loop.

Port of the "from pidgin" direction of ``PidginTranslator`` from
``visual-editor/src/a2/agent/pidgin-translator.ts``. Resolves
``<file src="/mnt/..." />`` tags in agent output to actual data parts
from the ``AgentFileSystem``.

The "to pidgin" direction (``toPidgin``) is deferred to Phase 4.4g.
"""

from __future__ import annotations

import re
from typing import Any

from .agent_file_system import AgentFileSystem

# Regex patterns matching the TS SPLIT_REGEX, FILE_PARSE_REGEX, LINK_PARSE_REGEX
_SPLIT_REGEX = re.compile(
    r'(<file\s+src\s*=\s*"[^"]*"\s*/>|<a\s+href\s*=\s*"[^"]*"\s*>[^<]*</a>)'
)
_FILE_PARSE_REGEX = re.compile(r'<file\s+src\s*=\s*"([^"]*)"\s*/>')
_LINK_PARSE_REGEX = re.compile(r'<a\s+href\s*=\s*"([^"]*)"\s*>\s*([^<]*)\s*</a>')


def from_pidgin_string(
    content: str, file_system: AgentFileSystem
) -> dict[str, Any] | list[dict[str, Any]]:
    """Resolve pidgin markup in a string to data parts.

    Parses ``<file src="/mnt/..." />`` tags, resolves them via the file
    system, and returns an ``LLMContent``-like dict with merged text parts.
    Also parses ``<a href="...">title</a>`` link tags, extracting just the
    title text.

    Args:
        content: The pidgin string to parse.
        file_system: The file system to resolve file references against.

    Returns:
        An ``LLMContent`` dict ``{"parts": [...], "role": "user"}`` on
        success, or an error dict ``{"$error": "..."}`` on failure.
    """
    segments = _SPLIT_REGEX.split(content)
    parts: list[dict[str, Any]] = []
    errors: list[str] = []

    for segment in segments:
        # Check for <file src="/mnt/..." />
        file_match = _FILE_PARSE_REGEX.match(segment)
        if file_match:
            path = file_match.group(1)
            result = file_system.get(path)
            if isinstance(result, dict) and "$error" in result:
                errors.append(result["$error"])
                continue
            parts.extend(result)
            continue

        # Check for <a href="...">title</a>
        link_match = _LINK_PARSE_REGEX.match(segment)
        if link_match:
            title = link_match.group(2).strip()
            parts.append({"text": title})
            continue

        # Plain text
        if segment:
            parts.append({"text": segment})

    if errors:
        return {"$error": f"Agent unable to proceed: {','.join(errors)}"}

    # Merge consecutive text parts
    merged = _merge_text_parts(parts)
    return {"parts": merged, "role": "user"}


def _merge_text_parts(
    parts: list[dict[str, Any]], separator: str = "\n"
) -> list[dict[str, Any]]:
    """Merge consecutive text parts into a single text part.

    Non-text parts (inlineData, fileData, etc.) are left as-is.
    """
    merged: list[dict[str, Any]] = []
    for part in parts:
        if "text" in part and len(part) == 1:
            # This is a pure text part
            if merged and "text" in merged[-1] and len(merged[-1]) == 1:
                merged[-1]["text"] += separator + part["text"]
            else:
                merged.append(dict(part))
        else:
            merged.append(part)
    return merged
