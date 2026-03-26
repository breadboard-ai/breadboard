# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:drain CLI — run tickets in dependency-aware waves.

Usage::

    npm run ticket:drain -w packages/bees
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone

import httpx

from bees.session import (
    SessionResult,
    clear_session_state,
    extract_files,
    load_gemini_key,
    resume_session,
    run_session,
)
from bees.ticket import (
    Ticket,
    _DEP_PATTERN,
    load_ticket,
    list_tickets,
)
from opal_backend.local.backend_client_impl import HttpBackendClient
import httpx


async def _run_ticket(
    ticket: Ticket,
    *,
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
    on_event: Any | None = None,
) -> SessionResult:
    """Run a single ticket's session and update its metadata."""
    ticket.metadata.status = "running"
    ticket.save_metadata()

    label = ticket.id[:8]
    print(f"▶ [{label}] {ticket.objective!r}", file=sys.stderr)

    try:
        segments = resolve_segments(ticket)
        result = await run_session(
            segments=segments,
            http=http,
            backend=backend,
            label=label,
            ticket_dir=ticket.dir,
            on_event=on_event,
            function_filter=ticket.metadata.functions,
            allowed_skills=ticket.metadata.skills,
        )
    except Exception as exc:
        ticket.metadata.status = "failed"
        ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
        ticket.metadata.error = str(exc)
        ticket.save_metadata()
        print(f"  [{label}] ❌ {exc}", file=sys.stderr)
        return SessionResult(
            session_id="",
            status="failed",
            events=0,
            output="",
            error=str(exc),
        )

    # Update ticket metadata with session results.
    ticket.metadata.status = (
        "completed" if result.status == "completed" else "failed"
    )
    ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
    ticket.metadata.turns = result.turns
    ticket.metadata.thoughts = result.thoughts

    if result.error:
        ticket.metadata.error = result.error
    if result.outcome:
        ticket.metadata.outcome = result.outcome
    if result.outcome_content:
        ticket.metadata.outcome_content = result.outcome_content

    # Extract agent file system to ticket directory.
    file_manifest = extract_files(
        result.intermediate, ticket.dir / "filesystem",
    )
    if file_manifest:
        ticket.metadata.files = file_manifest

    # Handle suspend: hand off to user.
    if result.suspended:
        ticket.metadata.status = "suspended"
        ticket.metadata.assignee = "user"
        ticket.metadata.suspend_event = result.suspend_event
    else:
        ticket.metadata.assignee = None
        ticket.metadata.suspend_event = None

    ticket.save_metadata()
    return result


async def _resume_ticket(
    ticket: Ticket,
    *,
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
    on_event: Any | None = None,
) -> SessionResult:
    """Resume a suspended ticket with the user's response."""
    label = ticket.id[:8]
    print(f"▶ [{label}] resuming {ticket.objective!r}", file=sys.stderr)

    # Load the user's response.
    response_path = ticket.dir / "response.json"
    if not response_path.exists():
        ticket.metadata.status = "failed"
        ticket.metadata.error = "No response.json found for resume"
        ticket.save_metadata()
        return SessionResult(
            session_id="",
            status="failed",
            events=0,
            output="",
            error="No response found",
        )

    response = json.loads(response_path.read_text())

    ticket.metadata.status = "running"
    ticket.metadata.assignee = "agent"
    ticket.save_metadata()

    try:
        result = await resume_session(
            ticket_dir=ticket.dir,
            response=response,
            http=http,
            backend=backend,
            label=label,
            on_event=on_event,
        )
    except Exception as exc:
        ticket.metadata.status = "failed"
        ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
        ticket.metadata.error = str(exc)
        ticket.save_metadata()
        print(f"  [{label}] ❌ {exc}", file=sys.stderr)
        return SessionResult(
            session_id="",
            status="failed",
            events=0,
            output="",
            error=str(exc),
        )

    # Update ticket metadata.
    if not result.suspended:
        ticket.metadata.status = (
            "completed" if result.status == "completed" else "failed"
        )
        ticket.metadata.completed_at = datetime.now(timezone.utc).isoformat()
        clear_session_state(ticket.dir)
        # Clean up response file.
        response_path.unlink(missing_ok=True)

    ticket.metadata.turns += result.turns
    ticket.metadata.thoughts += result.thoughts

    if result.error:
        ticket.metadata.error = result.error
    if result.outcome:
        ticket.metadata.outcome = result.outcome
    if result.outcome_content:
        ticket.metadata.outcome_content = result.outcome_content

    # Extract agent file system.
    file_manifest = extract_files(
        result.intermediate, ticket.dir / "filesystem",
    )
    if file_manifest:
        ticket.metadata.files = file_manifest

    if (ticket.dir / "filesystem" / "bundle.js").is_file():
        ticket.metadata.bundle_path = "bundle.js"

    # Handle re-suspend.
    if result.suspended:
        ticket.metadata.status = "suspended"
        ticket.metadata.assignee = "user"
        ticket.metadata.suspend_event = result.suspend_event
    else:
        ticket.metadata.assignee = None
        ticket.metadata.suspend_event = None

    ticket.save_metadata()
    return result


async def drain() -> list[dict]:
    """Run tickets in dependency-aware waves.

    Each wave runs all available + resumable tickets in parallel.
    After a wave, blocked tickets whose dependencies are now met
    are promoted to available, and the next wave starts.
    """
    gemini_key = load_gemini_key()
    all_summaries: list[dict] = []
    wave = 0

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )

        while True:
            # Promote blocked tickets whose dependencies are now met.
            promoted = _promote_blocked_tickets()

            tickets = list_tickets(status="available")
            resumable = [
                t for t in list_tickets(status="suspended")
                if t.metadata.assignee == "agent"
            ]

            if not tickets and not resumable:
                if wave == 0:
                    # Check if there are blocked tickets with no hope.
                    blocked = list_tickets(status="blocked")
                    if blocked:
                        print(
                            f"No runnable tickets. "
                            f"{len(blocked)} blocked ticket(s) remain.",
                            file=sys.stderr,
                        )
                    else:
                        print(
                            "No available or resumable tickets.",
                            file=sys.stderr,
                        )
                break

            wave += 1
            total = len(tickets) + len(resumable)
            print(
                f"Wave {wave}: {len(tickets)} new + {len(resumable)} "
                f"resumable = {total} ticket(s)...",
                file=sys.stderr,
            )

            tasks = [
                _run_ticket(
                    ticket, http=http, backend=backend,
                )
                for ticket in tickets
            ] + [
                _resume_ticket(ticket, http=http, backend=backend)
                for ticket in resumable
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_tickets_in_wave = tickets + resumable
            for ticket, result in zip(all_tickets_in_wave, results):
                if isinstance(result, Exception):
                    all_summaries.append({
                        "ticket": ticket.id,
                        "status": "failed",
                        "error": str(result),
                    })
                else:
                    all_summaries.append({
                        "ticket": ticket.id,
                        "status": result.status,
                        "events": result.events,
                        "output": result.output,
                    })

    return all_summaries


def _promote_blocked_tickets() -> int:
    """Check blocked tickets and promote those whose deps are met.

    Returns the number of tickets promoted.
    """
    blocked = list_tickets(status="blocked")
    promoted = 0

    for ticket in blocked:
        deps = ticket.metadata.depends_on or []
        all_met = True
        any_failed = False

        print(f"Checking blocked ticket {ticket.id[:8]}, deps: {deps}", file=sys.stderr)
        for dep_id in deps:
            dep = load_ticket(dep_id)
            if dep is None:
                print(f"  Dep {dep_id[:8]} not found on disk", file=sys.stderr)
                all_met = False
                continue
            print(f"  Dep {dep_id[:8]} status: {dep.metadata.status}", file=sys.stderr)
            if dep.metadata.status == "completed":
                continue
            if dep.metadata.status == "failed":
                any_failed = True
                break
            all_met = False

        if any_failed:
            ticket.metadata.status = "failed"
            ticket.metadata.error = "Dependency failed"
            ticket.save_metadata()
            continue

        if all_met:
            ticket.metadata.status = "available"
            ticket.save_metadata()
            promoted += 1

    return promoted




def resolve_segments(ticket: Ticket) -> list[dict[str, Any]]:
    """Build segments from a ticket's objective, resolving {{id}} references.

    Text around ``{{id}}`` becomes text segments. Each ``{{id}}`` becomes
    an ``input`` segment carrying the dependency's outcome as LLMContent.
    """
    objective = ticket.objective
    deps = ticket.metadata.depends_on or []

    # Build a lookup from dep ID to resolved outcome.
    dep_outcomes: dict[str, dict[str, Any]] = {}
    for dep_id in deps:
        dep = load_ticket(dep_id)
        if dep and dep.metadata.outcome_content:
            dep_outcomes[dep_id] = dep.metadata.outcome_content

    # Split objective on {{...}} boundaries.
    parts = _DEP_PATTERN.split(objective)
    segments: list[dict[str, Any]] = []

    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Text between refs.
            if part:
                segments.append({"type": "text", "text": part})
        else:
            # This is a captured ref — resolve to input segment.
            resolved_id = _find_dep_id(part, deps)
            if resolved_id and resolved_id in dep_outcomes:
                segments.append({
                    "type": "input",
                    "title": f"ticket-{resolved_id[:8]}",
                    "content": dep_outcomes[resolved_id],
                })
            else:
                # Fallback: just include as text.
                segments.append({
                    "type": "text",
                    "text": f"(output of ticket {part})",
                })

    return segments


def _find_dep_id(ref: str, dep_ids: list[str]) -> str | None:
    """Match a ref (prefix or full UUID) against resolved dep IDs."""
    for dep_id in dep_ids:
        if dep_id == ref or dep_id.startswith(ref):
            return dep_id
    return None


def main() -> None:
    """CLI entry point for ticket:drain."""
    summaries = asyncio.run(drain())
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
