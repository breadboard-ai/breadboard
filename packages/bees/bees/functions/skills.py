# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Skills function group — instruction-only group with no function handlers.

Provides a system instruction that configures the agent's skill-related
behavior. Loaded from ``bees/declarations/skills.*`` files.

The instruction template contains ``{{available_skills}}`` which is
resolved at group construction time with the current skill listing.
"""

from __future__ import annotations

import re
import yaml
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)

__all__ = ["get_skills_function_group", "scan_skills"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

_LOADED = load_declarations("skills", declarations_dir=_DECLARATIONS_DIR)

# Matches YAML frontmatter delimited by --- lines.
_FRONTMATTER_RE = re.compile(
    r"\A---\s*\n(.*?)\n---\s*\n",
    re.DOTALL,
)


@dataclass
class SkillInfo:
    """Parsed metadata from a SKILL.md frontmatter."""

    name: str
    title: str
    description: str
    vfs_path: str
    content: str


def _parse_frontmatter(text: str) -> dict[str, str]:
    """Extract YAML frontmatter key-value pairs from markdown text."""
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}
    data = yaml.safe_load(match.group(1))
    if not isinstance(data, dict):
        return {}
    return {k: str(v) for k, v in data.items()}


def scan_skills(
    skills_dir: Path,
    *,
    vfs_prefix: str = "skills",
) -> tuple[str, dict[str, str]]:
    """Scan a directory for SKILL.md files and build the listing + files dict.

    Each immediate subdirectory of ``skills_dir`` that contains a
    ``SKILL.md`` file is treated as a skill. The frontmatter is parsed
    for ``title`` and ``description``.

    Args:
        skills_dir: Disk path to the directory containing skill folders.
        vfs_prefix: VFS path prefix (default ``"skills"``). Files are
            written to ``/mnt/{vfs_prefix}/{skill_dir_name}/SKILL.md``.

    Returns:
        A ``(listing, initial_files)`` tuple:
        - ``listing``: Formatted markdown for ``{{available_skills}}``
        - ``initial_files``: Dict of ``{vfs_name: content}`` for
          ``initial_files`` parameter on ``new_session()``.
    """
    skills: list[SkillInfo] = []
    initial_files: dict[str, str] = {}

    if not skills_dir.is_dir():
        return "", {}

    for child in sorted(skills_dir.iterdir()):
        if not child.is_dir():
            continue
        skill_path = child / "SKILL.md"
        if not skill_path.exists():
            continue

        content = skill_path.read_text()
        meta = _parse_frontmatter(content)

        dir_name = child.name
        vfs_name = f"{vfs_prefix}/{dir_name}/SKILL.md"
        vfs_path = f"/mnt/{vfs_name}"

        skill = SkillInfo(
            name=meta.get("name", dir_name),
            title=meta.get("title", dir_name),
            description=meta.get("description", ""),
            vfs_path=vfs_path,
            content=content,
        )
        skills.append(skill)
        initial_files[vfs_name] = content

    # Build the listing.
    lines: list[str] = []
    for skill in skills:
        lines.append(f"- [{skill.title}]({skill.vfs_path})")
        if skill.description:
            lines.append(f"  {skill.description}")
    listing = "\n".join(lines)

    return listing, initial_files


def get_skills_function_group(
    *, available_skills: str = "",
) -> FunctionGroup:
    """Build an instruction-only FunctionGroup for skills.

    Args:
        available_skills: Rendered listing of available skills,
            substituted into the ``{{available_skills}}`` placeholder
            in the instruction template.
    """
    instruction = (_LOADED.instruction or "").replace(
        "{{available_skills}}", available_skills,
    )
    return assemble_function_group(
        _LOADED, {}, instruction_override=instruction,
    )
