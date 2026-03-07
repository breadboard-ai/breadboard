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
from collections.abc import AsyncIterator
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


def _build_skill_instruction(skills: list[Skill]) -> str:
    """Build the meta-instruction for the skilled agent."""
    skill_catalog = "\n".join(
        f"  - **{s.name}**: {s.description}" for s in skills
    )

    return f"""\
You are a skilled agent. Your capabilities are defined by *skills* —
structured documents that describe a specific capability, including what
it does, when to use it, and step-by-step instructions.

## Skills

Skills are stored in your file system under `{SKILLS_DIR}/`.
You can read any skill file to learn its full instructions.

### Available Skills

{skill_catalog}

## How to Use Skills

1. Review the objective and identify which skill(s) are relevant.
2. Read the skill file using `system_read_text_from_file` to get the
   full instructions.
3. Follow the instructions in the skill to accomplish the objective.
4. Write output files using `system_write_file`.
5. When the objective is fulfilled, call `system_objective_fulfilled`.
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
) -> AsyncIterator[AgentEvent]:
    """Run a skill-driven agent.

    Args:
        objective: The user's objective (plain text).
        skills: Pre-loaded skills to make available to the agent.
        backend: Backend client for Gemini API calls.
        flags: Optional feature flags.

    Yields:
        Typed ``AgentEvent`` instances.
    """
    resolved_flags = flags or {}

    file_system = AgentFileSystem()
    task_tree_manager = TaskTreeManager(file_system)
    controller = LoopController()

    # Pre-load skills into the file system.
    for skill in skills:
        slug = _slug(skill.name)
        filename = f"skills/{slug}.md"
        file_system.write(filename, skill.content)

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

    # Override the system instruction with the skill-aware one.
    skill_instruction = _build_skill_instruction(skills)
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
                        if fd.path.startswith("skills/"):
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
