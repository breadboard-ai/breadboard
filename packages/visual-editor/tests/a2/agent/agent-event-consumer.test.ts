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
} from "../../../src/a2/agent/agent-event-consumer.js";
import type { AgentEvent } from "../../../src/a2/agent/agent-event.js";

suite("AgentEventConsumer", () => {
  test("dispatches events to registered handlers", () => {
    const consumer = new AgentEventConsumer();
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(event.text);
    });

    consumer.handle({ type: "thought", text: "hello" });
    consumer.handle({ type: "thought", text: "world" });

    assert.deepStrictEqual(received, ["hello", "world"]);
  });

  test("ignores events with no registered handler", () => {
    const consumer = new AgentEventConsumer();

    // Should not throw
    const result = consumer.handle({ type: "thought", text: "no handler" });
    assert.strictEqual(result, undefined);
  });

  test("on() is chainable", () => {
    const consumer = new AgentEventConsumer();
    const thoughts: string[] = [];
    const contents: AgentEvent[] = [];

    const returned = consumer
      .on("thought", (event) => {
        thoughts.push(event.text);
      })
      .on("content", (event) => {
        contents.push(event);
      });

    assert.strictEqual(returned, consumer, "on() should return this");

    consumer.handle({ type: "thought", text: "thinking" });
    consumer.handle({
      type: "content",
      content: { parts: [{ text: "result" }] },
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
      type: "waitForInput",
      requestId: "req-1",
      inputType: "text",
      prompt: { parts: [{ text: "What next?" }] },
    });

    assert.ok(result instanceof Promise);
    assert.strictEqual(await result, "user typed this");
  });

  test("handle() returns undefined for fire-and-forget events", () => {
    const consumer = new AgentEventConsumer();
    consumer.on("thought", () => {
      // void handler
    });

    const result = consumer.handle({ type: "thought", text: "hi" });
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

    consumer.handle({ type: "thought", text: "test" });
    assert.deepStrictEqual(calls, ["second"]);
  });
});

suite("LocalAgentEventBridge", () => {
  test("emit() delegates to consumer.handle()", () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);
    const received: string[] = [];

    consumer.on("thought", (event) => {
      received.push(event.text);
    });

    bridge.emit({ type: "thought", text: "via bridge" });
    assert.deepStrictEqual(received, ["via bridge"]);
  });

  test("suspend() returns the consumer handler's Promise", async () => {
    const consumer = new AgentEventConsumer();
    const bridge = new LocalAgentEventBridge(consumer);

    consumer.on("waitForInput", () => {
      return Promise.resolve("reply from UI");
    });

    const result = await bridge.suspend<string>({
      type: "waitForInput",
      requestId: "req-2",
      inputType: "text",
      prompt: { parts: [{ text: "Enter input" }] },
    });

    assert.strictEqual(result, "reply from UI");
  });
});
