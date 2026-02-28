/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { buildHooksFromSink } from "../../src/a2/agent/loop-setup.js";
import type {
  AgentEvent,
  AgentEventType,
} from "../../src/a2/agent/agent-event.js";
import { eventType, eventPayload } from "../../src/a2/agent/agent-event.js";
import type { AgentEventSink } from "../../src/a2/agent/agent-event-sink.js";
import type { SuspendEvent } from "../../src/a2/agent/agent-event.js";

// ── Spy sink ─────────────────────────────────────────────────────────────────

/** Captures all emitted events for inspection. */
function createSpySink(): AgentEventSink & { emitted: AgentEvent[] } {
  const emitted: AgentEvent[] = [];
  return {
    emitted,
    emit(event: AgentEvent) {
      emitted.push(event);
    },
    async suspend<T>(event: SuspendEvent): Promise<T> {
      emitted.push(event as AgentEvent);
      return undefined as T;
    },
  };
}

/** Extract event type name from a proto-style oneof event. */
function eType(event: AgentEvent): AgentEventType {
  return eventType(event);
}

/** Extract payload from a proto-style oneof event. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ePayload(event: AgentEvent): any {
  return eventPayload(event);
}

suite("buildHooksFromSink", () => {
  test("onStart emits a start event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const objective = { parts: [{ text: "Build a graph" }] };

    hooks.onStart!(objective);

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(eType(sink.emitted[0]), "start");
    assert.deepStrictEqual(ePayload(sink.emitted[0]).objective, objective);
  });

  test("onFinish emits a finish event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFinish!();

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(eType(sink.emitted[0]), "finish");
  });

  test("onContent emits a content event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const content = { parts: [{ text: "Here is the result" }] };

    hooks.onContent!(content);

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(eType(sink.emitted[0]), "content");
    assert.deepStrictEqual(ePayload(sink.emitted[0]).content, content);
  });

  test("onThought emits a thought event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onThought!("Analyzing the graph");

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(eType(sink.emitted[0]), "thought");
    assert.strictEqual(ePayload(sink.emitted[0]).text, "Analyzing the graph");
  });

  test("onFunctionCall emits a functionCall event and returns callId", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "add_node", args: {} } };

    const result = hooks.onFunctionCall!(part, "icon-url", "Adding node");

    assert.strictEqual(sink.emitted.length, 1);
    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(eType(sink.emitted[0]), "functionCall");
    assert.strictEqual(payload.name, "add_node");
    assert.strictEqual(payload.icon, "icon-url");
    assert.strictEqual(payload.title, "Adding node");
    assert.ok(payload.callId, "Should have a callId");
    assert.strictEqual(result.callId, payload.callId);
    assert.ok(result.reporter, "Should return a proxy reporter");
    assert.strictEqual(typeof result.reporter.addJson, "function");
    assert.strictEqual(typeof result.reporter.addError, "function");
    assert.strictEqual(typeof result.reporter.finish, "function");
  });

  test("proxy reporter emits subagentAddJson", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "gen_image", args: {} } };

    const { callId, reporter } = hooks.onFunctionCall!(part);
    reporter!.addJson("Image result", { url: "http://img" }, "photo");

    assert.strictEqual(sink.emitted.length, 2);
    const payload = ePayload(sink.emitted[1]);
    assert.strictEqual(eType(sink.emitted[1]), "subagentAddJson");
    assert.strictEqual(payload.callId, callId);
    assert.strictEqual(payload.title, "Image result");
    assert.deepStrictEqual(payload.data, { url: "http://img" });
    assert.strictEqual(payload.icon, "photo");
  });

  test("proxy reporter emits subagentError", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "gen_video", args: {} } };

    const { callId, reporter } = hooks.onFunctionCall!(part);
    const errorObj = { $error: "Video gen failed" };
    const returned = reporter!.addError(errorObj);

    assert.strictEqual(returned, errorObj, "addError should return the error");
    assert.strictEqual(sink.emitted.length, 2);
    const payload = ePayload(sink.emitted[1]);
    assert.strictEqual(eType(sink.emitted[1]), "subagentError");
    assert.strictEqual(payload.callId, callId);
    assert.deepStrictEqual(payload.error, errorObj);
  });

  test("proxy reporter emits subagentFinish", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "gen_audio", args: {} } };

    const { callId, reporter } = hooks.onFunctionCall!(part);
    reporter!.finish();

    assert.strictEqual(sink.emitted.length, 2);
    const payload = ePayload(sink.emitted[1]);
    assert.strictEqual(eType(sink.emitted[1]), "subagentFinish");
    assert.strictEqual(payload.callId, callId);
  });

  test("onFunctionCall handles non-string icon", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "test_fn", args: {} } };

    // icon can be a non-string (object), should be filtered to undefined
    hooks.onFunctionCall!(part, { url: "icon" } as unknown as string);

    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(payload.icon, undefined);
  });

  test("onFunctionCallUpdate emits a functionCallUpdate event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFunctionCallUpdate!("call-1", "running");

    assert.strictEqual(sink.emitted.length, 1);
    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(eType(sink.emitted[0]), "functionCallUpdate");
    assert.strictEqual(payload.callId, "call-1");
    assert.strictEqual(payload.status, "running");
  });

  test("onFunctionResult emits a functionResult event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const content = { parts: [{ text: "result data" }] };

    hooks.onFunctionResult!("call-1", content);

    assert.strictEqual(sink.emitted.length, 1);
    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(eType(sink.emitted[0]), "functionResult");
    assert.strictEqual(payload.callId, "call-1");
    assert.deepStrictEqual(payload.content, content);
  });

  test("onTurnComplete emits a turnComplete event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onTurnComplete!();

    assert.strictEqual(sink.emitted.length, 1);
    assert.strictEqual(eType(sink.emitted[0]), "turnComplete");
  });

  test("onSendRequest emits a sendRequest event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const body = { contents: [] };

    hooks.onSendRequest!("gemini-2.0-flash", body);

    assert.strictEqual(sink.emitted.length, 1);
    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(eType(sink.emitted[0]), "sendRequest");
    assert.strictEqual(payload.model, "gemini-2.0-flash");
    assert.deepStrictEqual(payload.body, body);
  });
  test("onFunctionCall forwards args in the event", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const args = { prompt: "paint a cat", status_update: "Drawing cats" };
    const part = { functionCall: { name: "generate_images", args } };

    hooks.onFunctionCall!(part, "photo_spark", "Generating Image(s)");

    const payload = ePayload(sink.emitted[0]);
    assert.deepStrictEqual(payload.args, args);
  });

  test("onFunctionCall uses empty args when part has no args", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "test_fn", args: undefined } };

    hooks.onFunctionCall!(part as never);

    const payload = ePayload(sink.emitted[0]);
    assert.deepStrictEqual(payload.args, {});
  });

  test("onFunctionCallUpdate forwards opts", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const opts = { expectedDurationInSec: 30 };

    hooks.onFunctionCallUpdate!("call-1", "Researching", opts);

    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(payload.status, "Researching");
    assert.deepStrictEqual(payload.opts, opts);
  });

  test("onFunctionCallUpdate forwards null status", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFunctionCallUpdate!("call-1", null);

    const payload = ePayload(sink.emitted[0]);
    assert.strictEqual(payload.status, null);
    assert.strictEqual(payload.opts, undefined);
  });

  test("onFunctionCallUpdate forwards isThought opt", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    hooks.onFunctionCallUpdate!("call-1", "thinking about it", {
      isThought: true,
    });

    const payload = ePayload(sink.emitted[0]);
    assert.deepStrictEqual(payload.opts, { isThought: true });
  });

  test("subagentAddJson without icon omits it", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);
    const part = { functionCall: { name: "gen_image", args: {} } };

    const { reporter } = hooks.onFunctionCall!(part);
    reporter!.addJson("Result", { ok: true });

    const payload = ePayload(sink.emitted[1]);
    assert.strictEqual(payload.icon, undefined);
  });

  test("multiple function calls get independent reporters", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    const call1 = hooks.onFunctionCall!({
      functionCall: { name: "fn1", args: {} },
    });
    const call2 = hooks.onFunctionCall!({
      functionCall: { name: "fn2", args: {} },
    });

    call1.reporter!.addJson("from fn1", { n: 1 });
    call2.reporter!.addJson("from fn2", { n: 2 });

    // Events: functionCall, functionCall, subagentAddJson, subagentAddJson
    const sub1 = ePayload(sink.emitted[2]);
    const sub2 = ePayload(sink.emitted[3]);
    assert.strictEqual(sub1.callId, call1.callId);
    assert.strictEqual(sub2.callId, call2.callId);
    assert.strictEqual(sub1.title, "from fn1");
    assert.strictEqual(sub2.title, "from fn2");
  });

  test("full lifecycle: functionCall → subagent events → result", () => {
    const sink = createSpySink();
    const hooks = buildHooksFromSink(sink);

    // Start
    hooks.onStart!({ parts: [{ text: "Generate art" }] });

    // Function call
    const { callId, reporter } = hooks.onFunctionCall!(
      { functionCall: { name: "gen_image", args: { prompt: "a dog" } } },
      "photo_spark",
      "Generating Image(s)"
    );

    // Subagent progress
    reporter!.addJson("Preparing", { step: 1 }, "hourglass");
    reporter!.addJson("Rendering", { step: 2 }, "brush");
    reporter!.finish();

    // Function result
    hooks.onFunctionResult!(callId, {
      parts: [{ text: "Image generated" }],
    });

    // Verify event sequence
    const types = sink.emitted.map((e) => eType(e));
    assert.deepStrictEqual(types, [
      "start",
      "functionCall",
      "subagentAddJson",
      "subagentAddJson",
      "subagentFinish",
      "functionResult",
    ]);

    // Verify all subagent events scoped to the same callId
    const subEvents = sink.emitted.filter((e) =>
      eType(e).startsWith("subagent")
    );
    for (const event of subEvents) {
      assert.strictEqual(ePayload(event).callId, callId);
    }
  });
});
