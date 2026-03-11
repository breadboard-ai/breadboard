# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Journey Router — orchestration for multi-step journeys.

The router is pure orchestration. It does NOT decide what the journey
looks like — the agent does, via the journey-architect skill (for
planning) and the ui-generator skill (for each step's UI).

Flow:
  1. User says "Help me plan an offsite"
  2. Router calls run_skilled_agent with that objective
  3. Agent uses journey-architect to produce a journey.json (XState plan)
  4. Router parses the plan → list of JourneySteps
  5. For each user-facing step, router calls run_skilled_agent again
  6. Agent uses ui-generator to produce the React bundle for that step,
     guided by the step's meta.purpose and meta.displays
  7. Router stores the artifacts and manages state transitions
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from collections.abc import Callable
from pathlib import Path

from ark_backend.world_model import JourneyStep, WorldModel

logger = logging.getLogger(__name__)

OUT_DIR = Path(__file__).resolve().parent.parent.parent / "out"


def _get_api_key() -> str:
    """Read GEMINI_API_KEY at call time (after load_dotenv)."""
    return os.environ.get("GEMINI_API_KEY", "")


@dataclass
class JourneyUpdate:
    """Result of advancing a journey's state."""

    journey_id: str
    new_state: str | None
    new_label: str
    view_available: bool
    complete: bool
    context: dict


@dataclass
class ProjectionInfo:
    """What to show the user right now for a journey."""

    journey_id: str
    state_id: str
    label: str
    view_files: list[str]
    step_index: int
    total_steps: int
    context: dict


# ─── Agent Interface ──────────────────────────────────────────────────────────


def _load_skills():
    """Discover skills from backend/skills/*/SKILL.md."""
    from ark_backend.skill_loader import load_skills
    return [ls.skill for ls in load_skills()]


def _load_references() -> dict[str, str]:
    """Pre-load reference material from backend/references/."""
    pre_loaded: dict[str, str] = {}
    refs_dir = Path(__file__).resolve().parent.parent / "references"
    if refs_dir.is_dir():
        for ref_file in sorted(refs_dir.rglob("*.md")):
            if "/_staging/" in str(ref_file) or ref_file.parent.name == "_staging":
                continue
            key = f"references/{ref_file.relative_to(refs_dir)}"
            pre_loaded[key] = ref_file.read_text()
    return pre_loaded


async def _call_agent(
    objective: str,
    output_dir: Path,
    on_progress: Callable[[str], None] | None = None,
) -> list[str]:
    """Call the skilled agent and collect output files.

    Args:
        objective: What the agent should do.
        output_dir: Where to write output files.
        on_progress: Optional callback for real-time progress updates.
    """
    from ark_backend.gemini_client import ApiKeyBackendClient
    from opal_backend.skilled_agent import run_skilled_agent

    skills = _load_skills()
    if not skills:
        logger.warning("No skills found")
        return []

    backend = ApiKeyBackendClient(api_key=_get_api_key())
    pre_loaded = _load_references()

    output_dir.mkdir(parents=True, exist_ok=True)
    artifacts: list[str] = []

    try:
        async for event in run_skilled_agent(
            objective=objective,
            skills=skills,
            backend=backend,
            pre_loaded_files=pre_loaded if pre_loaded else None,
        ):
            etype = getattr(event, "type", "unknown")

            if etype == "thought" and on_progress:
                text = getattr(event, "text", "")
                if text:
                    on_progress(text[:120])
            elif etype == "functionCall" and on_progress:
                name = getattr(event, "name", "")
                if name:
                    on_progress(f"Working: {name}…")
            elif etype == "complete":
                result = getattr(event, "result", None)
                if result and getattr(result, "intermediate", None):
                    for file_data in result.intermediate:
                        dest = output_dir / file_data.path.lstrip("/")
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        content = file_data.content
                        parts = (
                            content.get("parts", [])
                            if isinstance(content, dict)
                            else []
                        )
                        text = parts[0].get("text", "") if parts else ""
                        dest.write_text(text if text else str(content))
                        artifacts.append(str(dest.relative_to(output_dir)))

        logger.info("Agent produced %d files in %s", len(artifacts), output_dir)
    except Exception:
        logger.exception("Agent call failed for objective: %s", objective[:80])

    return artifacts


# ─── Plan Parsing ─────────────────────────────────────────────────────────────


def _parse_journey_plan(plan_dir: Path) -> list[JourneyStep]:
    """Parse a journey.json produced by the journey-architect skill.

    The journey.json describes segments — each segment is a multi-view
    mini-app. We map each segment to a JourneyStep for the router.
    """
    journey_file = plan_dir / "journey.json"
    if not journey_file.is_file():
        logger.warning("No journey.json found in %s", plan_dir)
        return []

    try:
        spec = json.loads(journey_file.read_text())
    except json.JSONDecodeError:
        logger.exception("Failed to parse journey.json")
        return []

    segments = spec.get("segments", [])
    steps: list[JourneyStep] = []

    for segment in segments:
        steps.append(JourneyStep(
            id=segment.get("id", f"segment_{len(steps)}"),
            label=segment.get("purpose", "Working on it"),
            needs_user=True,  # All segments need user interaction.
        ))

    if not steps:
        logger.warning("No segments in journey.json, using fallback")
        steps = [
            JourneyStep(id="main", label="Working on it", needs_user=True),
        ]

    return steps


# ─── Router ───────────────────────────────────────────────────────────────────


async def start_journey(world: WorldModel, objective: str) -> str:
    """Create a journey and schedule generation as a background task.

    Returns the journey ID immediately. The LLM work (planning +
    segment UI generation) runs in the background. The frontend polls
    GET /journeys/{id}/status until views are ready.

    Must be async so asyncio.create_task has access to the event loop.
    """
    import asyncio

    if not _get_api_key():
        logger.warning("No GEMINI_API_KEY — cannot start journey")
        journey = world.create_journey(objective, [
            JourneyStep(id="waiting", label="Waiting for API key", needs_user=True),
        ])
        world.save()
        return journey.id

    # Create the journey immediately with a "planning" status.
    journey = world.create_journey(objective, [])
    journey.status = "planning"
    world.save()

    # Schedule generation as a background task.
    asyncio.create_task(_generate_journey(world, journey.id, objective))

    logger.info("Created journey %s, generation scheduled", journey.id)
    return journey.id


async def _generate_journey(
    world: WorldModel, journey_id: str, objective: str
) -> None:
    """Background task: plan the journey, then generate segment UIs.

    The agent typically produces both journey.json AND UI artifacts in a
    single call (the skills work together). So after Phase 1 we check
    whether the plan directory already has an App.jsx — if so, we use
    those files directly for the first segment. Only subsequent segments
    need separate agent calls.
    """
    journey = world.get_journey(journey_id)
    if journey is None:
        return

    try:
        # Progress callback — updates the journey's detail in real-time.
        def _on_progress(detail: str):
            journey.current_detail = detail
            # Don't save to disk on every thought — just update in memory.
            # The status endpoint reads from memory.

        # Phase 1: Ask the agent to plan the journey.
        plan_dir = OUT_DIR / "_plans" / objective[:40].replace(" ", "-").lower()
        plan_artifacts = await _call_agent(objective, plan_dir, on_progress=_on_progress)

        # Phase 2: Parse the plan into segments.
        steps = _parse_journey_plan(plan_dir)
        if not steps:
            steps = [JourneyStep(id="main", label="Working on it", needs_user=True)]

        journey.steps = steps
        journey.status = "generating"
        world.save()

        # Phase 3: Wire up UI artifacts for each segment.
        journey_dir = OUT_DIR / f"journey-{journey_id}"
        plan_has_ui = (plan_dir / "App.jsx").is_file()

        for i, step in enumerate(steps):
            if not step.needs_user:
                continue

            step_dir = journey_dir / step.id
            step_dir.mkdir(parents=True, exist_ok=True)

            if i == 0 and plan_has_ui:
                # First segment: the plan call already produced UI.
                # Scan the plan directory for UI files and copy them.
                import shutil
                ui_exts = {".jsx", ".css"}
                for src in plan_dir.rglob("*"):
                    if not src.is_file() or src.suffix not in ui_exts:
                        continue
                    rel = src.relative_to(plan_dir)
                    dst = step_dir / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
                    step.view_files.append(str(rel))
                logger.info(
                    "Segment %s: copied %d UI files from plan",
                    step.id, len(step.view_files),
                )
            else:
                # Subsequent segments need a separate agent call.
                step_prompt = (
                    f"This is segment '{step.label}' in a multi-step journey "
                    f"for: {objective}"
                )
                step.view_files = await _call_agent(
                    step_prompt, step_dir, on_progress=_on_progress,
                )

            # After generating the first segment, mark as active.
            if journey.status == "generating":
                journey.status = "active"
                world.save()

        world.save()
        logger.info("Journey %s fully generated (%d segments)", journey_id, len(steps))

    except Exception as exc:
        logger.exception("Journey %s generation failed", journey_id)
        # Extract a human-friendly message from the exception.
        msg = str(exc)
        if "503" in msg:
            journey.error_message = "The AI service is temporarily overloaded. Try again in a moment."
        elif "429" in msg:
            journey.error_message = "Rate limited — too many requests. Try again shortly."
        else:
            journey.error_message = "Generation failed. You can retry."
        journey.status = "error"
        world.save()


async def retry_journey(world: WorldModel, journey_id: str) -> None:
    """Reset a failed journey and re-trigger generation."""
    journey = world.get_journey(journey_id)
    if journey is None:
        raise ValueError(f"Journey {journey_id} not found")

    if journey.status != "error":
        raise ValueError(f"Journey {journey_id} is not in error state")

    # Reset to planning state.
    journey.status = "planning"
    journey.error_message = ""
    journey.current_detail = ""
    journey.steps.clear()
    journey.current_step_index = 0
    world.save()

    # Re-trigger background generation.
    asyncio.create_task(_generate_journey(world, journey_id, journey.objective))


async def submit_result(
    world: WorldModel, journey_id: str, payload: dict
) -> JourneyUpdate:
    """Absorb a user result, advance the state machine."""
    journey = world.get_journey(journey_id)
    if journey is None:
        raise ValueError(f"Journey {journey_id} not found")

    if journey.is_complete:
        raise ValueError(f"Journey {journey_id} is already complete")

    journey.context.update(payload)
    journey.current_step_index += 1

    # Auto-advance through non-user steps.
    while journey.current_step and not journey.current_step.needs_user:
        step = journey.current_step
        journey.status = "processing"
        world.save()
        logger.info("Auto-advancing past '%s'", step.id)
        if step.auto_delay_seconds > 0:
            await asyncio.sleep(step.auto_delay_seconds)
        journey.current_step_index += 1

    # Past the last step → complete.
    if journey.current_step_index >= len(journey.steps):
        journey.status = "complete"
        world.save()
        return JourneyUpdate(
            journey_id=journey_id,
            new_state=None,
            new_label="Complete",
            view_available=False,
            complete=True,
            context=journey.context,
        )

    # If this step's view wasn't pre-produced (or needs context from
    # earlier steps), generate it now.
    step = journey.current_step
    if step.needs_user and not step.view_files:
        journey.status = "processing"
        world.save()

        step_prompt = (
            f"This is step '{step.label}' in a multi-step journey "
            f"for: {journey.objective}. "
            f"The user has provided this context so far: {journey.context}"
        )
        step_dir = OUT_DIR / f"journey-{journey_id}" / step.id
        step.view_files = await _call_agent(step_prompt, step_dir)

    journey.status = "active"
    world.save()

    return JourneyUpdate(
        journey_id=journey_id,
        new_state=step.id,
        new_label=step.label,
        view_available=bool(step.view_files),
        complete=False,
        context=journey.context,
    )


def get_projection(world: WorldModel, journey_id: str) -> ProjectionInfo | None:
    """Get the current view to show the user."""
    journey = world.get_journey(journey_id)
    if journey is None or journey.is_complete:
        return None

    step = journey.current_step
    if step is None or not step.needs_user:
        return None

    return ProjectionInfo(
        journey_id=journey_id,
        state_id=step.id,
        label=step.label,
        view_files=step.view_files,
        step_index=journey.current_step_index,
        total_steps=len(journey.steps),
        context=journey.context,
    )
