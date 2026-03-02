# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Strongly typed event and request models for the agent wire protocol.

Port of ``agent-event.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

These dataclasses mirror the TypeScript ``AgentEvent`` union from
``agent-event.ts``. They are the single place in the Python package for the
source of truth for the SSE wire format. Google3 will have proto-generated
bindings that mirror these structures.

Design constraints:
  - **No pydantic / httpx / fastapi imports.** This module is synced to
    google3 via copybara. All transport-layer dependencies stay in ``local/``.
  - Every model has a ``to_dict()`` method that returns camelCase keys,
    matching the JSON the TypeScript client expects.
  - Optional fields are omitted from ``to_dict()`` output when ``None``.

.. proto-guide::

    **Proto Reconstruction Guide** — for generating ``.proto`` definitions
    that produce wire-compatible bindings.

    Transport:
      - Unary POST → SSE event stream.
      - Request body is ``RunRequest`` (see ``StartRunRequest`` /
        ``ResumeRunRequest`` below — discriminated by presence of
        ``interactionId``).
      - Each SSE ``data:`` line is a JSON-serialized ``AgentEvent``.

    Discriminated union → ``oneof``:
      - ``AgentEvent`` is a union of 22 event types, discriminated by the
        ``type`` string field. In proto, model this as a wrapper message
        with ``oneof event { ... }`` — one field per event type.
      - The ``type`` string is redundant in proto (the ``oneof`` case
        determines it), but must appear in the JSON serialization for
        backward compatibility with the TypeScript client.
      - Similarly, ``SuspendEvent`` is a strict subset (6 types) — see
        the union definition at the bottom of this file.

    Field naming:
      - Python uses ``snake_case``, wire JSON uses ``camelCase``, proto
        uses ``snake_case``. Use ``json_name`` option in proto to get
        the camelCase wire names. Example::

          string request_id = 1 [json_name = "requestId"];

    Optionality:
      - Fields typed ``X | None`` (Python) map to ``optional X`` (proto3).
      - Fields omitted from ``to_dict()`` when ``None`` must be
        ``optional`` in the proto — the client checks for presence.
      - Fields always present in ``to_dict()`` are implicitly required.

    Upstream types — do NOT redefine:
      - ``LLMContent`` = ``google.ai.generativelanguage.v1beta.Content``
        (``{parts: Part[], role: string}``)
      - ``GeminiBody`` = ``GenerateContentRequest`` from the same package
      - These are already defined in the Gemini API protos. Import them.

    Not on the wire (do NOT include in proto):
      - ``function_call_part`` — internal bookkeeping in ``SuspendError``.
        It is NOT serialized in any event's ``to_dict()``.
      - ``interaction_id`` on suspend events — set server-side before
        emission, not part of the core event type. Should be a field in
        the wrapping ``AgentEvent`` or ``SuspendEvent`` message, not on
        each individual event (though on the wire it appears inside the
        event JSON for backward compatibility).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Union

# ---------------------------------------------------------------------------
# Type aliases for structures defined in upstream Gemini protos.
#
# .. proto-guide::
#     Do NOT create new proto messages for these. Import the existing
#     Gemini API protos instead:
#       LLMContent → google.ai.generativelanguage.v1beta.Content
#       GeminiBody → google.ai.generativelanguage.v1beta.GenerateContentRequest
#     In Python, these are typed as dict[str, Any] because we receive them
#     as parsed JSON. The proto bindings will give you real message types.
# ---------------------------------------------------------------------------

LLMContent = dict[str, Any]
"""Gemini content structure: ``{"parts": [...], "role": "..."}``.

.. proto-guide:: Use ``google.ai.generativelanguage.v1beta.Content``.
"""

GeminiBody = dict[str, Any]
"""Full Gemini API request body.

.. proto-guide:: Use ``google.ai.generativelanguage.v1beta.GenerateContentRequest``.
"""


# ---------------------------------------------------------------------------
# Wire-format data structures (used across events)
#
# .. proto-guide::
#     These are nested messages used by event messages below.
# ---------------------------------------------------------------------------


@dataclass
class FileData:
    """A file from the agent file system, keyed by path.

    .. proto-guide::
        message FileData {
          string path = 1;
          Content content = 2;  // upstream LLMContent
        }
    """

    path: str
    content: LLMContent

    def to_dict(self) -> dict[str, Any]:
        return {"path": self.path, "content": self.content}


@dataclass
class AgentResult:
    """Result of an agent loop run.

    Appears as the ``result`` field of ``CompleteEvent``.

    .. proto-guide::
        message AgentResult {
          bool success = 1;
          optional string href = 2;           // default "/"
          optional Content outcomes = 3;      // upstream LLMContent
          repeated FileData intermediate = 4; // empty list = not present
        }
        Note: ``intermediate`` is semantically optional (None vs []).
        In proto, ``repeated`` is inherently optional (empty = absent).
    """

    success: bool
    href: str = "/"
    outcomes: LLMContent | None = None
    intermediate: list[FileData] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"success": self.success}
        if self.href != "/":
            d["href"] = self.href
        if self.outcomes is not None:
            d["outcomes"] = self.outcomes
        if self.intermediate is not None:
            d["intermediate"] = [f.to_dict() for f in self.intermediate]
        return d


# ---------------------------------------------------------------------------
# Request / response body models (POST /v1beta1/streamRunAgent)
#
# .. proto-guide::
#     The client sends one of two shapes to the same endpoint:
#       - Start:  {kind, segments, flags}     → StartRunRequest
#       - Resume: {interactionId, response}   → ResumeRunRequest
#     Model as a single ``RunRequest`` with ``oneof body``:
#
#       message RunRequest {
#         oneof body {
#           StartRunBody start = 1;
#           ResumeRunBody resume = 2;
#         }
#       }
#
#     On the wire (JSON), the discriminant is the *presence* of
#     ``interactionId`` — if present, it's a resume; otherwise, start.
# ---------------------------------------------------------------------------


@dataclass
class TextSegment:
    """A literal text segment."""

    type: str = "text"
    text: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "text": self.text}


@dataclass
class AssetSegment:
    """An asset content group (titled)."""

    type: str = "asset"
    title: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "title": self.title, "content": self.content}


@dataclass
class InputSegment:
    """An agent-output content group (titled)."""

    type: str = "input"
    title: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "title": self.title, "content": self.content}


@dataclass
class ToolSegment:
    """A tool reference segment."""

    type: str = "tool"
    path: str = ""
    title: str | None = None
    instance: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type, "path": self.path}
        if self.title is not None:
            d["title"] = self.title
        if self.instance is not None:
            d["instance"] = self.instance
        return d


Segment = Union[TextSegment, AssetSegment, InputSegment, ToolSegment]


@dataclass
class RunFlags:
    """Flags sent alongside segments in the start request."""

    use_notebook_lm: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {"useNotebookLM": self.use_notebook_lm}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> RunFlags:
        return cls(use_notebook_lm=d.get("useNotebookLM", False))


@dataclass
class StartRunRequest:
    """POST body for starting a new agent run.

    ``{kind, segments, flags}`` — the client sends resolved segments.
    """

    kind: str
    segments: list[dict[str, Any]]
    flags: RunFlags = field(default_factory=RunFlags)

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "segments": self.segments,
            "flags": self.flags.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> StartRunRequest:
        return cls(
            kind=d.get("kind", ""),
            segments=d.get("segments", []),
            flags=RunFlags.from_dict(d.get("flags", {})),
        )


@dataclass
class ResumeRunRequest:
    """POST body for resuming a suspended agent run.

    ``{interactionId, response}`` — the client sends the user's response.
    """

    interaction_id: str
    response: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "interactionId": self.interaction_id,
            "response": self.response,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> ResumeRunRequest:
        return cls(
            interaction_id=d.get("interactionId", ""),
            response=d.get("response", {}),
        )


# ---------------------------------------------------------------------------
# Fire-and-forget events (server → client, no response expected)
#
# .. proto-guide::
#     Each event becomes a message. They are all members of the
#     ``AgentEvent.oneof event`` discriminated union. The ``type``
#     string on each dataclass is the Python-side discriminant only;
#     on the wire, the oneof key names the variant.
#
#     Wire example (SSE ``data:`` line):
#       {"thought": {"text": "Thinking about what to echo..."}}
#
#     Field naming convention: Python snake_case → camelCase on wire.
#     Use ``json_name`` in proto to produce the correct camelCase.
# ---------------------------------------------------------------------------


@dataclass
class StartEvent:
    """Loop began."""

    type: str = "start"
    objective: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"start": {"objective": self.objective}}


@dataclass
class ThoughtEvent:
    """Model reasoning."""

    type: str = "thought"
    text: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"thought": {"text": self.text}}


@dataclass
class FunctionCallEvent:
    """Tool invocation started.

    .. proto-guide::
        message FunctionCallEvent {
          string call_id = 1 [json_name = "callId"];
          string name = 2;
          google.protobuf.Struct args = 3;  // arbitrary JSON
          optional string icon = 4;
          optional string title = 5;
        }
        ``call_id`` correlates with FunctionCallUpdateEvent,
        FunctionResultEvent, and Subagent*Events.
    """

    type: str = "functionCall"
    call_id: str = ""
    name: str = ""
    args: dict[str, Any] = field(default_factory=dict)
    icon: str | None = None
    title: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "callId": self.call_id,
            "name": self.name,
            "args": self.args,
        }
        if self.icon is not None:
            payload["icon"] = self.icon
        if self.title is not None:
            payload["title"] = self.title
        return {"functionCall": payload}


@dataclass
class FunctionCallUpdateEvent:
    """Tool status update."""

    type: str = "functionCallUpdate"
    call_id: str = ""
    status: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"functionCallUpdate": {
            "callId": self.call_id,
            "status": self.status,
        }}


@dataclass
class FunctionResultEvent:
    """Tool result."""

    type: str = "functionResult"
    call_id: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"functionResult": {
            "callId": self.call_id,
            "content": self.content,
        }}


@dataclass
class ContentEvent:
    """Model output."""

    type: str = "content"
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"content": {"content": self.content}}


@dataclass
class TurnCompleteEvent:
    """Full turn finished."""

    type: str = "turnComplete"

    def to_dict(self) -> dict[str, Any]:
        return {"turnComplete": {}}


@dataclass
class SendRequestEvent:
    """Gemini request sent."""

    type: str = "sendRequest"
    model: str = ""
    body: GeminiBody = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"sendRequest": {"model": self.model, "body": self.body}}


@dataclass
class GraphEditEvent:
    """Fire-and-forget graph edits."""

    type: str = "graphEdit"
    edits: list[dict[str, Any]] = field(default_factory=list)
    label: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"graphEdit": {"edits": self.edits, "label": self.label}}


@dataclass
class CompleteEvent:
    """Loop finished successfully."""

    type: str = "complete"
    result: AgentResult = field(default_factory=lambda: AgentResult(success=False))

    def to_dict(self) -> dict[str, Any]:
        return {"complete": {"result": self.result.to_dict()}}


@dataclass
class ErrorEvent:
    """Loop error."""

    type: str = "error"
    message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"error": {"message": self.message}}


@dataclass
class FinishEvent:
    """Cleanup signal."""

    type: str = "finish"

    def to_dict(self) -> dict[str, Any]:
        return {"finish": {}}


@dataclass
class SubagentAddJsonEvent:
    """Nested progress data.

    .. proto-guide::
        message SubagentAddJsonEvent {
          string call_id = 1 [json_name = "callId"];
          string title = 2;
          google.protobuf.Struct data = 3;  // arbitrary JSON
          optional string icon = 4;
        }
    """

    type: str = "subagentAddJson"
    call_id: str = ""
    title: str = ""
    data: Any = None
    icon: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "callId": self.call_id,
            "title": self.title,
            "data": self.data,
        }
        if self.icon is not None:
            payload["icon"] = self.icon
        return {"subagentAddJson": payload}


@dataclass
class SubagentErrorEvent:
    """Nested error."""

    type: str = "subagentError"
    call_id: str = ""
    error: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"subagentError": {
            "callId": self.call_id,
            "error": self.error,
        }}


@dataclass
class SubagentFinishEvent:
    """Nested progress complete."""

    type: str = "subagentFinish"
    call_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"subagentFinish": {"callId": self.call_id}}


@dataclass
class UsageMetadataEvent:
    """Token usage metadata."""

    type: str = "usageMetadata"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"usageMetadata": {"metadata": self.metadata}}


# ---------------------------------------------------------------------------
# Suspend events (server → client, client must respond)
#
# .. proto-guide::
#     Suspend events follow a request-response pattern *within* the SSE
#     stream. The server emits the event, then the SSE connection closes.
#     The client collects user input and POSTs back to ``/v1beta1/streamRunAgent``
#     with ``{interactionId, response}`` (a ``ResumeRunRequest``).
#
#     All suspend events share a common ``request_id`` field and an
#     ``interaction_id`` that is injected server-side before emission.
#     In proto, consider a ``SuspendEvent`` wrapper with ``oneof``:
#
#       message SuspendEvent {
#         string interaction_id = 1 [json_name = "interactionId"];
#         oneof event {
#           WaitForInputEvent wait_for_input = 2;
#           WaitForChoiceEvent wait_for_choice = 3;
#           ReadGraphEvent read_graph = 4;
#           InspectNodeEvent inspect_node = 5;
#           ApplyEditsEvent apply_edits = 6;
#           QueryConsentEvent query_consent = 7;
#         }
#       }
#
#     On the wire, ``interactionId`` appears inside the event JSON
#     (not as a wrapper field) for backward compat.
# ---------------------------------------------------------------------------


@dataclass
class WaitForInputEvent:
    """Needs user text/file input.

    .. proto-guide::
        message WaitForInputEvent {
          string request_id = 1 [json_name = "requestId"];
          Content prompt = 2;              // upstream LLMContent
          string input_type = 3 [json_name = "inputType"];
                                           // enum: "text"|"any"|"file-upload"
          optional string skip_label = 4 [json_name = "skipLabel"];
        }
        ``interaction_id`` is on the SuspendEvent wrapper, not here.
    """

    type: str = "waitForInput"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    input_type: str = "text"
    skip_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "prompt": self.prompt,
            "inputType": self.input_type,
        }
        if self.skip_label is not None:
            payload["skipLabel"] = self.skip_label
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"waitForInput": payload}


@dataclass
class ChoiceItem:
    """A single choice in a WaitForChoiceEvent.

    .. proto-guide::
        message ChoiceItem {
          string id = 1;
          Content content = 2;  // upstream LLMContent
        }
    """

    id: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "content": self.content}


@dataclass
class WaitForChoiceEvent:
    """Needs user choice selection.

    .. proto-guide::
        message WaitForChoiceEvent {
          string request_id = 1 [json_name = "requestId"];
          Content prompt = 2;
          repeated ChoiceItem choices = 3;
          string selection_mode = 4 [json_name = "selectionMode"];
                                           // enum: "single"|"multiple"
          optional string layout = 5;      // enum: "list"|"grid"|null
          optional string none_of_the_above_label = 6
              [json_name = "noneOfTheAboveLabel"];
        }
    """

    type: str = "waitForChoice"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    choices: list[ChoiceItem] = field(default_factory=list)
    selection_mode: str = "single"
    layout: str | None = None
    none_of_the_above_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "prompt": self.prompt,
            "choices": [c.to_dict() for c in self.choices],
            "selectionMode": self.selection_mode,
        }
        if self.layout is not None:
            payload["layout"] = self.layout
        if self.none_of_the_above_label is not None:
            payload["noneOfTheAboveLabel"] = self.none_of_the_above_label
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"waitForChoice": payload}


@dataclass
class ReadGraphEvent:
    """Server needs the current graph structure."""

    type: str = "readGraph"
    request_id: str = ""
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
        }
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"readGraph": payload}


@dataclass
class InspectNodeEvent:
    """Server needs to inspect a specific node."""

    type: str = "inspectNode"
    request_id: str = ""
    node_id: str = ""
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "nodeId": self.node_id,
        }
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"inspectNode": payload}


@dataclass
class ApplyEditsEvent:
    """Server wants to apply graph modifications."""

    type: str = "applyEdits"
    request_id: str = ""
    label: str = ""
    edits: list[dict[str, Any]] | None = None
    transform: dict[str, Any] | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "label": self.label,
        }
        if self.edits is not None:
            payload["edits"] = self.edits
        if self.transform is not None:
            payload["transform"] = self.transform
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"applyEdits": payload}


@dataclass
class QueryConsentEvent:
    """Server needs user consent for a capability.

    .. proto-guide::
        message QueryConsentEvent {
          string request_id = 1 [json_name = "requestId"];
          string consent_type = 2 [json_name = "consentType"];
                // Known values: "GET_ANY_WEBPAGE"
          google.protobuf.Struct scope = 3;  // arbitrary JSON
          string graph_url = 4 [json_name = "graphUrl"];
        }
    """

    type: str = "queryConsent"
    request_id: str = ""
    consent_type: str = ""
    scope: dict[str, Any] = field(default_factory=dict)
    graph_url: str = ""
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "requestId": self.request_id,
            "consentType": self.consent_type,
            "scope": self.scope,
            "graphUrl": self.graph_url,
        }
        if self.interaction_id is not None:
            payload["interactionId"] = self.interaction_id
        return {"queryConsent": payload}


# ---------------------------------------------------------------------------
# Union types
#
# .. proto-guide::
#     ``AgentEvent`` → wrapper with ``oneof event { ... }``
#     containing one field for each event message above.
#
#     ``SuspendEvent`` → a strict subset of AgentEvent. In proto,
#     either a separate wrapper or a shared enum for the type
#     discriminant. The important contract: suspend events require
#     a client response (via ``ResumeRunRequest``), while all other
#     events are fire-and-forget.
#
#     ``to_dict()`` produces the proto-style oneof JSON directly:
#     ``{"thought": {"text": "..."}}`` — the key names the variant.
#     The client-side ``protoToAgentEvent()`` recovers the ``type``
#     discriminant for TypeScript dispatch.
# ---------------------------------------------------------------------------

AgentEvent = Union[
    StartEvent,
    ThoughtEvent,
    FunctionCallEvent,
    FunctionCallUpdateEvent,
    FunctionResultEvent,
    ContentEvent,
    TurnCompleteEvent,
    SendRequestEvent,
    WaitForInputEvent,
    WaitForChoiceEvent,
    ReadGraphEvent,
    InspectNodeEvent,
    ApplyEditsEvent,
    QueryConsentEvent,
    GraphEditEvent,
    CompleteEvent,
    ErrorEvent,
    FinishEvent,
    SubagentAddJsonEvent,
    SubagentErrorEvent,
    SubagentFinishEvent,
    UsageMetadataEvent,
]

SuspendEvent = Union[
    WaitForInputEvent,
    WaitForChoiceEvent,
    ReadGraphEvent,
    InspectNodeEvent,
    ApplyEditsEvent,
    QueryConsentEvent,
]

SUSPEND_TYPES = frozenset({
    "waitForInput",
    "waitForChoice",
    "readGraph",
    "inspectNode",
    "applyEdits",
    "queryConsent",
})
