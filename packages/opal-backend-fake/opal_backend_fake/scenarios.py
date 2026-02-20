# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Canned agent-run scripts that emit realistic AgentEvent sequences.

Each scenario is an async function that takes an SSEAgentEventSink and
drives it through a sequence of events. Suspend events block until the
mock client (or curl) POSTs a response.
"""

from __future__ import annotations

import asyncio
import uuid

from opal_backend_shared.events import (
    ApplyEditsEvent,
    ContentEvent,
    FinishEvent,
    FunctionCallEvent,
    FunctionCallUpdateEvent,
    FunctionResultEvent,
    LLMContent,
    QueryConsentEvent,
    ReadGraphEvent,
    StartEvent,
    ThoughtEvent,
    WaitForInputEvent,
)
from opal_backend_shared.sse_sink import SSEAgentEventSink

# Default inter-event delay for interactive (human-visible) use.
# Tests pass delay=0 to skip all sleeps.
DEFAULT_DELAY = 0.3


def _text(s: str) -> LLMContent:
    """Helper to create a simple text LLMContent."""
    return LLMContent(parts=[{"text": s}], role="user")


def _model_text(s: str) -> LLMContent:
    """Helper to create a model-role text LLMContent."""
    return LLMContent(parts=[{"text": s}], role="model")


# ---------------------------------------------------------------------------
# Scenario: echo
# Fire-and-forget only — no suspends
# ---------------------------------------------------------------------------

async def echo_scenario(sink: SSEAgentEventSink, *, delay: float = DEFAULT_DELAY) -> None:
    """Simple scenario: start → thought → functionCall → update →
    functionResult → content → finish."""

    await sink.emit(StartEvent(objective=_text("Echo test")))
    await asyncio.sleep(delay)

    await sink.emit(ThoughtEvent(text="Thinking about what to echo..."))
    await asyncio.sleep(delay)

    call_id = str(uuid.uuid4())
    await sink.emit(FunctionCallEvent(
        callId=call_id,
        name="generate_text",
        args={"prompt": "Hello world"},
        icon="text_analysis",
        title="Generating Text",
    ))
    await asyncio.sleep(delay)

    await sink.emit(FunctionCallUpdateEvent(
        callId=call_id,
        status="Generating Text",
        opts={"expectedDurationInSec": 5},
    ))
    await asyncio.sleep(delay)

    await sink.emit(FunctionResultEvent(
        callId=call_id,
        content=_model_text("Hello from the mock server!"),
    ))
    await asyncio.sleep(delay)

    await sink.emit(ContentEvent(
        content=_model_text(
            "I echoed the message. The mock server is working correctly."
        ),
    ))

    await sink.emit(FinishEvent())
    await sink.close()


# ---------------------------------------------------------------------------
# Scenario: chat
# Includes a waitForInput suspend
# ---------------------------------------------------------------------------

async def chat_scenario(sink: SSEAgentEventSink, *, delay: float = DEFAULT_DELAY) -> None:
    """Chat scenario: start → thought → waitForInput (suspend) →
    content (echoes user's input) → finish."""

    await sink.emit(StartEvent(objective=_text("Chat with user")))
    await asyncio.sleep(delay)

    await sink.emit(ThoughtEvent(
        text="I should greet the user and ask what they need."
    ))
    await asyncio.sleep(delay)

    # Suspend: wait for user input
    request_id = str(uuid.uuid4())
    response = await sink.suspend(WaitForInputEvent(
        requestId=request_id,
        prompt=_text("Hello! What would you like to work on today?"),
        inputType="text",
    ))

    # Extract the user's text from the response
    user_text = "(no text)"
    if isinstance(response, dict):
        input_data = response.get("input", {})
        parts = input_data.get("parts", [])
        texts = [p.get("text", "") for p in parts if "text" in p]
        if texts:
            user_text = " ".join(texts)

    await sink.emit(ThoughtEvent(
        text=f'The user said: "{user_text}". I\'ll acknowledge that.'
    ))
    await asyncio.sleep(delay)

    await sink.emit(ContentEvent(
        content=_model_text(
            f'Got it! You said: "{user_text}". '
            f"I'll work on that right away."
        ),
    ))

    await sink.emit(FinishEvent())
    await sink.close()


# ---------------------------------------------------------------------------
# Scenario: graph-edit
# Includes readGraph + applyEdits suspends
# ---------------------------------------------------------------------------

async def graph_edit_scenario(sink: SSEAgentEventSink, *, delay: float = DEFAULT_DELAY) -> None:
    """Graph editing scenario: start → readGraph (suspend) → thought →
    applyEdits (suspend) → content → finish."""

    await sink.emit(StartEvent(
        objective=_text("Add a new step to the graph")
    ))
    await asyncio.sleep(delay)

    # Suspend: read the current graph
    read_id = str(uuid.uuid4())
    graph_response = await sink.suspend(ReadGraphEvent(requestId=read_id))

    node_count = 0
    if isinstance(graph_response, dict):
        graph = graph_response.get("graph", {})
        nodes = graph.get("nodes", [])
        node_count = len(nodes)

    await sink.emit(ThoughtEvent(
        text=f"The graph has {node_count} node(s). "
             f"I'll add a new one."
    ))
    await asyncio.sleep(delay)

    # Suspend: apply edits to the graph
    edit_id = str(uuid.uuid4())
    edit_response = await sink.suspend(ApplyEditsEvent(
        requestId=edit_id,
        label="Add Research step",
        edits=[{
            "type": "addnode",
            "node": {
                "id": f"step-{uuid.uuid4().hex[:8]}",
                "type": "agent",
                "metadata": {"title": "Research"},
                "configuration": {
                    "config$prompt": "Research the topic thoroughly",
                },
            },
        }],
    ))

    success = True
    if isinstance(edit_response, dict):
        success = edit_response.get("success", True)

    if success:
        await sink.emit(ContentEvent(
            content=_model_text(
                "Done! I added a new Research step to the graph."
            ),
        ))
    else:
        await sink.emit(ContentEvent(
            content=_model_text(
                "The edit failed. Please check the graph and try again."
            ),
        ))

    await sink.emit(FinishEvent())
    await sink.close()


# ---------------------------------------------------------------------------
# Scenario: consent
# Includes a queryConsent suspend
# ---------------------------------------------------------------------------

async def consent_scenario(sink: SSEAgentEventSink, *, delay: float = DEFAULT_DELAY) -> None:
    """Consent scenario: start → thought → queryConsent (suspend) →
    content → finish."""

    await sink.emit(StartEvent(
        objective=_text("Search the web for information")
    ))
    await asyncio.sleep(delay)

    await sink.emit(ThoughtEvent(
        text="I need to access external URLs. Let me ask for consent."
    ))
    await asyncio.sleep(delay)

    # Suspend: request consent
    consent_id = str(uuid.uuid4())
    consent = await sink.suspend(QueryConsentEvent(
        requestId=consent_id,
        consentType="GET_ANY_WEBPAGE",
        scope={},
        graphUrl="https://example.com/my-opal",
    ))

    if consent:
        await sink.emit(ThoughtEvent(
            text="Consent granted! Proceeding with URL access."
        ))
        await asyncio.sleep(delay)
        await sink.emit(ContentEvent(
            content=_model_text(
                "Thanks for granting access. "
                "I found the information you needed."
            ),
        ))
    else:
        await sink.emit(ContentEvent(
            content=_model_text(
                "You declined the consent request. "
                "I'll proceed without URL access."
            ),
        ))

    await sink.emit(FinishEvent())
    await sink.close()


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

SCENARIOS: dict[str, type] = {
    "echo": echo_scenario,
    "chat": chat_scenario,
    "graph-edit": graph_edit_scenario,
    "consent": consent_scenario,
}
