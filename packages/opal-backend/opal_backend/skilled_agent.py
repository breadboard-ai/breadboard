# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Skilled Agent — a generic, skill-driven agent.

Like the standard Opal agent (``run.py``) but parameterized by *skills*.
Skills are markdown documents with YAML front matter that describe
capabilities. They are pre-loaded into the agent's file system and
cataloged in the system instruction so the agent knows what's available.

The agent can read skill files at runtime using ``system_read_text_from_file``
and produce artifacts using ``system_write_file``.

Function groups: system + generate. Chat is flag-gated.
No memory, no image/video/audio generation.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

from .agent_events import AgentEventSink, build_hooks_from_sink
from .agent_file_system import AgentFileSystem
from .backend_client import BackendClient
from .events import AgentEvent, AgentResult, CompleteEvent, ErrorEvent
from .function_definition import FunctionGroup
from .functions.generate import get_generate_function_group
from .functions.system import get_system_function_group
from .loop import AgentRunArgs, Loop, LoopController
from .task_tree_manager import TaskTreeManager

__all__ = ["Skill", "run_skilled_agent"]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Skill data type
# ---------------------------------------------------------------------------

SKILLS_DIR = "/mnt/skills"
REFERENCES_DIR = "/mnt/references"


@dataclass
class Skill:
    """A skill the agent can use.

    Attributes:
        name: Human-readable skill name (from front matter).
        description: One-line summary (from front matter).
        content: Full markdown content including front matter.
    """

    name: str
    description: str
    content: str


def _slug(name: str) -> str:
    """Convert a skill name to a filesystem-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_skill_front_matter(text: str) -> tuple[str, str]:
    """Extract name and description from YAML front matter.

    Expects the format:
        ---
        name: Skill Name
        description: One-line description.
        ---

    Returns (name, description). Falls back to ("Untitled", "") if
    front matter is missing.
    """
    match = re.match(r"^---\s*\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return ("Untitled", "")
    block = match.group(1)
    name = ""
    desc = ""
    for line in block.splitlines():
        if line.startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("description:"):
            desc = line.split(":", 1)[1].strip()
    return (name or "Untitled", desc)


# ---------------------------------------------------------------------------
# System instruction
# ---------------------------------------------------------------------------


def _build_skill_instruction(
    skills: list[Skill],
    skills_dir: str = SKILLS_DIR,
) -> str:
    """Build the meta-instruction for the skilled agent."""
    skill_catalog = "\n".join(
        f"  - **{s.name}**: {s.description}" for s in skills
    )
    references_dir = skills_dir.rsplit("/", 1)[0] + "/references"

    return f"""\
You are an Executive Assistant. Your job is to help users accomplish
their objectives by producing something they can actually use. You
figure out how to help, not just what was asked.

You are invisible in what you produce. Never brand, credit, or
reference yourself, your role, or your skills in the output. No
"by EA", no "Powered by [Skill Name]", no attribution footers.
The result should feel like it was made *for the user*, not *by you*.

You have *skills* that teach you how to solve challenges. Skills are
structured documents describing a specific capability: what it does,
when to use it, and how to follow through. They are your tools, not
your outputs.

## Your Skills

Skills are stored under `{skills_dir}/`. Read any skill file using
`system_read_text_from_file` when you need its instructions.

{skill_catalog}

Skills come in different kinds:

- **Shape skills** plan the *structure* of what you build (e.g.,
  Journey Architect designs a multi-screen state machine).
- **Output skills** define *how to produce* results (e.g., UI
  Component Generation creates React component bundles).
- **Domain skills** capture *what to say* — expertise grounded in
  reference material for a specific domain.
- **Meta skills** help you create other skills (e.g., Skill Author).

## How You Work

### 1. Ground Yourself

Read any reference material in `{references_dir}/`. This gives you
domain context before making decisions.

### 2. Plan

Answer two questions simultaneously:

**Task shape:** Is this a single screen or a multi-step journey?
- Single screen: one view, no navigation.
- Journey: the user moves through states to reach an outcome.

**Domain knowledge:** Do you have domain skills for this objective,
or do you need to create them? Some objectives span multiple
domains — each gap is a separate skill.

These questions inform each other.

### 3. Build

Use the skills you need — possibly several — to produce the result.
A journey needs both the Journey Architect (to plan the flow) AND
an output skill (to build the visible result). A domain skill may
be needed for either.

**The test:** Can the user interact with what you produced? A JSON
spec, a markdown document, or a domain skill is never the final
deliverable on its own. The user asked for help — give them
something they can see, click, or use.

Write files using `system_write_file`. When the user has something
usable, call `system_objective_fulfilled`.

### Self-Teaching

When you identify a domain knowledge gap, read the Skill Author
skill (`{skills_dir}/teacher/SKILL.md`) and write a new SKILL.md.
It will be auto-installed for future runs — you only need to
self-teach once per domain.

Skills are stored as markdown files in `{skills_dir}/`.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def run_skilled_agent(
    *,
    objective: str,
    skills: list[Skill],
    backend: BackendClient,
    flags: dict[str, Any] | None = None,
    pre_loaded_files: dict[str, str] | None = None,
    extra_groups: list[FunctionGroup] | None = None,
    function_groups: Callable[[LoopController], list[FunctionGroup]] | None = None,
    skills_dir: str = SKILLS_DIR,
    system_instruction: str | None = None,
) -> AsyncIterator[AgentEvent]:
    """Run a skill-driven agent.

    Args:
        objective: The user's objective (plain text).
        skills: Pre-loaded skills to make available to the agent.
        backend: Backend client for Gemini API calls.
        flags: Optional feature flags.
        pre_loaded_files: Optional dict of path -> content to pre-load
            into the agent's file system (e.g., previous components).
        extra_groups: Deprecated. Use function_groups instead.
        function_groups: Optional factory that receives a LoopController
            and returns the complete list of FunctionGroups. When
            provided, built-in environment assembly (AgentFileSystem,
            TaskTreeManager, built-in groups) is skipped.
        system_instruction: Optional override for the system instruction.
            When provided, replaces the default skill-aware instruction.

    Yields:
        Typed ``AgentEvent`` instances.
    """
    resolved_flags = flags or {}
    controller = LoopController()
    pre_loaded_prefixes: list[str] = ["skills/", "library/"]

    if function_groups is not None:
        # Caller-owned groups: skip built-in assembly.
        groups = function_groups(controller)
    else:
        # Built-in assembly (default path).
        file_system = AgentFileSystem()
        task_tree_manager = TaskTreeManager(file_system)

        # Pre-load skills into the file system.
        for skill in skills:
            slug = _slug(skill.name)
            filename = f"skills/{slug}.md"
            file_system.write(filename, skill.content)

        # Pre-load additional files (e.g., previous components for reuse).
        if pre_loaded_files:
            for path, content in pre_loaded_files.items():
                file_system.write(path, content)

        # Build function groups.
        groups: list[FunctionGroup] = [
            get_system_function_group(
                controller,
                file_system=file_system,
                task_tree_manager=task_tree_manager,
            ),
            get_generate_function_group(
                file_system=file_system,
                task_tree_manager=task_tree_manager,
                backend=backend,
            ),
        ]

        # Chat is flag-gated.
        if resolved_flags.get("enableChat", False):
            from .functions.chat import get_chat_function_group

            groups.append(
                get_chat_function_group(
                    task_tree_manager=task_tree_manager,
                    file_system=file_system,
                )
            )

        # Append caller-provided extra groups (deprecated path).
        if extra_groups:
            groups.extend(extra_groups)

    # Override the system instruction with the skill-aware one.
    # This applies to both paths — the meta-instruction stays with
    # run_skilled_agent regardless of who built the groups.
    skill_instruction = system_instruction or _build_skill_instruction(
        skills, skills_dir=skills_dir,
    )
    groups[0] = FunctionGroup(
        definitions=groups[0].definitions,
        declarations=groups[0].declarations,
        instruction=skill_instruction,
    )

    objective_content = {
        "parts": [{"text": f"<objective>{objective}</objective>"}],
        "role": "user",
    }

    run_args = AgentRunArgs(
        objective=objective_content,
        function_groups=groups,
    )

    # Run the loop and yield events.
    sink = AgentEventSink()
    run_args.hooks = build_hooks_from_sink(sink)

    loop = Loop(
        backend=backend,
        controller=controller,
    )

    async def execute():
        """Run the loop and emit terminal events."""
        try:
            result = await loop.run(run_args)

            if isinstance(result, dict) and "$error" in result:
                sink.emit(ErrorEvent(message=result["$error"]))
                sink.emit(CompleteEvent(
                    result=AgentResult(success=False),
                ))
            elif isinstance(result, AgentResult):
                # Strip /mnt/ prefix and filter out pre-loaded skill files.
                if result.intermediate:
                    filtered = []
                    for fd in result.intermediate:
                        if fd.path.startswith("/mnt/"):
                            fd.path = fd.path[len("/mnt/"):]
                        if any(
                            fd.path.startswith(p)
                            for p in pre_loaded_prefixes
                        ):
                            continue
                        filtered.append(fd)
                    result.intermediate = filtered or None
                sink.emit(CompleteEvent(result=result))
            else:
                sink.emit(ErrorEvent(
                    message=f"Unexpected result: {result}"
                ))
        except Exception as e:
            logger.exception("Skilled agent loop failed")
            sink.emit(ErrorEvent(message=str(e)))
        finally:
            sink.close()

    loop_task = asyncio.create_task(execute())
    try:
        async for event in sink:
            yield event
    finally:
        if not loop_task.done():
            loop_task.cancel()
