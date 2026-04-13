# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:add CLI — create a new ticket from a prompt.

Usage::

    npm run ticket:add -w packages/bees -- "Your prompt here"
"""

from __future__ import annotations

import argparse
import sys

from bees import TaskStore
from app.config import load_hive_dir

task_store = TaskStore(load_hive_dir())


def main() -> None:
    """CLI entry point for ticket:add."""
    parser = argparse.ArgumentParser(
        description="Create a new ticket from a prompt.",
        usage='npm run ticket:add -w packages/bees -- "prompt text" [--tags "tag1,tag2"]',
    )
    parser.add_argument(
        "objective",
        nargs="*",
        help="The objective/prompt text for the ticket.",
    )
    parser.add_argument(
        "--tags",
        type=str,
        help="Comma-separated list of tags.",
    )
    parser.add_argument(
        "--functions",
        type=str,
        help="Comma-separated list of functions (dot-notation).",
    )
    parser.add_argument(
        "--skills",
        type=str,
        help="Comma-separated list of skills.",
    )
    
    args = parser.parse_args()

    if not args.objective:
        parser.print_usage(sys.stderr)
        sys.exit(1)

    objective = " ".join(args.objective)
    
    tags = None
    if args.tags:
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]

    functions = None
    if args.functions:
        functions = [f.strip() for f in args.functions.split(",") if f.strip()]

    skills = None
    if args.skills:
        skills = [f.strip() for f in args.skills.split(",") if f.strip()]

    ticket = task_store.create(objective, tags=tags, functions=functions, skills=skills)

    print(f"Created ticket {ticket.id}", file=sys.stderr)
    print(f"  objective: {objective!r}", file=sys.stderr)
    print(f"  status: {ticket.metadata.status}", file=sys.stderr)
    if ticket.metadata.tags:
        print(f"  tags: {ticket.metadata.tags}", file=sys.stderr)
    if ticket.metadata.depends_on:
        short_deps = [d[:8] for d in ticket.metadata.depends_on]
        print(f"  depends on: {short_deps}", file=sys.stderr)
    print(f"  path: {ticket.dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
