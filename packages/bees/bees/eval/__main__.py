# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""CLI entry point for bees eval.

Usage::

    # Single hive:
    python -m bees.eval run path/to/hive

    # Batch (eval set):
    python -m bees.eval run-set path/to/eval_set --output results/

    # Via npm:
    npm run eval -- run path/to/hive
    npm run eval -- run-set path/to/eval_set --output results/
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv


def _load_gemini_key() -> str:
    """Load GEMINI_KEY from environment, exit on failure."""
    key = os.environ.get("GEMINI_KEY", "")
    if not key:
        print(
            "Error: GEMINI_KEY not found in environment.",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bees.eval",
        description="Bees eval — run hives in batch mode.",
    )

    sub = parser.add_subparsers(dest="command")

    # -- run (single hive) -------------------------------------------------
    run_parser = sub.add_parser(
        "run",
        help="Run a single hive to completion.",
    )
    run_parser.add_argument(
        "hive_dir",
        type=Path,
        help="Path to the hive directory.",
    )
    run_parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Output directory (default: results/<timestamp>).",
    )
    run_parser.add_argument(
        "--root",
        type=str,
        default=None,
        help="Override the root template from SYSTEM.yaml.",
    )

    # -- run-set (batch) ---------------------------------------------------
    set_parser = sub.add_parser(
        "run-set",
        help="Run all cases in an eval set directory.",
    )
    set_parser.add_argument(
        "eval_set_dir",
        type=Path,
        help="Path to the eval set directory.",
    )
    set_parser.add_argument(
        "--output", "-o",
        type=Path,
        required=True,
        help="Output directory for results.",
    )
    set_parser.add_argument(
        "--root",
        type=str,
        default=None,
        help="Override the root template from SYSTEM.yaml.",
    )

    return parser


async def _run_single(
    hive_dir: Path, output_dir: Path, key: str,
    *, root_task: str | None = None,
) -> None:
    from bees.eval.runner import run_case

    result = await run_case(hive_dir, output_dir, key, root_task=root_task)

    print(
        f"\n{'─' * 40}",
        file=sys.stderr,
    )
    print(
        f"Status: {result.status}  "
        f"Tasks: {result.task_count}  "
        f"Duration: {result.duration_s:.1f}s",
        file=sys.stderr,
    )
    if result.error:
        print(f"Error: {result.error}", file=sys.stderr)
    print(f"Output: {output_dir}", file=sys.stderr)


async def _run_set(
    eval_set_dir: Path, output_dir: Path, key: str,
    *, root_task: str | None = None,
) -> None:
    from bees.eval.batch import run_set

    results = await run_set(
        eval_set_dir, output_dir, key, root_task=root_task,
    )

    if not results:
        sys.exit(1)

    # Exit with error if any case failed.
    if any(r.status == "failed" for r in results):
        sys.exit(1)


def main() -> None:
    """CLI entry point."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )

    load_dotenv()

    parser = _build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    key = _load_gemini_key()

    if args.command == "run":
        hive_dir = args.hive_dir.resolve()
        if not hive_dir.is_dir():
            print(
                f"Error: {hive_dir} is not a directory.",
                file=sys.stderr,
            )
            sys.exit(1)

        output_dir = args.output
        if output_dir is None:
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            output_dir = Path(f"results/{stamp}")
        output_dir = output_dir.resolve()

        asyncio.run(_run_single(hive_dir, output_dir, key, root_task=args.root))

    elif args.command == "run-set":
        eval_set_dir = args.eval_set_dir.resolve()
        if not eval_set_dir.is_dir():
            print(
                f"Error: {eval_set_dir} is not a directory.",
                file=sys.stderr,
            )
            sys.exit(1)

        output_dir = args.output.resolve()
        asyncio.run(_run_set(eval_set_dir, output_dir, key, root_task=args.root))


if __name__ == "__main__":
    main()
