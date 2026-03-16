# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""UI Generator — pipeline actions.

This module defines the complete ticket lifecycle for the ui-generator skill.
Loading this skill registers all of these actions automatically.

Ticket chain:

    ui_generation (RESOLVED) → write files → create ui_build
    ui_build      (OPEN)     → compile via build service
    ui_build      (RESOLVED) → create ui_review for user
    ui_review     (DENIED)   → supersede old root, begat new chain with feedback
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from pipeline import action
from tickets import Status

if TYPE_CHECKING:
    from tickets import Ticket, TicketStore

logger = logging.getLogger(__name__)


# ─── Generation ──────────────────────────────────────────────────────────────

def _has_resolution(ticket: Ticket, store: TicketStore) -> bool:
    """Gate: ticket has a non-empty resolution."""
    return bool(ticket.resolution)


def _has_buildable_files(ticket: Ticket, store: TicketStore) -> bool:
    """Gate: the source generation ticket has parseable files."""
    source_id = int(ticket.metadata.get("source_ticket", "0"))
    source = store.get(source_id)
    if not source or not source.resolution:
        return False
    try:
        files = json.loads(source.resolution)
        return isinstance(files, dict) and len(files) > 0
    except (json.JSONDecodeError, TypeError):
        return False


def _has_feedback(ticket: Ticket, store: TicketStore) -> bool:
    """Gate: ticket has a parent root to supersede."""
    return ticket.parent_id is not None and store.get(ticket.parent_id) is not None


@action(
    name="generation_complete",
    description="When UI generation resolves → write files → auto-build",
    on=("ui_generation", Status.RESOLVED),
    skill="ui-generator",
    when=_has_resolution,
    priority=0,
)
async def on_generation_resolved(ticket: Ticket, store: TicketStore) -> None:
    """Generation complete → write files → auto-create build ticket."""
    try:
        files: dict[str, str] = json.loads(ticket.resolution)
    except (json.JSONDecodeError, TypeError):
        logger.error("Generation ticket #%d has invalid resolution", ticket.id)
        return

    # Persist generated files as attachments.
    att = store.attachments(ticket.id)
    for path, content in files.items():
        dest = att / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)

    # Auto-create build ticket (no approval gate — build runs immediately).
    file_list = ", ".join(files.keys())
    await store.create(
        type="ui_build",
        body=f"Build {len(files)} generated files: {file_list}",
        parent_id=ticket.parent_id,
        metadata={"source_ticket": str(ticket.id), "file_count": str(len(files))},
        assigned_to="Build Service",
    )


# ─── Build ───────────────────────────────────────────────────────────────────

@action(
    name="build_started",
    description="When build ticket is created → compile via NotSoSafeSandbox",
    on=("ui_build", Status.OPEN),
    skill="ui-generator",
    when=_has_buildable_files,
    priority=0,
)
async def on_build_created(ticket: Ticket, store: TicketStore) -> None:
    """Build ticket created → compile via NotSoSafeSandbox → resolve."""
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "client"))
    from sandbox.transport import HttpTransport
    from sandbox.client import NotSoSafeSandbox

    # Find the source generation ticket.
    source_id = int(ticket.metadata.get("source_ticket", "0"))
    source = store.get(source_id)
    if not source or not source.resolution:
        await store.update_status(ticket.id, Status.DENIED, "Source generation ticket not found")
        return

    try:
        files = json.loads(source.resolution)
    except (json.JSONDecodeError, TypeError):
        await store.update_status(ticket.id, Status.DENIED, "Invalid source files")
        return

    await store.update_status(ticket.id, Status.IN_PROGRESS, "Compiling...")

    # Run the esbuild capability via NotSoSafeSandbox.
    sandbox = NotSoSafeSandbox(HttpTransport(base_url="http://localhost:50052"))
    try:
        result = sandbox.run("esbuild", files)
    except Exception as e:
        logger.exception("NotSoSafeSandbox call failed")
        await store.update_status(ticket.id, Status.DENIED, f"Build failed: {e}")
        return

    if not result.ok:
        await store.update_status(ticket.id, Status.DENIED, f"Build error: {result.error}")
        return

    bundle = result.output.get("bundle.cjs", "")

    # Persist the compiled bundle as an attachment.
    att = store.attachments(ticket.id)
    (att / "bundle.cjs").write_text(bundle)

    await store.resolve(ticket.id, bundle, f"Built successfully ({len(bundle)} bytes)")


@action(
    name="build_complete",
    description="When build resolves → create review ticket for user",
    on=("ui_build", Status.RESOLVED),
    skill="ui-generator",
    when=_has_resolution,
    priority=0,
)
async def on_build_resolved(ticket: Ticket, store: TicketStore) -> None:
    """Build complete → create user review ticket ("are you happy?")."""
    bundle_size = len(ticket.resolution) if ticket.resolution else 0

    await store.create(
        type="ui_review",
        body=f"Review the generated UI ({bundle_size} bytes). Are you happy with the result?",
        parent_id=ticket.parent_id,
        metadata={"build_ticket": str(ticket.id)},
        status=Status.AWAITING_APPROVAL,
        assigned_to="User",
    )


# ─── Review ──────────────────────────────────────────────────────────────────

@action(
    name="review_rejected",
    description="When user rejects → create new generation with feedback",
    on=("ui_review", Status.DENIED),
    skill="ui-generator",
    when=_has_feedback,
    priority=0,
)
async def on_review_denied(ticket: Ticket, store: TicketStore) -> None:
    """User rejected → old root superseded, new root begat with feedback."""
    feedback = ticket.metadata.get("feedback", "")
    old_root = store.get(ticket.parent_id) if ticket.parent_id else None
    if not old_root:
        logger.error("Review ticket #%d has no parent root", ticket.id)
        return

    original_prompt = old_root.metadata.get("prompt", "")

    # Supersede the old root — it's now historical.
    await store.update_status(
        old_root.id, Status.SUPERSEDED,
        f"Superseded: user requested redo with feedback"
    )

    # Create the new root (begat from the old).
    revised_prompt = f"{original_prompt}\n\nUser feedback: {feedback}" if feedback else original_prompt
    new_root = await store.create(
        type="ui_request",
        body=revised_prompt,
        metadata={
            "prompt": revised_prompt,
            "predecessor_id": str(old_root.id),
            "original_prompt": original_prompt,
            "feedback": feedback,
        },
        assigned_to="User",
    )

    # Create a generation ticket under the new root.
    gen_ticket = await store.create(
        type="ui_generation",
        body=f"Generate React UI for: {revised_prompt}",
        parent_id=new_root.id,
        assigned_to="Gemini",
    )

    # Kick off Gemini in the background (import here to avoid circular).
    import asyncio
    from server import _run_generation
    asyncio.create_task(_run_generation(gen_ticket.id, revised_prompt))
