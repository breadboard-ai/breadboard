# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
playbook:run CLI — create tickets from a playbook.

Usage::

    npm run playbook:run -w packages/bees -- orchestrator
"""

from __future__ import annotations

import argparse
import sys

from bees.playbook import run_playbook


def main() -> None:
    """CLI entry point for playbook:run."""
    parser = argparse.ArgumentParser(
        description="Create tickets from a playbook.",
        usage="npm run playbook:run -w packages/bees -- <playbook-name>",
    )
    parser.add_argument(
        "name",
        help="Name of the playbook (without .yaml extension).",
    )

    args = parser.parse_args()

    try:
        tickets = run_playbook(args.name)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Created {len(tickets)} ticket(s) from playbook '{args.name}':",
        file=sys.stderr,
    )
    for ticket in tickets:
        label = ticket.id[:8]
        title = ticket.metadata.title or "(untitled)"
        status = ticket.metadata.status
        deps = ticket.metadata.depends_on
        dep_str = ""
        if deps:
            dep_str = f" (blocked on {', '.join(d[:8] for d in deps)})"
        print(f"  [{label}] {title} — {status}{dep_str}", file=sys.stderr)


if __name__ == "__main__":
    main()
