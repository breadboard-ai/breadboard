# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Skill loader for the Bees backend.

Discovers SKILL.md files from the skills directory and returns them
as Skill objects ready for run_skilled_agent().
"""

from __future__ import annotations

import logging
from pathlib import Path

from opal_backend.skilled_agent import Skill, parse_skill_front_matter

__all__ = ["load_skills"]

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


def load_skills(
    *,
    include: list[str] | None = None,
) -> list[Skill]:
    """Discover skills from skills/*/SKILL.md.

    Args:
        include: Optional allowlist of skill directory names (slugs).
            When provided, only matching skills are loaded. When None,
            all skills are loaded.

    Returns:
        A list of Skill objects.
    """
    results: list[Skill] = []
    if not SKILLS_DIR.is_dir():
        return results

    for skill_path in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        slug = skill_path.parent.name
        if include is not None and slug not in include:
            continue
        content = skill_path.read_text()
        name, description = parse_skill_front_matter(content)
        results.append(Skill(
            name=name, description=description, content=content,
        ))
        logger.info("Loaded skill: %s (%s)", name, slug)
    return results
