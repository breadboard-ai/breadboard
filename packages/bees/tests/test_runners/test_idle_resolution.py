# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the idle resolution state machine.

Covers all branches of ``resolve_idle`` and documents the expected
behavior for each combination of inputs.  The "silent turn" test
documents the correct behavior (should suspend) and will FAIL
against the initial extraction until the bug is fixed.
"""

from __future__ import annotations

from bees.runners.idle_resolution import IdleInputs, IdleOutcome, resolve_idle


# ---------------------------------------------------------------------------
# Worker mode (has_chat=False)
# ---------------------------------------------------------------------------


class TestWorkerMode:
    """Worker-mode sessions complete when idle without a FINISH step."""

    def test_completes_when_sdk_emitted_finish(self) -> None:
        """ALREADY_COMPLETE when the SDK already said we're done."""
        inputs = IdleInputs(emitted_complete=True)
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.ALREADY_COMPLETE
        assert event == {}

    def test_completes_when_idle_no_finish(self) -> None:
        """Worker idle without FINISH = done."""
        inputs = IdleInputs(has_chat=False)
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.COMPLETE
        assert "complete" in event
        assert event["complete"]["result"]["success"] is True

    def test_suspends_on_deferred_result(self) -> None:
        """A tool requested deferred suspension via suspend queue."""
        inputs = IdleInputs(
            pending_suspend=True,
            suspend_request_id="req-123",
        )
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_DEFERRED
        assert "waitForInput" in event
        assert event["waitForInput"]["requestId"] == "req-123"
        assert event["waitForInput"]["inputType"] == "any"

    def test_suspends_when_active_child_tasks(self) -> None:
        """Active child tasks synthesize a deferred suspend."""
        inputs = IdleInputs(has_active_tasks=True)
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_DEFERRED
        assert "waitForInput" in event
        assert event["waitForInput"]["inputType"] == "any"
        # Request ID is auto-generated.
        assert event["waitForInput"]["requestId"]


# ---------------------------------------------------------------------------
# Chat mode (has_chat=True)
# ---------------------------------------------------------------------------


class TestChatMode:
    """Chat-mode sessions suspend when idle — they never complete."""

    def test_suspends_with_prompt_when_model_produced_text(self) -> None:
        """Normal chat turn: model responds, session suspends for user."""
        inputs = IdleInputs(has_chat=True, last_user_text="Hello!")
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_CHAT
        assert "waitForInput" in event
        assert event["waitForInput"]["inputType"] == "text"
        assert event["waitForInput"]["prompt"] == {
            "parts": [{"text": "Hello!"}],
        }

    def test_suspends_on_silent_turn(self) -> None:
        """Silent Turn Fallthrough: chat session resumed with a context
        update, model processes silently (no user-facing text).

        The session MUST still suspend — it is infinite.
        """
        inputs = IdleInputs(has_chat=True, last_user_text="")
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_CHAT, (
            f"Expected SUSPEND_CHAT but got {outcome}. "
            "Chat sessions must suspend even when the model is silent."
        )
        assert "waitForInput" in event
        assert event["waitForInput"]["inputType"] == "text"


# ---------------------------------------------------------------------------
# Priority ordering
# ---------------------------------------------------------------------------


class TestPriorityOrdering:
    """Verify the priority chain when multiple conditions are true."""

    def test_deferred_suspend_beats_chat(self) -> None:
        inputs = IdleInputs(
            pending_suspend=True,
            suspend_request_id="req-456",
            has_chat=True,
            last_user_text="Hi there",
        )
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_DEFERRED
        assert event["waitForInput"]["requestId"] == "req-456"

    def test_active_tasks_beat_chat(self) -> None:
        inputs = IdleInputs(
            has_active_tasks=True,
            has_chat=True,
            last_user_text="Working on it...",
        )
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_DEFERRED

    def test_deferred_suspend_beats_active_tasks(self) -> None:
        """When both are set, the tool's request ID is used."""
        inputs = IdleInputs(
            pending_suspend=True,
            suspend_request_id="req-789",
            has_active_tasks=True,
        )
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.SUSPEND_DEFERRED
        assert event["waitForInput"]["requestId"] == "req-789"

    def test_already_complete_takes_absolute_precedence(self) -> None:
        inputs = IdleInputs(
            emitted_complete=True,
            pending_suspend=True,
            has_chat=True,
            last_user_text="Hello",
        )
        outcome, event = resolve_idle(inputs)
        assert outcome == IdleOutcome.ALREADY_COMPLETE
