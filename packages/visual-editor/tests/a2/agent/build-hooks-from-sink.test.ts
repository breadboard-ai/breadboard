/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { buildHooksFromSink } from "../../../src/a2/agent/loop-setup.js";
import type { AgentEvent } from "../../../src/a2/agent/agent-event.js";
import type { AgentEventSink } from "../../../src/a2/agent/agent-event-sink.js";

// ── Spy sink ─────────────────────────────────────────────────────────────────

/** Captures all emitted events for inspection. */
function createSpySink(): AgentEventSink & { emitted: AgentEvent[] } {
  const emitted: AgentEvent[] = [];
  return {
    emitted,
    emit(event: AgentEvent) {
      emitted.push(event);
    },
    async suspend<T>(event: AgentEvent & { requestId: string }): Promise<T> {
      emitted.push(event);
      return undefined as T;
    },
  };
}

suite("buildHooksFromSink", () => {
  test("onStart emits a start event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const objective = { parts: [{ text: "Build a graph" }] };

    hooks.onStart!(objective);

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(sink.emitted[0].type, "start");
    if (sink.emitted[0].type === "start") {
      assert.deepStrictEqual(sink.emitted[0].objective, objective);
    }
  });

  test("onFinish emits a finish event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFinish!();

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(sink.emitted[0].type, "finish");
  });

  test("onContent emits a content event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const content = { parts: [{ text: "Here is the result" }] };

    hooks.onContent!(content);

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(sink.emitted[0].type, "content");
    if (sink.emitted[0].type === "content") {
      assert.deepStrictEqual(sink.emitted[0].content, content);
    }
  });

  test("onThought emits a thought event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onThought!("Analyzing the graph");

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(sink.emitted[0].type, "thought");
    if (sink.emitted[0].type === "thought") {
      assert.strictEqual(sink.emitted[0].text, "Analyzing the graph");
    }
  });

  test("onFunctionCall emits a functionCall event and returns callId", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "add_node", args: {} } };

    const result = hooks.onFunctionCall!(part, "icon-url", "Adding node");

    assert.strictEqual(sink.emitted.length, 1);
    const event = sink.emitted[0];
    assert.strictEqual(event.type, "functionCall");
    if (event.type === "functionCall") {
      assert.strictEqual(event.name, "add_node");
      assert.strictEqual(event.icon, "icon-url");
      assert.strictEqual(event.title, "Adding node");
      assert.ok(event.callId, "Should have a callId");
      assert.strictEqual(result.callId, event.callId);
    }
    assert.strictEqual(result.reporter, null);
  });

  test("onFunctionCall handles non-string icon", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "test_fn", args: {} } };

    // icon can be a non-string (object), should be filtered to undefined
    hooks.onFunctionCall!(part, { url: "icon" } as unknown as string);

    const event = sink.emitted[0];
    if (event.type === "functionCall") {
      assert.strictEqual(event.icon, undefined);
    }
  });

  test("onFunctionCallUpdate emits a functionCallUpdate event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFunctionCallUpdate!("call-1", "running");

    assert.strictEqual(sink.emitted.length, 1);
    const event = sink.emitted[0];
    assert.strictEqual(event.type, "functionCallUpdate");
    if (event.type === "functionCallUpdate") {
      assert.strictEqual(event.callId, "call-1");
      assert.strictEqual(event.status, "running");
    }
  });

  test("onFunctionResult emits a functionResult event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const content = { parts: [{ text: "result data" }] };

    hooks.onFunctionResult!("call-1", content);

    assert.strictEqual(sink.emitted.length, 1);
    const event = sink.emitted[0];
    assert.strictEqual(event.type, "functionResult");
    if (event.type === "functionResult") {
      assert.strictEqual(event.callId, "call-1");
      assert.deepStrictEqual(event.content, content);
    }
  });

  test("onTurnComplete emits a turnComplete event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onTurnComplete!();

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(sink.emitted[0].type, "turnComplete");
  });

  test("onSendRequest emits a sendRequest event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const body = { contents: [] };

    hooks.onSendRequest!("gemini-2.0-flash", body);

    assert.strictEqual(sink.emitted.length, 1);
    const event = sink.emitted[0];
    assert.strictEqual(event.type, "sendRequest");
    if (event.type === "sendRequest") {
      assert.strictEqual(event.model, "gemini-2.0-flash");
      assert.deepStrictEqual(event.body, body);
    }
  });
});
