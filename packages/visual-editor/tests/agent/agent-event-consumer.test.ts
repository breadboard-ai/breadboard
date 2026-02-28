/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  AgentEventConsumer,
  LocalAgentEventBridge,
} from "../../src/a2/agent/agent-event-consumer.js";
import type {
  SubagentAddJsonPayload,
  SubagentErrorPayload,
  SubagentFinishPayload,
  FunctionCallPayload,
} from "../../src/a2/agent/agent-event.js";

suite("AgentEventConsumer", () => {
  test("dispatches events to registered handlers", () => {
    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(payload.text);
    });

    consumer.handle({ thought: { text: "hello" } });
    consumer.handle({ thought: { text: "world" } });

    assert.deepStrictEqual(received, ["hello", "world"]);
  });

  test("ignores events with no registered handler", () => {
    const consumer = new AgentEventConsumer();

    // Should not throw
    const result = consumer.handle({ thought: { text: "no handler" } });
    assert.strictEqual(result, undefined);
  });

  test("on() is chainable", () => {
    const consumer = new AgentEventConsumer();
    const thoughts: string[] = [];
    const contents: unknown[] = [];

    const returned = consumer
      .on("thought", (payload) => {
        thoughts.push(payload.text);
      })
      .on("content", (payload) => {
        contents.push(payload);
      });

    assert.strictEqual(returned, consumer, "on() should return this");

    consumer.handle({ thought: { text: "thinking" } });
    consumer.handle({
      content: { content: { parts: [{ text: "result" }] } },
    });

    assert.strictEqual(thoughts.length, 1);
    assert.strictEqual(contents.length, 1);
  });

  test("handle() returns Promise from suspend-event handler", async () => {
    const consumer = new AgentEventConsumer();

    consumer.on("waitForInput", () => {
      return Promise.resolve("user typed this");
    });

    const result = consumer.handle({
      waitForInput: {
        requestId: "req-1",
        inputType: "text",
        prompt: { parts: [{ text: "What next?" }] },
      },
    });

    assert.ok(result instanceof Promise);
    assert.strictEqual(await result, "user typed this");
  });

  test("handle() returns undefined for fire-and-forget events", () => {
    const consumer = new AgentEventConsumer();
    consumer.on("thought", () => {
      // void handler
    });

    const result = consumer.handle({ thought: { text: "hi" } });
    assert.strictEqual(result, undefined);
  });

  test("later handler registration replaces earlier one", () => {
    const consumer = new AgentEventConsumer();
    const calls: string[] = [];

    consumer.on("thought", () => {
      calls.push("first");
    });
    consumer.on("thought", () => {
      calls.push("second");
    });

    consumer.handle({ thought: { text: "test" } });
    assert.deepStrictEqual(calls, ["second"]);
  });
});

suite("LocalAgentEventBridge", () => {
  test("emit() delegates to consumer.handle()", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const received: string[] = [];

    consumer.on("thought", (payload) => {
      received.push(payload.text);
    });

    bridge.emit({ thought: { text: "via bridge" } });
    assert.deepStrictEqual(received, ["via bridge"]);
  });

  test("suspend() returns the consumer handler's Promise", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    consumer.on("waitForInput", () => {
      return Promise.resolve("reply from UI");
    });

    const result = await bridge.suspend<string>({
      waitForInput: {
        requestId: "req-2",
        inputType: "text",
        prompt: { parts: [{ text: "Enter input" }] },
      },
    });

    assert.strictEqual(result, "reply from UI");
  });

  test("emits subagent events through the bridge intact", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const addJsonPayloads: SubagentAddJsonPayload[] = [];
    const errorPayloads: SubagentErrorPayload[] = [];
    const finishPayloads: SubagentFinishPayload[] = [];

    consumer
      .on("subagentAddJson", (payload) => {
        addJsonPayloads.push(payload);
      })
      .on("subagentError", (payload) => {
        errorPayloads.push(payload);
      })
      .on("subagentFinish", (payload) => {
        finishPayloads.push(payload);
      });

    bridge.emit({
      subagentAddJson: {
        callId: "c1",
        title: "Image ready",
        data: { url: "http://img" },
        icon: "photo",
      },
    });
    bridge.emit({
      subagentError: {
        callId: "c1",
        error: { $error: "fail" },
      },
    });
    bridge.emit({ subagentFinish: { callId: "c1" } });

    assert.strictEqual(addJsonPayloads.length, 1);
    assert.strictEqual(errorPayloads.length, 1);
    assert.strictEqual(finishPayloads.length, 1);

    assert.strictEqual(addJsonPayloads[0].callId, "c1");
    assert.strictEqual(addJsonPayloads[0].title, "Image ready");
    assert.deepStrictEqual(addJsonPayloads[0].data, { url: "http://img" });
    assert.strictEqual(addJsonPayloads[0].icon, "photo");
  });

  test("functionCall event preserves args through the bridge", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const received: FunctionCallPayload[] = [];

    consumer.on("functionCall", (payload) => {
      received.push(payload);
    });

    bridge.emit({
      functionCall: {
        callId: "call-99",
        name: "generate_text",
        args: { prompt: "hello", status_update: "Writing a poem" },
        icon: "text_analysis",
        title: "Generating Text",
      },
    });

    assert.strictEqual(received.length, 1);
    const payload = received[0];
    assert.deepStrictEqual(payload.args, {
      prompt: "hello",
      status_update: "Writing a poem",
    });
    assert.strictEqual(payload.name, "generate_text");
    assert.strictEqual(payload.icon, "text_analysis");
    assert.strictEqual(payload.title, "Generating Text");
  });
});
