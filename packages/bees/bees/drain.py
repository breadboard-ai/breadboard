# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:drain CLI — run all available tickets in parallel.

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
from bees.ticket import Ticket, list_tickets
from opal_backend.local.backend_client_impl import HttpBackendClient


async def _run_ticket(
    ticket: Ticket,
    *,
    http: httpx.AsyncClient,
    backend: HttpBackendClient,
) -> SessionResult:
    """Run a single ticket's session and update its metadata."""
    ticket.metadata.status = "running"
    ticket.save_metadata()

    label = ticket.id[:8]
    print(f"▶ [{label}] {ticket.objective!r}", file=sys.stderr)

    try:
        result = await run_session(
            ticket.objective, http=http, backend=backend, label=label,
            ticket_dir=ticket.dir,
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

    # Extract agent file system.
    file_manifest = extract_files(
        result.intermediate, ticket.dir / "filesystem",
    )
    if file_manifest:
        ticket.metadata.files = file_manifest

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
    """Load all available tickets and run them in parallel."""
    tickets = list_tickets(status="available")
    resumable = [
        t for t in list_tickets(status="suspended")
        if t.metadata.assignee == "agent"
    ]

    if not tickets and not resumable:
        print("No available or resumable tickets.", file=sys.stderr)
        return []

    total = len(tickets) + len(resumable)
    print(
        f"Draining {len(tickets)} new + {len(resumable)} resumable "
        f"= {total} ticket(s)...",
        file=sys.stderr,
    )

    gemini_key = load_gemini_key()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )

        tasks = [
            _run_ticket(ticket, http=http, backend=backend)
            for ticket in tickets
        ] + [
            _resume_ticket(ticket, http=http, backend=backend)
            for ticket in resumable
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    summaries = []
    all_tickets = tickets + resumable
    for ticket, result in zip(all_tickets, results):
        if isinstance(result, Exception):
            summaries.append({
                "ticket": ticket.id,
                "status": "failed",
                "error": str(result),
            })
        else:
            summaries.append({
                "ticket": ticket.id,
                "status": result.status,
                "events": result.events,
                "output": result.output,
            })

    return summaries


def main() -> None:
    """CLI entry point for ticket:drain."""
    summaries = asyncio.run(drain())
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()
