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

from bees.session import SessionResult, extract_files, load_gemini_key, run_session
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

    ticket.save_metadata()
    return result


async def drain() -> list[dict]:
    """Load all available tickets and run them in parallel."""
    tickets = list_tickets(status="available")
    if not tickets:
        print("No available tickets.", file=sys.stderr)
        return []

    print(
        f"Draining {len(tickets)} ticket(s)...", file=sys.stderr
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
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    summaries = []
    for ticket, result in zip(tickets, results):
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
