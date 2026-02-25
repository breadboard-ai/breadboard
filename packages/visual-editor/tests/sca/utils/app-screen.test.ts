/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test, mock } from "node:test";
import type {
  NodeEndResponse,
  OutputResponse,
  OutputValues,
  Schema,
} from "@breadboard-ai/types";
import {
  createAppScreen,
  setScreenDuration,
  tickScreenProgress,
} from "../../../src/sca/utils/app-screen.js";
import type { AppScreenData } from "../../../src/sca/utils/app-screen.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal OutputResponse for testing `addOutput`. */
function fakeOutputResponse(
  index: string,
  outputs: OutputValues = { text: "hello" },
  schema: Schema = { type: "object" }
): OutputResponse {
  return {
    node: { id: "test-node", type: "output", configuration: { schema } },
    outputs,
    bubbled: false,
    index,
    timestamp: Date.now(),
  };
}

/** Minimal NodeEndResponse for testing `finalize`. */
function fakeNodeEndResponse(
  index: string,
  outputs: OutputValues = { result: "done" }
): NodeEndResponse {
  return {
    node: { id: "test-node", type: "output" },
    inputs: {},
    outputs,
    index,
    timestamp: Date.now(),
    newOpportunities: [],
  };
}

// ---------------------------------------------------------------------------
// createAppScreen
// ---------------------------------------------------------------------------

suite("createAppScreen", () => {
  test("returns correct initial state", () => {
    const screen = createAppScreen("Test Screen", undefined);

    assert.strictEqual(screen.title, "Test Screen");
    assert.strictEqual(screen.status, "processing");
    assert.strictEqual(screen.type, "progress");
    assert.strictEqual(screen.progress, undefined);
    assert.strictEqual(screen.expectedDuration, -1);
    assert.strictEqual(screen.progressCompletion, -1);
    assert.strictEqual(screen.lastSetDurationTimestamp, -1);
    assert.strictEqual(screen.outputs.size, 0);
    assert.strictEqual(screen.last, null);
  });

  test("addOutput stores entry and sets last", () => {
    const screen = createAppScreen("Test", undefined);
    const response = fakeOutputResponse("a");

    screen.addOutput(response);

    assert.strictEqual(screen.outputs.size, 1);
    // idFromIndex("a") → "e-a"
    const entry = screen.outputs.get("e-a");
    assert.ok(entry, "Expected output at key e-a");
    assert.deepStrictEqual(entry.output, { text: "hello" });
    assert.strictEqual(screen.last, entry);
  });

  test("addOutput uses schema from node configuration", () => {
    const schema: Schema = { type: "object", properties: { x: {} } };
    const screen = createAppScreen("Test", undefined);

    screen.addOutput(fakeOutputResponse("x", {}, schema));

    const entry = screen.outputs.get("e-x");
    assert.ok(entry);
    assert.deepStrictEqual(entry.schema, schema);
  });

  test("addOutput defaults schema to empty object when node has no configuration", () => {
    const screen = createAppScreen("Test", undefined);
    const response: OutputResponse = {
      node: { id: "n", type: "output" }, // no configuration
      outputs: {},
      bubbled: false,
      index: "z",
      timestamp: Date.now(),
    };

    screen.addOutput(response);

    const entry = screen.outputs.get("e-z");
    assert.ok(entry);
    assert.deepStrictEqual(entry.schema, {});
  });

  test("addOutput with same index overwrites previous entry", () => {
    const screen = createAppScreen("Test", undefined);

    screen.addOutput(fakeOutputResponse("k", { first: true }));
    screen.addOutput(fakeOutputResponse("k", { second: true }));

    assert.strictEqual(screen.outputs.size, 1);
    const entry = screen.outputs.get("e-k");
    assert.ok(entry);
    assert.deepStrictEqual(entry.output, { second: true });
  });

  test("multiple addOutput calls with different indices accumulate", () => {
    const screen = createAppScreen("Test", undefined);

    screen.addOutput(fakeOutputResponse("a", { a: 1 }));
    screen.addOutput(fakeOutputResponse("b", { b: 2 }));
    screen.addOutput(fakeOutputResponse("c", { c: 3 }));

    assert.strictEqual(screen.outputs.size, 3);
    assert.ok(screen.outputs.has("e-a"));
    assert.ok(screen.outputs.has("e-b"));
    assert.ok(screen.outputs.has("e-c"));
    // last should be the most recent
    assert.deepStrictEqual(screen.last?.output, { c: 3 });
  });

  test("markAsInput changes type to input", () => {
    const screen = createAppScreen("Test", undefined);
    assert.strictEqual(screen.type, "progress");

    screen.markAsInput();

    assert.strictEqual(screen.type, "input");
  });

  test("finalize stores output, sets last, and marks complete", () => {
    const outputSchema: Schema = { type: "object", properties: { r: {} } };
    const screen = createAppScreen("Test", outputSchema);

    screen.finalize(fakeNodeEndResponse("f", { result: "final" }));

    assert.strictEqual(screen.status, "complete");
    const entry = screen.outputs.get("e-f");
    assert.ok(entry, "Expected output at key e-f");
    assert.deepStrictEqual(entry.output, { result: "final" });
    assert.strictEqual(entry.schema, outputSchema);
    assert.strictEqual(screen.last, entry);
  });

  test("finalize uses the outputSchema passed to createAppScreen", () => {
    const outputSchema: Schema = { type: "string" };
    const screen = createAppScreen("Test", outputSchema);

    screen.finalize(fakeNodeEndResponse("g"));

    const entry = screen.outputs.get("e-g");
    assert.ok(entry);
    assert.strictEqual(entry.schema, outputSchema);
  });

  test("finalize with undefined outputSchema stores undefined schema", () => {
    const screen = createAppScreen("Test", undefined);

    screen.finalize(fakeNodeEndResponse("h"));

    const entry = screen.outputs.get("e-h");
    assert.ok(entry);
    assert.strictEqual(entry.schema, undefined);
  });
});

// ---------------------------------------------------------------------------
// setScreenDuration
// ---------------------------------------------------------------------------

suite("setScreenDuration", () => {
  beforeEach(() => {
    mock.method(performance, "now", () => 1000);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("sets positive duration and records timestamp", () => {
    const screen = createAppScreen("Test", undefined);

    setScreenDuration(screen, 5);

    assert.strictEqual(screen.expectedDuration, 5);
    assert.strictEqual(screen.progressCompletion, 0);
    assert.strictEqual(
      (screen as AppScreenData).lastSetDurationTimestamp,
      1000
    );
  });

  test("clears duration with -1", () => {
    const screen = createAppScreen("Test", undefined);

    // First set a positive duration.
    setScreenDuration(screen, 10);
    assert.strictEqual(screen.expectedDuration, 10);
    assert.strictEqual(screen.progressCompletion, 0);

    // Now clear it.
    setScreenDuration(screen, -1);

    assert.strictEqual(screen.expectedDuration, -1);
    assert.strictEqual(screen.progressCompletion, -1);
    assert.strictEqual((screen as AppScreenData).lastSetDurationTimestamp, -1);
  });

  test("overwrites previous duration", () => {
    const screen = createAppScreen("Test", undefined);

    setScreenDuration(screen, 5);
    setScreenDuration(screen, 30);

    assert.strictEqual(screen.expectedDuration, 30);
    assert.strictEqual(screen.progressCompletion, 0);
  });
});

// ---------------------------------------------------------------------------
// tickScreenProgress
// ---------------------------------------------------------------------------

suite("tickScreenProgress", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test("is a no-op when no duration is set", () => {
    const screen = createAppScreen("Test", undefined);

    tickScreenProgress(screen);

    // progressCompletion should remain at the initial -1
    assert.strictEqual(screen.progressCompletion, -1);
  });

  test("is a no-op after duration is cleared", () => {
    // Set a duration, then clear it.
    mock.method(performance, "now", () => 1000);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10);
    setScreenDuration(screen, -1);

    tickScreenProgress(screen);

    assert.strictEqual(screen.progressCompletion, -1);
  });

  test("computes progress at the start (0% elapsed)", () => {
    // Set duration at t=1000, then tick at t=1000 (0 elapsed).
    mock.method(performance, "now", () => 1000);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10);

    tickScreenProgress(screen);

    // 0 elapsed / (10 * 1000) = fraction 0 → elasticProgress(0) = 0 → 0%
    assert.strictEqual(screen.progressCompletion, 0);
  });

  test("computes progress partway through (linear phase)", () => {
    let now = 1000;
    mock.method(performance, "now", () => now);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10); // 10 seconds

    // Advance 5 seconds (5000ms). fraction = 5000 / 10000 = 0.5
    // 0.5 is below the default knee (0.75) so elastic returns 0.5 exactly.
    now = 6000;
    tickScreenProgress(screen);

    assert.strictEqual(screen.progressCompletion, 50);
  });

  test("computes progress in elastic phase (past knee)", () => {
    let now = 1000;
    mock.method(performance, "now", () => now);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10); // 10 seconds

    // Advance 9 seconds. fraction = 9000 / 10000 = 0.9 (past 0.75 knee)
    now = 10000;
    tickScreenProgress(screen);

    // Should be > 75% (past knee) but < 100% (elastic never reaches 100)
    assert.ok(
      screen.progressCompletion > 75,
      `Expected > 75, got ${screen.progressCompletion}`
    );
    assert.ok(
      screen.progressCompletion < 100,
      `Expected < 100, got ${screen.progressCompletion}`
    );
  });

  test("stays below 100% when moderately past expected duration", () => {
    let now = 1000;
    mock.method(performance, "now", () => now);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10); // 10 seconds

    // Advance 20 seconds (2x the expected duration).
    now = 21000;
    tickScreenProgress(screen);

    assert.ok(
      screen.progressCompletion < 100,
      `Expected < 100, got ${screen.progressCompletion}`
    );
    assert.ok(
      screen.progressCompletion >= 95,
      `Expected >= 95 (asymptotic), got ${screen.progressCompletion}`
    );
  });

  test("progress increases monotonically over time", () => {
    let now = 1000;
    mock.method(performance, "now", () => now);
    const screen = createAppScreen("Test", undefined);
    setScreenDuration(screen, 10);

    let prev = -1;
    for (let seconds = 0; seconds <= 20; seconds++) {
      now = 1000 + seconds * 1000;
      tickScreenProgress(screen);
      assert.ok(
        screen.progressCompletion >= prev,
        `Not monotonic at ${seconds}s: ${screen.progressCompletion} < ${prev}`
      );
      prev = screen.progressCompletion;
    }
  });
});
