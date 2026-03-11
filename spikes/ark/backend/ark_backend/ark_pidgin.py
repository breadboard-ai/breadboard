"""Ark pidgin translator — resolves <file> tags against the real filesystem.

Pidgin is a lightweight markup used by the agent to reference files by
handle. Tags like ``<file src="report.md" />`` are resolved to actual
file content.

This module provides a protocol-based design so the file reader can be
swapped when binary/multimodal file support lands.

See also: ``opal_backend.pidgin`` (the full-featured original).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

__all__ = [
    "FileReader",
    "TextFileReader",
    "from_pidgin_string",
]


# ---------------------------------------------------------------------------
# FileReader protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class FileReader(Protocol):
    """Reads a file by relative path and returns its content as LLMContent.

    Implementations must return either:
    - A dict with "parts" key (LLMContent) on success
    - A dict with "$error" key on failure
    """

    async def read(self, path: str) -> dict[str, Any]: ...


# ---------------------------------------------------------------------------
# TextFileReader — TEXT-ONLY
# ---------------------------------------------------------------------------


class TextFileReader:
    """Reads text files from a directory on the real filesystem.

    # TEXT-ONLY: This reader ignores binary files (images, audio, video).
    # When multimodal support lands, replace with a MultimodalFileReader
    # that sniffs MIME types and returns inlineData parts for binary content.
    """

    def __init__(self, work_dir: Path) -> None:
        self._work_dir = work_dir.resolve()

    async def read(self, path: str) -> dict[str, Any]:
        target = (self._work_dir / path).resolve()

        # Path traversal guard.
        if not str(target).startswith(str(self._work_dir)):
            return {"$error": f"Path outside working directory: {path}"}

        if not target.exists():
            return {"$error": f"File not found: {path}"}

        try:
            text = target.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # TEXT-ONLY: binary files are unreadable. A multimodal reader
            # would return {"parts": [{"inlineData": {...}}]} here.
            return {"$error": f"Binary file not supported (text-only): {path}"}

        return {"parts": [{"text": text}]}


# ---------------------------------------------------------------------------
# Pidgin resolution
# ---------------------------------------------------------------------------

# Matches <file src="path" /> — same regex as opal_backend.pidgin.
_SPLIT_REGEX = re.compile(
    r'(<file\s+src\s*=\s*"[^"]*"\s*/>|<a\s+href\s*=\s*"[^"]*"\s*>[^<]*</a>)'
)
_FILE_PARSE_REGEX = re.compile(r'<file\s+src\s*=\s*"([^"]*)"\s*/>')


async def from_pidgin_string(
    text: str, reader: FileReader
) -> dict[str, Any]:
    """Resolve ``<file>`` tags in *text* using the given reader.

    Returns an LLMContent dict (``{"parts": [...]}``) with file tags
    replaced by their resolved content. Text segments become text parts;
    file tags become whatever the reader returns.

    If a file tag can't be resolved, its ``$error`` message is inlined
    as a text part so the agent can see what went wrong.

    Args:
        text: The string potentially containing ``<file src="..." />`` tags.
        reader: A FileReader implementation.

    Returns:
        An LLMContent dict with "parts" key.
    """
    if not text:
        return {"parts": [{"text": ""}]}

    segments = _SPLIT_REGEX.split(text)
    parts: list[dict[str, Any]] = []

    for segment in segments:
        if not segment:
            continue

        file_match = _FILE_PARSE_REGEX.match(segment)
        if file_match:
            path = file_match.group(1)
            result = await reader.read(path)
            if "$error" in result:
                parts.append({"text": f"[Error: {result['$error']}]"})
            else:
                parts.extend(result.get("parts", []))
        else:
            parts.append({"text": segment})

    return {"parts": parts}
