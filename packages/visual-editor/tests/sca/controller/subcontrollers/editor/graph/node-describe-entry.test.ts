/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  NodeDescribeEntry,
  emptyResult,
} from "../../../../../../src/sca/controller/subcontrollers/editor/graph/node-describe-entry.js";
import type { NodeDescriber } from "../../../../../../src/sca/controller/subcontrollers/editor/graph/node-describer.js";

suite("NodeDescribeEntry", () => {
  const fakeResult = {
    inputSchema: {
      type: "object" as const,
      properties: { text: { type: "string" } },
    },
    outputSchema: {
      type: "object" as const,
      properties: { out: { type: "string" } },
    },
  };

  test("constructor fetches describe result asynchronously", async () => {
    const describer: NodeDescriber = async () => fakeResult;
    const entry = new NodeDescribeEntry(describer, "test-type", {});

    // Synchronous snapshot should start with empty + updating
    const snap = entry.snapshot();
    assert.strictEqual(snap.updating, true, "should be updating initially");
    assert.deepStrictEqual(
      snap.current,
      emptyResult(),
      "current should start empty"
    );

    // Wait for async fetch to complete
    const latest = await snap.latest;
    assert.deepStrictEqual(
      latest,
      fakeResult,
      "latest should resolve to fetched result"
    );

    // After resolution, snapshot should reflect the result
    const snapAfter = entry.snapshot();
    assert.strictEqual(
      snapAfter.updating,
      false,
      "should not be updating after fetch"
    );
    assert.deepStrictEqual(
      snapAfter.current,
      fakeResult,
      "current should be updated"
    );
  });

  test("snapshot returns current value when describer throws", async () => {
    const describer: NodeDescriber = async () => {
      throw new Error("describe failed");
    };
    const entry = new NodeDescribeEntry(describer, "broken-type", {});

    // Wait for the fetch to complete (it should catch the error)
    const latest = await entry.snapshot().latest;

    // Should fall back to the empty result (the initial current value)
    assert.deepStrictEqual(
      latest,
      emptyResult(),
      "should return empty result on error"
    );

    const snap = entry.snapshot();
    assert.strictEqual(
      snap.updating,
      false,
      "should stop updating after error"
    );
    assert.deepStrictEqual(
      snap.current,
      emptyResult(),
      "current should remain unchanged"
    );
  });

  test("refresh() updates configuration and re-fetches", async () => {
    let callCount = 0;
    let lastConfig: Record<string, unknown> = {};

    const describer: NodeDescriber = async (_type, config) => {
      callCount++;
      lastConfig = config as Record<string, unknown>;
      return {
        inputSchema: { type: "object", properties: { x: { type: "number" } } },
        outputSchema: { type: "object" },
      };
    };

    const entry = new NodeDescribeEntry(describer, "my-type", {
      initial: true,
    });

    // Wait for initial fetch
    await entry.snapshot().latest;
    assert.strictEqual(callCount, 1, "should fetch once on construction");
    assert.deepStrictEqual(lastConfig, { initial: true });

    // Refresh with new config
    entry.refresh({ updated: true });

    // Should be updating again
    assert.strictEqual(
      entry.snapshot().updating,
      true,
      "should be updating after refresh"
    );

    // Wait for the re-fetch
    await entry.snapshot().latest;
    assert.strictEqual(callCount, 2, "should fetch again after refresh");
    assert.deepStrictEqual(
      lastConfig,
      { updated: true },
      "should use new config"
    );
    assert.strictEqual(
      entry.snapshot().updating,
      false,
      "should stop updating after refresh"
    );
  });

  test("refresh() recovers after previous error", async () => {
    let shouldFail = true;
    const describer: NodeDescriber = async () => {
      if (shouldFail) throw new Error("temporary failure");
      return fakeResult;
    };

    const entry = new NodeDescribeEntry(describer, "flaky-type", {});

    // First fetch fails
    await entry.snapshot().latest;
    assert.deepStrictEqual(
      entry.snapshot().current,
      emptyResult(),
      "should be empty after error"
    );

    // Fix the describer and refresh
    shouldFail = false;
    entry.refresh({ retried: true });
    await entry.snapshot().latest;

    assert.deepStrictEqual(
      entry.snapshot().current,
      fakeResult,
      "should recover on retry"
    );
    assert.strictEqual(entry.snapshot().updating, false);
  });

  test("emptyResult returns a fresh object each time", () => {
    const a = emptyResult();
    const b = emptyResult();
    assert.notStrictEqual(a, b, "should be distinct objects");
    assert.deepStrictEqual(a, b, "should have identical content");
  });
});
