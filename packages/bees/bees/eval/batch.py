# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Batch eval runner — iterates hives in an eval set directory.

An eval set is a directory of hive directories::

    eval_set/
      my-hive/                # A complete hive
        config/
          SYSTEM.yaml
          TEMPLATES.yaml
        skills/...
        eval/                 # Eval-specific config
          persona.md
      another-hive/
        config/...
        eval/
          persona.md

Each child directory that contains ``config/SYSTEM.yaml`` is treated as
a hive (eval case).  The ``eval/`` subdirectory holds eval-specific
configuration — currently ``persona.md`` (used in Phase 2 for the
simulated user).
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from bees.eval.runner import CaseResult, run_case

logger = logging.getLogger(__name__)

__all__ = ["run_set"]


def _discover_cases(eval_set_dir: Path) -> list[tuple[str, Path]]:
    """Discover eval cases (hives) in a set directory.

    Returns a sorted list of ``(case_name, hive_dir)`` tuples.
    A valid case is a subdirectory containing ``config/SYSTEM.yaml``
    — the marker that identifies a hive.
    """
    cases: list[tuple[str, Path]] = []
    if not eval_set_dir.is_dir():
        return cases

    for child in sorted(eval_set_dir.iterdir()):
        if not child.is_dir():
            continue
        if (child / "config" / "SYSTEM.yaml").is_file():
            cases.append((child.name, child))

    return cases


def _print_summary(results: list[CaseResult]) -> None:
    """Print a per-case status table to stderr."""
    if not results:
        print("No cases to report.", file=sys.stderr)
        return

    # Column widths.
    name_width = max(len(r.case_name) for r in results)
    name_width = max(name_width, len("Case"))

    header = (
        f"{'Case':<{name_width}}  {'Status':<12}  "
        f"{'Tasks':>5}  {'Duration':>10}"
    )
    separator = "-" * len(header)

    print(f"\n{separator}", file=sys.stderr)
    print(header, file=sys.stderr)
    print(separator, file=sys.stderr)

    for r in results:
        duration_str = f"{r.duration_s:.1f}s"
        print(
            f"{r.case_name:<{name_width}}  {r.status:<12}  "
            f"{r.task_count:>5}  {duration_str:>10}",
            file=sys.stderr,
        )

    print(separator, file=sys.stderr)

    # Totals.
    total_tasks = sum(r.task_count for r in results)
    total_duration = sum(r.duration_s for r in results)
    statuses = {r.status for r in results}
    overall = (
        "completed" if statuses == {"completed"}
        else "failed" if "failed" in statuses
        else "mixed"
    )
    print(
        f"{'Total':<{name_width}}  {overall:<12}  "
        f"{total_tasks:>5}  {total_duration:>9.1f}s",
        file=sys.stderr,
    )
    print(f"{separator}\n", file=sys.stderr)


async def run_set(
    eval_set_dir: Path,
    output_dir: Path,
    gemini_key: str,
) -> list[CaseResult]:
    """Run all eval cases in a set directory.

    Cases are run sequentially.  Each case's hive is copied to
    ``output_dir/{case_name}/`` before running.

    Args:
        eval_set_dir: Directory containing eval cases.
        output_dir: Root output directory for results.
        gemini_key: Gemini API key for model calls.

    Returns:
        A list of ``CaseResult`` objects, one per case.
    """
    cases = _discover_cases(eval_set_dir)

    if not cases:
        print(
            f"No eval cases found in {eval_set_dir}",
            file=sys.stderr,
        )
        return []

    print(
        f"Found {len(cases)} eval case(s) in {eval_set_dir}",
        file=sys.stderr,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[CaseResult] = []

    for case_name, hive_dir in cases:
        case_output = output_dir / case_name
        result = await run_case(
            hive_dir,
            case_output,
            gemini_key,
            case_name=case_name,
        )
        results.append(result)

    _print_summary(results)
    return results
