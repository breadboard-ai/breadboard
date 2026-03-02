# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for error_classifier.py — fatal error classification.
"""

from __future__ import annotations

import json

import pytest

from opal_backend.error_classifier import (
    FATAL_KINDS,
    to_error_or_response,
    _classify_error,
)


# ---------------------------------------------------------------------------
# _classify_error
# ---------------------------------------------------------------------------


class TestClassifyError:
    """Tests for the internal _classify_error function."""

    def test_resource_exhausted_free_quota(self):
        """RESOURCE_EXHAUSTED + FREE_QUOTA_EXHAUSTED → free-quota-exhausted."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "error_reason": "FREE_QUOTA_EXHAUSTED",
            "message": "Quota exceeded",
        })
        assert _classify_error(msg) == "free-quota-exhausted"

    def test_resource_exhausted_paid_quota(self):
        """RESOURCE_EXHAUSTED + PAID_QUOTA_EXHAUSTED → paid-quota-exhausted."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "error_reason": "PAID_QUOTA_EXHAUSTED",
            "message": "Quota exceeded",
        })
        assert _classify_error(msg) == "paid-quota-exhausted"

    def test_resource_exhausted_generic(self):
        """RESOURCE_EXHAUSTED without specific reason → capacity."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "message": "Too many requests",
        })
        assert _classify_error(msg) == "capacity"

    def test_fuzzy_safety(self):
        """String containing 'safety' → safety."""
        assert _classify_error("Blocked by safety filter") == "safety"

    def test_fuzzy_quota(self):
        """String containing 'quota' → capacity."""
        assert _classify_error("You have exceeded your quota") == "capacity"

    def test_fuzzy_recitation(self):
        """String containing 'recitation' → recitation."""
        assert _classify_error("Blocked due to recitation") == "recitation"

    def test_unclassifiable(self):
        """Plain error with no keywords → None."""
        assert _classify_error("Something went wrong") is None

    def test_non_resource_exhausted_json(self):
        """JSON with different code → fuzzy match fallback."""
        msg = json.dumps({
            "code": "INTERNAL",
            "message": "Internal server error",
        })
        assert _classify_error(msg) is None

    def test_case_insensitive_fuzzy(self):
        """Fuzzy matching is case-insensitive."""
        assert _classify_error("SAFETY violation detected") == "safety"


# ---------------------------------------------------------------------------
# to_error_or_response
# ---------------------------------------------------------------------------


class TestToErrorOrResponse:
    """Tests for the public to_error_or_response function."""

    def test_fatal_free_quota(self):
        """Free quota error → $error (loop-breaking)."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "error_reason": "FREE_QUOTA_EXHAUSTED",
            "message": "Quota exceeded",
        })
        result = to_error_or_response({"error": msg})
        assert "$error" in result
        assert result["$error"] == msg

    def test_fatal_paid_quota(self):
        """Paid quota error → $error (loop-breaking)."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "error_reason": "PAID_QUOTA_EXHAUSTED",
            "message": "Quota exceeded",
        })
        result = to_error_or_response({"error": msg})
        assert "$error" in result

    def test_retryable_safety(self):
        """Safety error → retryable (not fatal)."""
        result = to_error_or_response({"error": "Blocked by safety"})
        assert "$error" not in result
        assert result == {"error": "Blocked by safety"}

    def test_retryable_generic(self):
        """Generic error → retryable."""
        result = to_error_or_response({"error": "Something failed"})
        assert "$error" not in result
        assert result == {"error": "Something failed"}

    def test_preserves_existing_metadata(self):
        """Pre-classified metadata is preserved when fatal."""
        msg = json.dumps({
            "code": "RESOURCE_EXHAUSTED",
            "error_reason": "FREE_QUOTA_EXHAUSTED",
            "message": "Quota exceeded",
        })
        metadata = {"origin": "server", "kind": "free-quota-exhausted"}
        result = to_error_or_response({"error": msg, "metadata": metadata})
        assert result["$error"] == msg
        assert result["metadata"] == metadata

    def test_metadata_kind_takes_precedence(self):
        """If metadata already has a kind, it's used over classification."""
        # The error string says "safety" but metadata says
        # "free-quota-exhausted" — metadata wins.
        result = to_error_or_response({
            "error": "Some safety-related error",
            "metadata": {"kind": "free-quota-exhausted"},
        })
        assert "$error" in result

    def test_retryable_capacity_not_fatal(self):
        """Generic capacity (fuzzy) is NOT fatal — only specific quota kinds."""
        result = to_error_or_response({"error": "quota limit reached"})
        # "quota" fuzzy-matches to "capacity", which is NOT in FATAL_KINDS
        assert "$error" not in result

    def test_veo_safety_error_retryable(self):
        """Veo safety errors with metadata should remain retryable."""
        result = to_error_or_response({
            "error": "Content blocked. Support codes: 58061214",
            "metadata": {
                "origin": "server",
                "kind": "safety",
                "reasons": ["child"],
                "model": "veo-3.1-generate-preview",
            },
        })
        assert "$error" not in result
        assert result["error"] == "Content blocked. Support codes: 58061214"


# ---------------------------------------------------------------------------
# FATAL_KINDS
# ---------------------------------------------------------------------------


class TestFatalKinds:
    """FATAL_KINDS is an immutable set with the expected members."""

    def test_contains_expected_kinds(self):
        assert "free-quota-exhausted" in FATAL_KINDS
        assert "free-quota-exhausted-can-pay" in FATAL_KINDS
        assert "paid-quota-exhausted" in FATAL_KINDS

    def test_does_not_contain_non_fatal(self):
        assert "safety" not in FATAL_KINDS
        assert "capacity" not in FATAL_KINDS
        assert "recitation" not in FATAL_KINDS

    def test_is_frozenset(self):
        """FATAL_KINDS should be immutable."""
        assert isinstance(FATAL_KINDS, frozenset)
