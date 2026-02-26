# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Pydantic models mirroring every AgentEvent variant from agent-event.ts.

These define the SSE wire format. Each event is a tagged union discriminated
by the `type` field. The models are intentionally permissive (using `dict`
for nested structures like LLMContent) because the server doesn't need
to deeply validate Breadboard-specific types — it just needs to produce
well-shaped JSON that the TypeScript client can parse.
"""

from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

class LLMContent(BaseModel):
    """Minimal mirror of @breadboard-ai/types LLMContent."""
    parts: list[dict[str, Any]]
    role: str = "model"


# ---------------------------------------------------------------------------
# Fire-and-forget events (server → client, no response expected)
# ---------------------------------------------------------------------------

class StartEvent(BaseModel):
    type: Literal["start"] = "start"
    objective: LLMContent


class ThoughtEvent(BaseModel):
    type: Literal["thought"] = "thought"
    text: str


class FunctionCallEvent(BaseModel):
    type: Literal["functionCall"] = "functionCall"
    call_id: str = Field(alias="callId")
    name: str
    args: dict[str, Any] = {}
    icon: str | None = None
    title: str | None = None

    model_config = {"populate_by_name": True}


class FunctionCallUpdateEvent(BaseModel):
    type: Literal["functionCallUpdate"] = "functionCallUpdate"
    call_id: str = Field(alias="callId")
    status: str | None
    opts: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class FunctionResultEvent(BaseModel):
    type: Literal["functionResult"] = "functionResult"
    call_id: str = Field(alias="callId")
    content: LLMContent

    model_config = {"populate_by_name": True}


class ContentEvent(BaseModel):
    type: Literal["content"] = "content"
    content: LLMContent


class TurnCompleteEvent(BaseModel):
    type: Literal["turnComplete"] = "turnComplete"


class SendRequestEvent(BaseModel):
    type: Literal["sendRequest"] = "sendRequest"
    model: str
    body: dict[str, Any]


class GraphEditEvent(BaseModel):
    type: Literal["graphEdit"] = "graphEdit"
    edits: list[dict[str, Any]]
    label: str


class CompleteEvent(BaseModel):
    type: Literal["complete"] = "complete"
    result: dict[str, Any]


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


class FinishEvent(BaseModel):
    type: Literal["finish"] = "finish"


class SubagentAddJsonEvent(BaseModel):
    type: Literal["subagentAddJson"] = "subagentAddJson"
    call_id: str = Field(alias="callId")
    title: str
    data: Any
    icon: str | None = None

    model_config = {"populate_by_name": True}


class SubagentErrorEvent(BaseModel):
    type: Literal["subagentError"] = "subagentError"
    call_id: str = Field(alias="callId")
    error: dict[str, Any]

    model_config = {"populate_by_name": True}


class SubagentFinishEvent(BaseModel):
    type: Literal["subagentFinish"] = "subagentFinish"
    call_id: str = Field(alias="callId")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Suspend events (server → client, client must respond)
# ---------------------------------------------------------------------------

class WaitForInputEvent(BaseModel):
    type: Literal["waitForInput"] = "waitForInput"
    request_id: str = Field(alias="requestId")
    prompt: LLMContent
    input_type: str = Field(alias="inputType", default="text")

    model_config = {"populate_by_name": True}


class WaitForChoiceEvent(BaseModel):
    type: Literal["waitForChoice"] = "waitForChoice"
    request_id: str = Field(alias="requestId")
    prompt: LLMContent
    choices: list[dict[str, Any]]
    selection_mode: str = Field(alias="selectionMode", default="single")
    layout: str | None = None
    none_of_the_above_label: str | None = Field(
        alias="noneOfTheAboveLabel", default=None
    )

    model_config = {"populate_by_name": True}


class ReadGraphEvent(BaseModel):
    type: Literal["readGraph"] = "readGraph"
    request_id: str = Field(alias="requestId")

    model_config = {"populate_by_name": True}


class InspectNodeEvent(BaseModel):
    type: Literal["inspectNode"] = "inspectNode"
    request_id: str = Field(alias="requestId")
    node_id: str = Field(alias="nodeId")

    model_config = {"populate_by_name": True}


class ApplyEditsEvent(BaseModel):
    type: Literal["applyEdits"] = "applyEdits"
    request_id: str = Field(alias="requestId")
    label: str
    edits: list[dict[str, Any]] | None = None
    transform: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class QueryConsentEvent(BaseModel):
    type: Literal["queryConsent"] = "queryConsent"
    request_id: str = Field(alias="requestId")
    consent_type: str = Field(alias="consentType")
    scope: dict[str, Any] = {}
    graph_url: str = Field(alias="graphUrl", default="")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Union type
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
