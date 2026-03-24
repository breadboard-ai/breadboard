# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:add CLI — create a new ticket from a prompt.

Usage::

    npm run ticket:add -w packages/bees -- "Your prompt here"
"""

from __future__ import annotations

import sys

from bees.ticket import create_ticket


def main() -> None:
    """CLI entry point for ticket:add."""
    args = sys.argv[1:]
    if not args:
        print(
            'Usage: npm run ticket:add -w packages/bees -- "prompt text"',
            file=sys.stderr,
        )
        sys.exit(1)

    text = " ".join(args)
    ticket = create_ticket(text)

    print(f"Created ticket {ticket.id}", file=sys.stderr)
    print(f"  objective: {text!r}", file=sys.stderr)
    print(f"  status: {ticket.metadata.status}", file=sys.stderr)
    if ticket.metadata.depends_on:
        short_deps = [d[:8] for d in ticket.metadata.depends_on]
        print(f"  depends on: {short_deps}", file=sys.stderr)
    print(f"  path: {ticket.dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
