/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { AgentService } from "../../src/a2/agent/agent-service.js";
import type { LocalAgentRun } from "../../src/a2/agent/local-agent-run.js";

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

suite("LocalAgentRun (via AgentRunHandle)", () => {
  test("provides events consumer and sink", () => {
    const service = new AgentService();
    const handle = service.startRun({
      kind: "test",
      objective: OBJECTIVE,
    }) as LocalAgentRun;

    assert.ok(handle.events, "should have events consumer");
    assert.ok(handle.sink, "should have sink");

    service.endRun(handle.runId);
  });

  test("sink emits reach the consumer", () => {
    const service = new AgentService();
    const handle = service.startRun({
      kind: "test",
      objective: OBJECTIVE,
    }) as LocalAgentRun;
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

  test("subagent events flow from sink to consumer", () => {
    const service = new AgentService();
    const handle = service.startRun({
      kind: "test",
      objective: OBJECTIVE,
    }) as LocalAgentRun;
    const received: { type: string; callId: string }[] = [];

    handle.events
      .on("subagentAddJson", (event) => {
        received.push({ type: event.type, callId: event.callId });
      })
      .on("subagentError", (event) => {
        received.push({ type: event.type, callId: event.callId });
      })
      .on("subagentFinish", (event) => {
        received.push({ type: event.type, callId: event.callId });
      });

    handle.sink.emit({
      type: "subagentAddJson",
      callId: "c1",
      title: "Step 1",
      data: { progress: 0.5 },
      icon: "hourglass",
    });
    handle.sink.emit({
      type: "subagentError",
      callId: "c1",
      error: { $error: "timeout" },
    });
    handle.sink.emit({ type: "subagentFinish", callId: "c1" });

    assert.strictEqual(received.length, 3);
    assert.deepStrictEqual(
      received.map((r) => r.type),
      ["subagentAddJson", "subagentError", "subagentFinish"]
    );
    // All scoped to same callId
    for (const r of received) {
      assert.strictEqual(r.callId, "c1");
    }

    service.endRun(handle.runId);
  });

  test("functionCall event with args survives sink→consumer round-trip", () => {
    const service = new AgentService();
    const handle = service.startRun({
      kind: "test",
      objective: OBJECTIVE,
    }) as LocalAgentRun;
    const received: Array<{ name: string; args: Record<string, unknown> }> = [];

    handle.events.on("functionCall", (event) => {
      received.push({ name: event.name, args: event.args });
    });

    handle.sink.emit({
      type: "functionCall",
      callId: "fc-1",
      name: "generate_text",
      args: { prompt: "hello world", status_update: "Writing text" },
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].name, "generate_text");
    assert.deepStrictEqual(received[0].args, {
      prompt: "hello world",
      status_update: "Writing text",
    });

    service.endRun(handle.runId);
  });
});

suite("AgentService — Remote Mode", () => {
  test("isRemote is false by default", () => {
    const service = new AgentService();
    assert.strictEqual(service.isRemote, false);
  });

  test("isRemote is true after configureRemote", () => {
    const service = new AgentService();
    service.configureRemote("http://localhost:8080");
    assert.strictEqual(service.isRemote, true);
  });

  test("isRemote reverts to false when set to null", () => {
    const service = new AgentService();
    service.configureRemote("http://localhost:8080");
    assert.strictEqual(service.isRemote, true);

    service.configureRemote(null);
    assert.strictEqual(service.isRemote, false);
  });

  test("startRun in local mode accepts LocalAgentRunConfig", () => {
    const service = new AgentService();
    // Should not throw — local mode accepts objective
    const handle = service.startRun({ kind: "test", objective: OBJECTIVE });
    assert.ok(handle.runId);
    service.endRun(handle.runId);
  });

  test("startRun in remote mode rejects LocalAgentRunConfig", () => {
    const service = new AgentService();
    service.configureRemote("http://localhost:8080", fakeFetch);

    assert.throws(
      () => service.startRun({ kind: "test", objective: OBJECTIVE }),
      { message: /Remote mode requires RemoteAgentRunConfig/ }
    );
  });

  test("startRun in remote mode accepts RemoteAgentRunConfig", () => {
    const service = new AgentService();
    service.configureRemote("http://localhost:8080", fakeFetch);

    const handle = service.startRun({
      kind: "test",
      segments: [{ type: "text", text: "hello" }],
      flags: { useNotebookLM: false },
    });
    assert.ok(handle.runId);
    assert.strictEqual(handle.kind, "test");
    service.endRun(handle.runId);
  });
});

/**
 * Minimal fetch stub for remote mode tests.
 * SSEAgentRun constructs the source but we don't call connect(),
 * so this is never actually invoked.
 */
function fakeFetch(): Promise<Response> {
  return Promise.resolve(new Response());
}
