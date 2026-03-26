# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees CLI — start an agent session and stream events to a file.

Usage::

    npm run session:start -w packages/bees -- "Your prompt text here"

Reads GEMINI_KEY from ``packages/bees/.env``.

Output format matches the eval viewer (``EvalFileData``): a JSON array
with ``context`` and ``outcome`` entries, loadable directly by
``packages/visual-editor/eval/viewer``.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

import httpx

from bees.session import load_gemini_key, run_session
from opal_backend.local.backend_client_impl import HttpBackendClient


async def _run(text: str, functions: list[str] | None = None) -> dict:
    gemini_key = load_gemini_key()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )

        result = await run_session(text, http=http, backend=backend, function_filter=functions)

    return {
        "session_id": result.session_id,
        "status": result.status,
        "events": result.events,
        "output": result.output,
    }


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Start an agent session.",
        usage='npm run session:start -w packages/bees -- "prompt text" [--functions "fn1,fn2"]',
    )
    parser.add_argument(
        "objective",
        nargs="*",
        help="The objective/prompt text.",
    )
    parser.add_argument(
        "--functions",
        type=str,
        help="Comma-separated list of functions.",
    )

    args = parser.parse_args()

    if not args.objective:
        parser.print_usage(sys.stderr)
        sys.exit(1)

    text = " ".join(args.objective)
    
    functions = None
    if args.functions:
        functions = [f.strip() for f in args.functions.split(",") if f.strip()]

    print(f"Starting session with: {text!r}", file=sys.stderr)
    if functions:
        print(f"  functions filter: {functions}", file=sys.stderr)

    result = asyncio.run(_run(text, functions=functions))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
