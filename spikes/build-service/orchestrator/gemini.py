# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Gemini integration — generate React UI.

Calls the Gemini API directly (no agent loop) with a system prompt
that provides design guidance, component patterns, and rules.
Gemini returns a multi-file React bundle as JSON.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx

__all__ = ["generate_ui"]

logger = logging.getLogger(__name__)

GENAI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = "gemini-3.1-pro-preview"

# Load the UI skill from the local skills directory.
_SKILL_PATH = Path(__file__).resolve().parent / "skills" / "ui-generator" / "SKILL.md"
UI_SKILL = _SKILL_PATH.read_text() if _SKILL_PATH.is_file() else """\
# UI Component Generation Skill

Generate multi-file React component bundles from natural language.

## Rules
1. Entry point must be `App.jsx` with a default-exported function called `App`.
2. Every file imports what it uses. Include `import React from "react"`.
3. Sub-components go in `components/` directory.
4. Shared styles in `styles.css`.
5. Export default from every component file.
6. Use realistic sample data, never placeholder text.
"""

SYSTEM_INSTRUCTION = f"""\
You are a React UI generator. You create multi-file React component bundles.

{UI_SKILL}

## Output Format

You MUST respond with valid JSON only — no markdown fences, no explanation.
The JSON must have this exact shape:

{{
  "files": {{
    "App.jsx": "import React from \\"react\\";\\n...",
    "components/Header.jsx": "...",
    "styles.css": "..."
  }}
}}

Rules:
- "App.jsx" is required as the entry point.
- Every .jsx file must import React.
- Every component must export default.
- Use realistic, plausible sample data.
- CSS should use custom properties where possible.
"""


async def generate_ui(
    prompt: str,
    *,
    on_progress: Any | None = None,
) -> dict[str, str]:
    """Generate a multi-file React UI from a prompt.

    Args:
        prompt: User's description of the UI they want.
    on_progress: Optional callback(msg: str) for progress updates.

    Returns:
        File map: { "App.jsx": "...", "components/Foo.jsx": "...", ... }
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    url = (
        f"{GENAI_API_BASE}/{MODEL}:generateContent"
        f"?key={api_key}"
    )

    body = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_INSTRUCTION}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            },
        ],
        "generationConfig": {
            "temperature": 1.0,
            "responseMimeType": "application/json",
        },
    }

    if on_progress:
        on_progress("Calling Gemini...")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code != 200:
            error = response.text[:500]
            raise RuntimeError(f"Gemini API error {response.status_code}: {error}")

        data = response.json()

    # Extract the text from the response.
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError("Gemini returned no content")

    text = parts[0].get("text", "")
    if not text:
        raise RuntimeError("Gemini returned empty text")

    if on_progress:
        on_progress("Parsing response...")

    # Parse the JSON response.
    try:
        result = json.loads(text)
    except json.JSONDecodeError as e:
        # Try to extract JSON from markdown fences.
        import re
        match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            result = json.loads(match.group(1))
        else:
            raise RuntimeError(f"Failed to parse Gemini response as JSON: {e}") from e

    files = result.get("files", {})
    if not files:
        raise RuntimeError("Gemini response has no 'files' field")
    if "App.jsx" not in files:
        raise RuntimeError("Gemini response missing App.jsx entry point")

    logger.info("Generated %d files from Gemini", len(files))
    return files
