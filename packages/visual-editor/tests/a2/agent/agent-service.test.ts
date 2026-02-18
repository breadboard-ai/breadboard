/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { AgentService } from "../../../src/a2/agent/agent-service.js";

const OBJECTIVE = { parts: [{ text: "test" }] };

suite("AgentService", () => {
  test("startRun returns a handle with a unique runId", () => {
    const service = new AgentService();
    const h1 = service.startRun({ kind: "test", objective: OBJECTIVE });
    const h2 = service.startRun({ kind: "test", objective: OBJECTIVE });

    assert.ok(h1.runId, "runId should be truthy");
    assert.ok(h2.runId, "runId should be truthy");
    assert.notStrictEqual(h1.runId, h2.runId, "runIds should be unique");

    service.endRun(h1.runId);
    service.endRun(h2.runId);
  });

  test("startRun preserves the kind from config", () => {
    const service = new AgentService();
    const handle = service.startRun({
      kind: "graph-editing",
      objective: OBJECTIVE,
    });
    assert.strictEqual(handle.kind, "graph-editing");
    service.endRun(handle.runId);
  });

  test("getRun returns the handle for a live run", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });

    const retrieved = service.getRun(handle.runId);
    assert.strictEqual(retrieved, handle);

    service.endRun(handle.runId);
  });

  test("getRun returns undefined for unknown runId", () => {
    const service = new AgentService();
    assert.strictEqual(service.getRun("nonexistent"), undefined);
  });

  test("endRun removes the run", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });
    service.endRun(handle.runId);

    assert.strictEqual(service.getRun(handle.runId), undefined);
    assert.deepStrictEqual(service.activeRunIds, []);
  });

  test("endRun is safe for unknown runId", () => {
    const service = new AgentService();
    // Should not throw
    service.endRun("nonexistent");
  });

  test("activeRunIds lists all live runs", () => {
    const service = new AgentService();
    const h1 = service.startRun({ kind: "a", objective: OBJECTIVE });
    const h2 = service.startRun({ kind: "b", objective: OBJECTIVE });

    const ids = service.activeRunIds;
    assert.strictEqual(ids.length, 2);
    assert.ok(ids.includes(h1.runId));
    assert.ok(ids.includes(h2.runId));

    service.endRun(h1.runId);
    service.endRun(h2.runId);
  });
});

suite("AgentRunHandle (via AgentRun)", () => {
  test("provides events consumer and sink", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });

    assert.ok(handle.events, "should have events consumer");
    assert.ok(handle.sink, "should have sink");

    service.endRun(handle.runId);
  });

  test("sink emits reach the consumer", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });
    const received: string[] = [];

    handle.events.on("thought", (event: { text: string }) => {
      received.push(event.text);
    });

    handle.sink.emit({ type: "thought", text: "hello" });
    assert.deepStrictEqual(received, ["hello"]);

    service.endRun(handle.runId);
  });

  test("abort() sets aborted and fires signal", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });

    assert.strictEqual(handle.aborted, false);
    assert.strictEqual(handle.signal.aborted, false);

    handle.abort();

    assert.strictEqual(handle.aborted, true);
    assert.strictEqual(handle.signal.aborted, true);

    service.endRun(handle.runId);
  });

  test("signal is an AbortSignal", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });

    assert.ok(handle.signal instanceof AbortSignal);

    service.endRun(handle.runId);
  });

  test("double abort does not throw", () => {
    const service = new AgentService();
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });

    handle.abort();
    handle.abort();
    assert.ok(true, "double abort is safe");

    service.endRun(handle.runId);
  });
});
