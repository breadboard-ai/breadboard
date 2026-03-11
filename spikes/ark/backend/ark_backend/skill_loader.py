"""Shared skill loader for the Ark backend.

Centralizes the pattern of discovering SKILL.md files from the skills
directory. Supports an optional allowlist to load a subset of skills.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from opal_backend.skilled_agent import Skill, parse_skill_front_matter

__all__ = ["load_skills", "copy_skills_to_work_dir", "LoadedSkill"]

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"


@dataclass
class LoadedSkill:
    """A Skill with its directory slug for filesystem operations."""

    skill: Skill
    slug: str


def load_skills(
    *,
    include: list[str] | None = None,
) -> list[LoadedSkill]:
    """Discover skills from backend/skills/*/SKILL.md.

    Args:
        include: Optional allowlist of skill directory names (slugs).
            When provided, only skills whose directory name is in the
            list are loaded. When None, all skills are loaded.

    Returns:
        A list of LoadedSkill objects.
    """
    results: list[LoadedSkill] = []
    if not SKILLS_DIR.is_dir():
        return results

    for skill_path in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        slug = skill_path.parent.name
        if include is not None and slug not in include:
            continue
        content = skill_path.read_text()
        name, description = parse_skill_front_matter(content)
        results.append(LoadedSkill(
            skill=Skill(name=name, description=description, content=content),
            slug=slug,
        ))
        logger.info("Loaded skill: %s (%s)", name, slug)
    return results


def copy_skills_to_work_dir(
    loaded: list[LoadedSkill],
    work_dir: Path,
    *,
    transform: Callable[[str], str] | None = None,
) -> None:
    """Copy skill content into work_dir/skills/{slug}/SKILL.md.

    Args:
        loaded: Skills to copy (as returned by load_skills).
        work_dir: The sandbox working directory.
        transform: Optional function to transform skill content before
            writing (e.g., rewriting path references).
    """
    skills_dst = work_dir / "skills"
    for entry in loaded:
        content = transform(entry.skill.content) if transform else entry.skill.content
        dest = skills_dst / entry.slug / "SKILL.md"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
