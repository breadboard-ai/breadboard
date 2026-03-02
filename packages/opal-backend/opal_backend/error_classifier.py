# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Error classification for agent function responses.

Port of ``toErrorOrResponse`` + ``decodeErrorData`` (classification subset)
from ``functions/generate.ts`` and ``sca/utils/decode-error.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Distinguishes between **retryable** errors (sent back to the LLM as a
function response) and **fatal** errors (terminate the agent loop).
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

export = ["to_error_or_response", "FATAL_KINDS"]

# ---------------------------------------------------------------------------
# Fatal error kinds — port of FATAL_KINDS from generate.ts
# ---------------------------------------------------------------------------

# Error kinds that should immediately terminate the agent loop rather than
# being sent back to the LLM as a function response. Quota-exhausted errors
# are unrecoverable — retrying would just hit the same wall.
FATAL_KINDS: frozenset[str] = frozenset([
    "free-quota-exhausted",
    "free-quota-exhausted-can-pay",
    "paid-quota-exhausted",
])


# ---------------------------------------------------------------------------
# Error classification — port of maybeExtractRichError + classifyByFuzzyMatch
# ---------------------------------------------------------------------------


def _classify_error(error_message: str) -> str | None:
    """Extract error kind from a raw error string.

    Handles two shapes:
    1. Structured JSON from AppCat (``{"code": "RESOURCE_EXHAUSTED", ...}``)
    2. Plain strings — classified by fuzzy keyword matching

    Port of ``maybeExtractRichError`` + ``classifyByFuzzyMatch`` from
    ``sca/utils/decode-error.ts``.

    Returns:
        The kind string, or ``None`` if unclassifiable.
    """
    # Try structured JSON first.
    try:
        parsed = json.loads(error_message)
        if isinstance(parsed, dict) and parsed.get("code") == "RESOURCE_EXHAUSTED":
            error_reason = parsed.get("error_reason", "")
            if error_reason == "PAID_QUOTA_EXHAUSTED":
                return "paid-quota-exhausted"
            if error_reason == "FREE_QUOTA_EXHAUSTED":
                return "free-quota-exhausted"
            return "capacity"
    except (json.JSONDecodeError, TypeError):
        pass

    # Fuzzy keyword matching on the raw string.
    lc = error_message.lower()
    if "safety" in lc:
        return "safety"
    if "quota" in lc:
        return "capacity"
    if "recitation" in lc:
        return "recitation"

    return None


# ---------------------------------------------------------------------------
# Public API — port of toErrorOrResponse from generate.ts
# ---------------------------------------------------------------------------


def to_error_or_response(
    error: dict[str, Any],
) -> dict[str, Any]:
    """Classify an error and return either a fatal or retryable response.

    Port of ``toErrorOrResponse`` from ``functions/generate.ts``.

    If the error's classified kind is in ``FATAL_KINDS``, returns a
    ``{"$error": ..., "metadata": ...}`` dict that the ``FunctionCaller``
    propagates as a loop-breaking error.

    Otherwise returns ``{"error": ...}`` — a retryable function response
    that the LLM sees and can decide how to handle.

    Args:
        error: A dict with an ``"error"`` key containing the error message,
            and optionally a ``"metadata"`` key with pre-classified metadata.

    Returns:
        Either ``{"$error": ..., "metadata": ...}`` (fatal) or
        ``{"error": ...}`` (retryable).
    """
    error_message = error.get("error", "")
    existing_metadata = error.get("metadata")

    # Use pre-existing metadata kind if available (e.g. from expandVeoError).
    kind: str | None = None
    if isinstance(existing_metadata, dict):
        kind = existing_metadata.get("kind")

    # Otherwise classify from the error string.
    if not kind:
        kind = _classify_error(error_message)

    if kind and kind in FATAL_KINDS:
        return {
            "$error": error_message,
            **({"metadata": existing_metadata} if existing_metadata else {}),
        }

    # Not fatal — return as a retryable function response.
    return error
