# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Conformance tests for bees-native handler types.

Verifies that ``bees.protocols.handler_types`` types have the same fields,
defaults, and ``to_dict()`` output as their ``opal_backend`` counterparts.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from bees.protocols.handler_types import (
    AgentResult,
    ChatEntryCallback,
    ChoiceItem,
    CONTEXT_PARTS_KEY,
    FileData,
    LLMContent,
    SessionTerminator,
    SuspendError,
    WaitForChoiceEvent,
    WaitForInputEvent,
)


# ---------------------------------------------------------------------------
# 1. Constants and aliases
# ---------------------------------------------------------------------------


class TestConstants:
    """Verify constants match opal_backend values."""

    def test_context_parts_key_value(self) -> None:
        from opal_backend.function_caller import (
            CONTEXT_PARTS_KEY as opal_key,
        )

        assert CONTEXT_PARTS_KEY == opal_key

    def test_chat_entry_callback_type(self) -> None:
        """ChatEntryCallback is a type alias — verify shape matches."""
        from opal_backend.functions.chat import (
            ChatEntryCallback as OpalChatEntryCallback,
        )

        # Both should accept the same (role, content) -> None signature.
        # Since these are type aliases, we verify they have the same
        # runtime representation.
        assert ChatEntryCallback == OpalChatEntryCallback


# ---------------------------------------------------------------------------
# 2. FileData
# ---------------------------------------------------------------------------


class TestFileData:
    """Verify FileData matches opal_backend.events.FileData."""

    def test_fields_match(self) -> None:
        from opal_backend.events import FileData as OpalFileData

        bees_fd = FileData(path="/test.txt", content={"parts": [{"text": "hi"}]})
        opal_fd = OpalFileData(path="/test.txt", content={"parts": [{"text": "hi"}]})

        assert bees_fd.path == opal_fd.path
        assert bees_fd.content == opal_fd.content

    def test_to_dict_matches(self) -> None:
        from opal_backend.events import FileData as OpalFileData

        content: LLMContent = {"parts": [{"text": "hello"}]}

        bees_fd = FileData(path="/a.txt", content=content)
        opal_fd = OpalFileData(path="/a.txt", content=content)

        assert bees_fd.to_dict() == opal_fd.to_dict()


# ---------------------------------------------------------------------------
# 3. AgentResult
# ---------------------------------------------------------------------------


class TestAgentResult:
    """Verify AgentResult matches opal_backend.events.AgentResult."""

    def test_defaults_match(self) -> None:
        from opal_backend.events import AgentResult as OpalAgentResult

        bees_ar = AgentResult(success=True)
        opal_ar = OpalAgentResult(success=True)

        assert bees_ar.success == opal_ar.success
        assert bees_ar.href == opal_ar.href
        assert bees_ar.outcomes == opal_ar.outcomes
        assert bees_ar.intermediate == opal_ar.intermediate

    def test_to_dict_minimal(self) -> None:
        from opal_backend.events import AgentResult as OpalAgentResult

        bees_ar = AgentResult(success=True)
        opal_ar = OpalAgentResult(success=True)

        assert bees_ar.to_dict() == opal_ar.to_dict()

    def test_to_dict_full(self) -> None:
        from opal_backend.events import AgentResult as OpalAgentResult
        from opal_backend.events import FileData as OpalFileData

        bees_ar = AgentResult(
            success=True,
            href="/result",
            outcomes={"parts": [{"text": "done"}]},
            intermediate=[
                FileData(path="/out.txt", content={"parts": [{"text": "data"}]}),
            ],
        )
        opal_ar = OpalAgentResult(
            success=True,
            href="/result",
            outcomes={"parts": [{"text": "done"}]},
            intermediate=[
                OpalFileData(path="/out.txt", content={"parts": [{"text": "data"}]}),
            ],
        )

        assert bees_ar.to_dict() == opal_ar.to_dict()

    def test_to_dict_default_href_omitted(self) -> None:
        """Default href '/' is not included in to_dict() output."""
        ar = AgentResult(success=False)
        d = ar.to_dict()
        assert "href" not in d

    def test_to_dict_custom_href_included(self) -> None:
        ar = AgentResult(success=True, href="/custom")
        d = ar.to_dict()
        assert d["href"] == "/custom"


# ---------------------------------------------------------------------------
# 4. WaitForInputEvent
# ---------------------------------------------------------------------------


class TestWaitForInputEvent:
    """Verify WaitForInputEvent matches opal_backend.events."""

    def test_defaults_match(self) -> None:
        from opal_backend.events import (
            WaitForInputEvent as OpalWaitForInputEvent,
        )

        bees_ev = WaitForInputEvent()
        opal_ev = OpalWaitForInputEvent()

        assert bees_ev.type == opal_ev.type
        assert bees_ev.request_id == opal_ev.request_id
        assert bees_ev.prompt == opal_ev.prompt
        assert bees_ev.input_type == opal_ev.input_type
        assert bees_ev.skip_label == opal_ev.skip_label
        assert bees_ev.interaction_id == opal_ev.interaction_id

    def test_to_dict_matches(self) -> None:
        from opal_backend.events import (
            WaitForInputEvent as OpalWaitForInputEvent,
        )

        kwargs: dict[str, Any] = {
            "request_id": "req-1",
            "prompt": {"parts": [{"text": "Enter your name"}], "role": "user"},
            "input_type": "text",
            "skip_label": "Skip",
        }

        bees_ev = WaitForInputEvent(**kwargs)
        opal_ev = OpalWaitForInputEvent(**kwargs)

        assert bees_ev.to_dict() == opal_ev.to_dict()

    def test_to_dict_minimal(self) -> None:
        """Minimal event without optional fields."""
        ev = WaitForInputEvent(request_id="r1")
        d = ev.to_dict()
        assert d == {
            "waitForInput": {
                "requestId": "r1",
                "prompt": {},
                "inputType": "text",
            },
        }


# ---------------------------------------------------------------------------
# 5. ChoiceItem
# ---------------------------------------------------------------------------


class TestChoiceItem:
    """Verify ChoiceItem matches opal_backend.events."""

    def test_to_dict_matches(self) -> None:
        from opal_backend.events import ChoiceItem as OpalChoiceItem

        bees_ci = ChoiceItem(id="c1", content={"parts": [{"text": "Option A"}]})
        opal_ci = OpalChoiceItem(id="c1", content={"parts": [{"text": "Option A"}]})

        assert bees_ci.to_dict() == opal_ci.to_dict()


# ---------------------------------------------------------------------------
# 6. WaitForChoiceEvent
# ---------------------------------------------------------------------------


class TestWaitForChoiceEvent:
    """Verify WaitForChoiceEvent matches opal_backend.events."""

    def test_defaults_match(self) -> None:
        from opal_backend.events import (
            WaitForChoiceEvent as OpalWaitForChoiceEvent,
        )

        bees_ev = WaitForChoiceEvent()
        opal_ev = OpalWaitForChoiceEvent()

        assert bees_ev.type == opal_ev.type
        assert bees_ev.selection_mode == opal_ev.selection_mode
        assert bees_ev.layout == opal_ev.layout
        assert bees_ev.none_of_the_above_label == opal_ev.none_of_the_above_label

    def test_to_dict_matches(self) -> None:
        from opal_backend.events import (
            WaitForChoiceEvent as OpalWaitForChoiceEvent,
            ChoiceItem as OpalChoiceItem,
        )

        bees_ev = WaitForChoiceEvent(
            request_id="req-2",
            prompt={"parts": [{"text": "Pick one"}]},
            choices=[
                ChoiceItem(id="a", content={"parts": [{"text": "A"}]}),
                ChoiceItem(id="b", content={"parts": [{"text": "B"}]}),
            ],
            selection_mode="single",
            layout="list",
            none_of_the_above_label="None",
        )
        opal_ev = OpalWaitForChoiceEvent(
            request_id="req-2",
            prompt={"parts": [{"text": "Pick one"}]},
            choices=[
                OpalChoiceItem(id="a", content={"parts": [{"text": "A"}]}),
                OpalChoiceItem(id="b", content={"parts": [{"text": "B"}]}),
            ],
            selection_mode="single",
            layout="list",
            none_of_the_above_label="None",
        )

        assert bees_ev.to_dict() == opal_ev.to_dict()

    def test_to_dict_minimal(self) -> None:
        ev = WaitForChoiceEvent(request_id="r1")
        d = ev.to_dict()
        assert d == {
            "waitForChoice": {
                "requestId": "r1",
                "prompt": {},
                "choices": [],
                "selectionMode": "single",
            },
        }


# ---------------------------------------------------------------------------
# 7. SuspendError
# ---------------------------------------------------------------------------


class TestSuspendError:
    """Verify SuspendError matches opal_backend.suspend.SuspendError."""

    def test_is_exception(self) -> None:
        ev = WaitForInputEvent(request_id="r1")
        err = SuspendError(ev)
        assert isinstance(err, Exception)

    def test_properties_match(self) -> None:
        from opal_backend.suspend import SuspendError as OpalSuspendError
        from opal_backend.events import (
            WaitForInputEvent as OpalWaitForInputEvent,
        )

        fc_part = {"functionCall": {"name": "chat_request_user_input", "args": {}}}

        bees_ev = WaitForInputEvent(request_id="r1")
        bees_err = SuspendError(bees_ev, fc_part, is_precondition_check=True)

        opal_ev = OpalWaitForInputEvent(request_id="r1")
        opal_err = OpalSuspendError(opal_ev, fc_part, is_precondition_check=True)

        # Same properties (interaction_id will differ — both are random UUIDs)
        assert bees_err.event.type == opal_err.event.type
        assert bees_err.function_call_part == opal_err.function_call_part
        assert bees_err.is_precondition_check == opal_err.is_precondition_check
        assert bees_err.completed_responses == opal_err.completed_responses

    def test_interaction_id_is_uuid(self) -> None:
        ev = WaitForInputEvent()
        err = SuspendError(ev)
        # Should be a valid UUID string.
        parsed = uuid.UUID(err.interaction_id)
        assert str(parsed) == err.interaction_id

    def test_default_function_call_part(self) -> None:
        ev = WaitForInputEvent()
        err = SuspendError(ev)
        assert err.function_call_part == {}

    def test_exception_message(self) -> None:
        ev = WaitForInputEvent()
        err = SuspendError(ev)
        assert "waitForInput" in str(err)

    def test_choice_event_message(self) -> None:
        ev = WaitForChoiceEvent()
        err = SuspendError(ev)
        assert "waitForChoice" in str(err)

    def test_subclasses_opal_suspend_error(self) -> None:
        """Bees SuspendError must be a subclass of opal's.

        The session loop (in opal_backend) catches
        ``opal_backend.suspend.SuspendError``.  If bees' version isn't a
        subclass, ``except`` clauses won't match and suspend/resume breaks
        silently — the agent resumes immediately instead of waiting.
        """
        from opal_backend.suspend import SuspendError as OpalSuspendError

        assert issubclass(SuspendError, OpalSuspendError)

    def test_caught_by_opal_except_clause(self) -> None:
        """Verify bees' SuspendError is caught by ``except OpalSuspendError``."""
        from opal_backend.suspend import SuspendError as OpalSuspendError

        ev = WaitForInputEvent(request_id="r1")
        bees_err = SuspendError(ev)

        caught = False
        try:
            raise bees_err
        except OpalSuspendError:
            caught = True

        assert caught, "opal's except clause did not catch bees' SuspendError"

    def test_isinstance_matches_opal(self) -> None:
        """Verify isinstance() works across the boundary.

        ``FunctionCaller.get_results()`` uses
        ``isinstance(r, SuspendError)`` with the opal class.
        """
        from opal_backend.suspend import SuspendError as OpalSuspendError

        ev = WaitForInputEvent(request_id="r1")
        bees_err = SuspendError(ev)

        assert isinstance(bees_err, OpalSuspendError)


# ---------------------------------------------------------------------------
# 8. SessionTerminator protocol
# ---------------------------------------------------------------------------


class TestSessionTerminator:
    """Verify LoopController satisfies the SessionTerminator protocol."""

    def test_loop_controller_satisfies_protocol(self) -> None:
        from opal_backend.loop import LoopController

        assert isinstance(LoopController(), SessionTerminator)

    def test_mock_satisfies_protocol(self) -> None:
        class MockTerminator:
            def __init__(self) -> None:
                self.result: Any = None

            def terminate(self, result: Any) -> None:
                self.result = result

        assert isinstance(MockTerminator(), SessionTerminator)

    def test_mock_terminator_works(self) -> None:
        class MockTerminator:
            def __init__(self) -> None:
                self.result: Any = None

            def terminate(self, result: Any) -> None:
                self.result = result

        t = MockTerminator()
        ar = AgentResult(success=True, outcomes={"parts": [{"text": "done"}]})
        t.terminate(ar)
        assert t.result is ar


# ---------------------------------------------------------------------------
# 9. AgentResult isinstance conformance
# ---------------------------------------------------------------------------


class TestAgentResultIsinstance:
    """Verify bees AgentResult passes opal isinstance checks.

    The session loop (``opal_backend/run.py`` L852) checks
    ``isinstance(result, AgentResult)`` using opal's class. Bees'
    AgentResult must pass that check or the loop reports
    ``"Unexpected result"`` errors.
    """

    def test_subclasses_opal_agent_result(self) -> None:
        """Structural: bees AgentResult is a subclass of opal's."""
        from opal_backend.events import AgentResult as OpalAgentResult

        assert issubclass(AgentResult, OpalAgentResult)

    def test_isinstance_matches_opal(self) -> None:
        """Runtime: an instance of bees AgentResult passes isinstance."""
        from opal_backend.events import AgentResult as OpalAgentResult

        result = AgentResult(success=True, outcomes={"parts": [{"text": "ok"}]})
        assert isinstance(result, OpalAgentResult)

    def test_to_dict_matches_opal(self) -> None:
        """Wire format: to_dict() output is identical."""
        from opal_backend.events import AgentResult as OpalAgentResult
        from opal_backend.events import FileData as OpalFileData

        bees_fd = FileData(
            path="test.md",
            content={"parts": [{"text": "hello"}]},
        )
        bees_result = AgentResult(
            success=True,
            href="/test",
            outcomes={"parts": [{"text": "done"}], "role": "user"},
            intermediate=[bees_fd],
        )

        opal_fd = OpalFileData(
            path="test.md",
            content={"parts": [{"text": "hello"}]},
        )
        opal_result = OpalAgentResult(
            success=True,
            href="/test",
            outcomes={"parts": [{"text": "done"}], "role": "user"},
            intermediate=[opal_fd],
        )

        assert bees_result.to_dict() == opal_result.to_dict()
