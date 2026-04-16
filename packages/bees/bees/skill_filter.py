# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Skill filtering and function-filter merging.

Resolves which skills are active for a session and merges their
``allowed-tools`` declarations into the session's function filter.
"""

from __future__ import annotations

from pathlib import Path

from bees.functions.skills import scan_skills

__all__ = ["filter_skills", "merge_function_filter"]

_SKILLS_CACHE: dict = {}


def _get_skills(hive_dir: Path):
    if hive_dir not in _SKILLS_CACHE:
        _SKILLS_CACHE[hive_dir] = scan_skills(hive_dir)
    return _SKILLS_CACHE[hive_dir]


def filter_skills(
    allowed_skills: list[str] | None, hive_dir: Path
) -> tuple[str, dict[str, str], list[str]]:
    """Filter skills based on allowed_skills and return listing, files, and tool globs.

    Returns:
        A ``(listing, files, skill_tools)`` tuple:
        - ``listing``: Formatted markdown for ``{{available_skills}}``.
        - ``files``: Dict of ``{vfs_name: content}`` for seeding.
        - ``skill_tools``: Merged ``allowed-tools`` from all selected skills.
    """
    _, skills_files, skills_list = _get_skills(hive_dir)

    skills_to_use = allowed_skills if allowed_skills is not None else []

    if "*" in skills_to_use:
        filtered_skills = skills_list
    else:
        filtered_skills = [s for s in skills_list if s.name in skills_to_use]

    lines = []
    skill_tools: list[str] = []
    for s in filtered_skills:
        lines.append(f"- [{s.title}]({s.vfs_path})")
        if s.description:
            lines.append(f"  {s.description}")
        skill_tools.extend(s.allowed_tools)
    session_listing = "\n".join(lines)

    session_files = {}
    for k, v in skills_files.items():
        if any(f"skills/{s.dir_name}/" in k for s in filtered_skills):
            session_files[k] = v

    return session_listing, session_files, skill_tools


def merge_function_filter(
    function_filter: list[str] | None,
    skill_tools: list[str],
    allowed_skills: list[str] | None,
) -> list[str] | None:
    """Merge skill-declared allowed-tools into a function filter.

    When ``function_filter`` is ``None`` and skills declare tools,
    the skill tools become the filter (rather than allowing everything).
    Also injects ``skills.*`` so the agent can read skill instructions.
    """
    if not allowed_skills or not skill_tools:
        return function_filter
    skill_tools = list(skill_tools)  # Don't mutate the caller's list.
    skill_tools.append("skills.*")
    if function_filter is not None:
        return list(dict.fromkeys(function_filter + skill_tools))
    # Template has no functions field — skill-declared tools
    # become the sole filter.
    return list(dict.fromkeys(skill_tools))
