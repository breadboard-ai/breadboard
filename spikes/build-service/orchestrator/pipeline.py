# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Declarative ticket pipeline — three-stage evaluation.

Actions self-declare their triggers with ``@action``.  The pipeline evaluates
them in three stages when a ticket transitions:

  1. **Registration** (``skill=``): action only exists if its skill(s) are
     loaded. Controlled at boot — if the skill isn't in the agent's toolbox,
     the action is never registered.

  2. **Matching** (``on=``): the ``(ticket_type, status)`` tuple is an indexed
     lookup.  Only actions whose ``on`` matches the transition are evaluated.

  3. **Relevance** (``when=``): a cheap predicate that inspects the ticket and
     its context.  Only when this returns ``True`` does the expensive work
     (sandbox call, ticket creation) begin.

Actions that pass all three stages are sorted by ``priority`` (higher wins)
and executed in order.

Usage::

    @action(
        name="build_started",
        on=("ui_build", Status.OPEN),
        skill="ui-generator",
        when=lambda t, s: has_buildable_files(t, s),
        priority=1,
        sandbox="esbuild",
    )
    async def on_build_created(ticket, store):
        ...
"""

from __future__ import annotations

import importlib.util
import inspect
import logging
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, TYPE_CHECKING

from tickets import Status

if TYPE_CHECKING:
    from tickets import Ticket, TicketStore, LifecycleHook

__all__ = ["action", "discover", "register"]

logger = logging.getLogger(__name__)

# Sentinel attribute name stamped on decorated handlers.
_ACTION_ATTR = "_pipeline_trigger"

# Type alias for the relevance predicate.
WhenPredicate = Callable[["Ticket", "TicketStore"], bool]


# ─── Trigger Definition ─────────────────────────────────────────────────────

@dataclass(frozen=True)
class Trigger:
    """A declarative pipeline step with three-stage evaluation.

    - ``skill``: which skill(s) must be loaded for this action to exist.
    - ``on``: ``(ticket_type, status)`` — the indexed matching key.
    - ``when``: relevance predicate — cheap guard before expensive work.
    - ``priority``: execution order (higher wins, default 0).
    """
    name: str
    description: str
    ticket_type: str
    on_status: Status
    handler: LifecycleHook
    skill: list[str] = field(default_factory=list)
    when: WhenPredicate | None = None
    priority: int = 0


# ─── @action Decorator ──────────────────────────────────────────────────────

def action(
    *,
    name: str,
    description: str = "",
    on: tuple[str, Status],
    skill: str | list[str] | None = None,
    when: WhenPredicate | None = None,
    priority: int = 0,
) -> callable:
    """Decorator that co-locates trigger metadata with its handler.

    Three-stage evaluation pipeline::

        @action(
            name="build_started",
            on=("ui_build", Status.OPEN),
            skill="ui-generator",                      # Stage 1: registration
            when=lambda t, s: has_files(t, s),          # Stage 3: relevance
            priority=1,                                 # execution order
        )
        async def on_build_created(ticket, store):
            ...

    Args:
        name: Human-readable trigger name.
        description: What this action does.
        on: ``(ticket_type, status)`` — the event to match.
        skill: Skill name(s) that must be loaded for this action to be
            registered. ``None`` means always registered.
        when: Predicate ``(ticket, store) -> bool`` evaluated before
            execution. ``None`` means always relevant.
        priority: Execution order among matching actions (higher wins).
    """
    ticket_type, on_status = on

    # Normalise skill to a list.
    if skill is None:
        skill_list: list[str] = []
    elif isinstance(skill, str):
        skill_list = [skill]
    else:
        skill_list = list(skill)

    def decorator(fn: LifecycleHook) -> LifecycleHook:
        setattr(fn, _ACTION_ATTR, Trigger(
            name=name,
            description=description,
            ticket_type=ticket_type,
            on_status=on_status,
            handler=fn,
            skill=skill_list,
            when=when,
            priority=priority,
        ))
        return fn
    return decorator


# ─── Discovery ──────────────────────────────────────────────────────────────

SKILLS_DIR = Path(__file__).resolve().parent / "skills"


def discover_skill_actions() -> list[ModuleType]:
    """Find all ``actions.py`` modules inside skill directories.

    Scans ``skills/*/actions.py``.
    """
    modules: list[ModuleType] = []
    if not SKILLS_DIR.is_dir():
        return modules

    for actions_path in sorted(SKILLS_DIR.glob("*/actions.py")):
        skill_slug = actions_path.parent.name
        module_name = f"skills.{skill_slug}.actions"
        spec = importlib.util.spec_from_file_location(module_name, actions_path)
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            modules.append(mod)
            logger.info("Skill '%s': loaded actions module", skill_slug)

    return modules


def discover(*modules: ModuleType) -> list[Trigger]:
    """Collect all ``@action``-decorated triggers from the given modules."""
    triggers: list[Trigger] = []
    for module in modules:
        for _name, obj in inspect.getmembers(module, inspect.isfunction):
            trigger = getattr(obj, _ACTION_ATTR, None)
            if trigger is not None:
                triggers.append(trigger)
    return triggers


# ─── Evaluation Helpers ─────────────────────────────────────────────────────


def prioritise(triggers: list[Trigger]) -> list[Trigger]:
    """Sort triggers by priority (higher first)."""
    return sorted(triggers, key=lambda t: t.priority, reverse=True)


# ─── Registration ────────────────────────────────────────────────────────────


def _check_skill_gate(trigger: Trigger, ticket: Ticket) -> bool:
    """Stage 2: does this ticket's provenance match the action's skill requirement?

    If the action has no ``skill=``, it's **generic** — fires for any ticket.
    If the action has ``skill=``, it checks the ticket's ``agent_skills``
    metadata to see if the producing agent had those skills loaded.

    For now, if the ticket has no ``agent_skills`` metadata, skill-scoped
    actions pass by default (backwards compat with pre-provenance tickets).
    """
    if not trigger.skill:
        return True  # Generic action — always passes.

    agent_skills_raw = ticket.metadata.get("agent_skills", "")
    if not agent_skills_raw:
        # No provenance on this ticket — allow for backwards compat.
        return True

    # agent_skills is stored as comma-separated string in metadata.
    agent_skills = {s.strip() for s in agent_skills_raw.split(",") if s.strip()}
    return all(s in agent_skills for s in trigger.skill)


def register(store: TicketStore) -> None:
    """Discover all actions and wire them into the store.

    All actions are registered (no boot-time filtering). Per-ticket evaluation
    happens at runtime in three stages:

      1. ``on=`` matching (implicit — the store dispatches by type + status).
      2. Skill gate — check if the ticket's producing agent had the required skill.
      3. ``when=`` relevance predicate — cheap guard before expensive work.
      4. Priority sort — higher priority actions execute first.
    """
    action_modules = discover_skill_actions()
    all_triggers = discover(*action_modules)

    # Build a lookup from (ticket_type, status) → sorted triggers.
    from collections import defaultdict
    index: dict[tuple[str, Status], list[Trigger]] = defaultdict(list)
    for trigger in all_triggers:
        index[(trigger.ticket_type, trigger.on_status)].append(trigger)

    # Sort each group by priority (higher first).
    for key in index:
        index[key] = prioritise(index[key])

    # Wire up lifecycle hooks. Each hook evaluates per-ticket:
    # skill gate → when predicate → execute in priority order.
    for key, key_triggers in index.items():

        def _make_handler(triggers: list[Trigger]):
            async def handler(ticket: Ticket, store: TicketStore) -> None:
                for t in triggers:
                    # Stage 2: skill gate (per-ticket provenance).
                    if not _check_skill_gate(t, ticket):
                        logger.debug(
                            "Pipeline: %s skipped (skill gate: %s not in agent skills)",
                            t.name, t.skill,
                        )
                        continue

                    # Stage 3: relevance predicate.
                    if t.when is not None:
                        try:
                            if not t.when(ticket, store):
                                logger.debug(
                                    "Pipeline: %s skipped (when=False)", t.name
                                )
                                continue
                        except Exception:
                            logger.exception(
                                "Relevance predicate failed for '%s'", t.name
                            )
                            continue

                    logger.info("Pipeline: firing '%s' (priority=%d)", t.name, t.priority)
                    await t.handler(ticket, store)
            return handler

        store.on(key[0], key[1], _make_handler(key_triggers))

    # Log what's registered.
    for trigger in all_triggers:
        logger.info(
            "Pipeline: %s.%s → %s (priority=%d, skill=%s, when=%s)",
            trigger.ticket_type,
            trigger.on_status.value,
            trigger.name,
            trigger.priority,
            trigger.skill or "generic",
            "yes" if trigger.when else "no",
        )

