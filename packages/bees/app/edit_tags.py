# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:tags CLI — edit tags for an existing ticket.

Usage::

    npm run ticket:tags -w packages/bees -- <ticket_id> --tags "tag1,tag2"
"""

from __future__ import annotations

import argparse
import sys

from bees import TaskStore
from app.config import load_hive_dir

task_store = TaskStore(load_hive_dir())


def main() -> None:
    """CLI entry point for ticket:tags."""
    parser = argparse.ArgumentParser(
        description="Edit tags for an existing ticket.",
        usage='npm run ticket:tags -w packages/bees -- <ticket_id> --tags "tag1,tag2"',
    )
    parser.add_argument(
        "ticket_id",
        help="The full ID of the ticket to edit.",
    )
    parser.add_argument(
        "--tags",
        type=str,
        help="Comma-separated list of new tags. Pass empty string to clear.",
    )
    
    args = parser.parse_args()

    ticket = task_store.get(args.ticket_id)
    if not ticket:
        print(f"Error: Ticket {args.ticket_id} not found", file=sys.stderr)
        sys.exit(1)

    # Parse tags (empty string means clear tags)
    tags = []
    if args.tags:
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    ticket.metadata.tags = tags if tags else None
    ticket.save_metadata()

    print(f"Updated tags for ticket {ticket.id}", file=sys.stderr)
    print(f"  objective: {ticket.objective!r}", file=sys.stderr)
    print(f"  tags: {ticket.metadata.tags}", file=sys.stderr)


if __name__ == "__main__":
    main()
