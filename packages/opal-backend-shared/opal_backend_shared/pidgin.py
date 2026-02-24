# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Pidgin translation utilities for the agent loop.

This module is the **single source of truth** for the pidgin vocabulary —
the set of XML-like tags (``<objective>``, ``<asset>``, ``<input>``,
``<file>``, ``<content>``, ``<a>``) understood by Gemini.

**to_pidgin**: Converts structured segments (from the wire protocol) into
pidgin text. Registers data parts in ``AgentFileSystem`` and emits tags.

**from_pidgin_string**: Resolves ``<file>`` tags in agent output back to
data parts from the ``AgentFileSystem``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .agent_file_system import AgentFileSystem

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ROUTE_TOOL_PATH = "control-flow/routing"
MEMORY_TOOL_PATH = "function-group/use-memory"
NOTEBOOKLM_TOOL_PATH = "function-group/notebooklm"
NOTEBOOKLM_URL_PREFIX = "https://notebooklm.google.com/notebook/"

# Text parts longer than this get written to a file and referenced as
# ``<content src="...">`` instead of inlined.
MAX_INLINE_CHARACTER_LENGTH = 1000

# ---------------------------------------------------------------------------
# to_pidgin — segments → pidgin text
# ---------------------------------------------------------------------------


@dataclass
class ToPidginResult:
    """Result of converting segments to pidgin text."""

    text: str
    use_memory: bool = False
    use_notebooklm: bool = False
    custom_tool_urls: list[dict[str, str]] = field(default_factory=list)


def to_pidgin(
    segments: list[dict[str, Any]],
    file_system: AgentFileSystem,
    *,
    use_notebooklm_flag: bool = False,
) -> ToPidginResult | dict[str, str]:
    """Convert structured segments to pidgin text.

    Walks the segment array, registers data parts in ``file_system``, and
    emits all pidgin tags.  Returns a ``ToPidginResult`` on success or an
    error dict ``{"$error": "..."}`` on failure.

    Args:
        segments: List of segment dicts from the wire protocol.
        file_system: The file system to register data parts in.
        use_notebooklm_flag: Runtime flag sent alongside segments.
    """
    values: list[str] = []
    errors: list[str] = []
    use_memory = False
    use_notebooklm = use_notebooklm_flag
    custom_tool_urls: list[dict[str, str]] = []

    for segment in segments:
        seg_type = segment.get("type", "")

        if seg_type == "text":
            text = segment.get("text", "")
            if text:
                values.append(text)

        elif seg_type == "asset":
            title = segment.get("title", "asset")
            content = segment.get("content")
            if not content or not content.get("parts"):
                errors.append("Agent: Invalid asset format")
                continue
            inner = content_to_pidgin_string(content, file_system, text_as_files=True)
            values.append(f'<asset title="{title}">\n{inner}\n</asset>')

        elif seg_type == "input":
            title = segment.get("title", "input")
            content = segment.get("content")
            if not content or not content.get("parts"):
                continue
            inner = content_to_pidgin_string(content, file_system, text_as_files=True)
            values.append(
                f'<input source-agent="{title}">\n{inner}\n</input>'
            )

        elif seg_type == "tool":
            path = segment.get("path", "")
            title = segment.get("title", "")

            if path == ROUTE_TOOL_PATH:
                instance = segment.get("instance")
                if not instance:
                    errors.append(
                        "Agent: Malformed route, missing instance param"
                    )
                    continue
                route_name = file_system.add_route(instance)
                values.append(f'<a href="{route_name}">{title}</a>')

            elif path == MEMORY_TOOL_PATH:
                use_memory = True
                values.append("Use Memory")

            elif path == NOTEBOOKLM_TOOL_PATH:
                use_notebooklm = True
                values.append("Use NotebookLM")

            else:
                # Custom tool — record the URL for server-side loading
                custom_tool_urls.append(
                    {"url": path, "title": title}
                )

        else:
            if seg_type:
                errors.append(f"Unknown segment type: {seg_type}")

    if errors:
        return {"$error": f"Agent: {','.join(errors)}"}

    text = "".join(values)
    return ToPidginResult(
        text=text,
        use_memory=use_memory,
        use_notebooklm=use_notebooklm,
        custom_tool_urls=custom_tool_urls,
    )


def content_to_pidgin_string(
    content: dict[str, Any],
    file_system: AgentFileSystem,
    *,
    text_as_files: bool = True,
) -> str:
    """Convert LLMContent parts to pidgin text with file references.

    Text parts below MAX_INLINE_CHARACTER_LENGTH are inlined as-is; text
    parts above the threshold (when ``text_as_files`` is True) are stored
    as files and wrapped in ``<content>`` tags — both inline text AND file
    handle.  Binary parts become ``<file>`` tags.

    This is the public API for converting any LLMContent to pidgin,
    including function outputs (e.g. ``generate_text`` results).
    """
    values: list[str] = []

    for part in content.get("parts", []):
        if "text" in part:
            text = part["text"]
            if (
                text_as_files
                and len(text) > MAX_INLINE_CHARACTER_LENGTH
            ):
                name = file_system.add_part(part)
                if isinstance(name, str):
                    values.append(f'<content src="{name}">\n{text}</content>')
                    continue
            values.append(text)
        else:
            # NotebookLM references pass through as URL text
            if "storedData" in part:
                handle = part["storedData"].get("handle", "")
                if handle.startswith(NOTEBOOKLM_URL_PREFIX):
                    values.append(handle)
                    continue

            name = file_system.add_part(part)
            if isinstance(name, dict) and "$error" in name:
                continue
            values.append(f'<file src="{name}" />')

    return "\n".join(values)


def _is_notebooklm_url(url: str) -> bool:
    """Check if a URL is a NotebookLM URL."""
    return url.startswith(NOTEBOOKLM_URL_PREFIX)


# ---------------------------------------------------------------------------
# from_pidgin_string — pidgin text → LLMContent
# ---------------------------------------------------------------------------

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

