/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test } from "node:test";
import {
  dispatchRun,
  dispatchStop,
} from "../../../../../src/sca/actions/run/helpers/dispatch.js";
import type { HarnessRunner } from "@breadboard-ai/types";

suite("dispatch helpers", () => {
  // ---------------------------------------------------------------------------
  // dispatchStop
  // ---------------------------------------------------------------------------
  suite("dispatchStop", () => {
    test("calls runner.stop with node ID", () => {
      const stopFn = mock.fn(() => Promise.resolve({}));
      const runner = { stop: stopFn } as unknown as HarnessRunner;

      dispatchStop("node-1", runner);

      assert.strictEqual(stopFn.mock.callCount(), 1, "stop should be called");
      assert.strictEqual(
        (stopFn.mock.calls[0] as { arguments: unknown[] }).arguments[0],
        "node-1",
        "should pass correct node ID"
      );
    });

    test("handles null runner gracefully", () => {
      // Should not throw.
      dispatchStop("node-1", null);
    });

    test("handles runner without stop method", () => {
      const runner = {} as unknown as HarnessRunner;
      // Should not throw.
      dispatchStop("node-1", runner);
    });

    test("handles error outcome from stop", async () => {
      const stopFn = mock.fn(() =>
        Promise.resolve({ $error: "something failed" })
      );
      const runner = { stop: stopFn } as unknown as HarnessRunner;

      dispatchStop("node-1", runner);

      // Wait for the promise to settle.
      await new Promise<void>((r) => queueMicrotask(r));

      // No assertion needed — we confirm it doesn't throw.
      assert.ok(true, "should handle error outcome without throwing");
    });

    test("handles rejected stop promise", async () => {
      const stopFn = mock.fn(() => Promise.reject(new Error("failed")));
      const runner = { stop: stopFn } as unknown as HarnessRunner;

      dispatchStop("node-1", runner);

      // Wait for the promise to settle.
      await new Promise<void>((r) => setTimeout(r, 10));

      assert.ok(true, "should handle rejection without throwing");
    });
  });

  // ---------------------------------------------------------------------------
  // dispatchRun
  // ---------------------------------------------------------------------------
  suite("dispatchRun", () => {
    test("calls runner.runFrom when runFromNode is true", () => {
      const runFromFn = mock.fn(() => Promise.resolve({}));
      const runner = { runFrom: runFromFn } as unknown as HarnessRunner;

      dispatchRun(true, "node-1", runner);

      assert.strictEqual(
        runFromFn.mock.callCount(),
        1,
        "runFrom should be called"
      );
      assert.strictEqual(
        (runFromFn.mock.calls[0] as { arguments: unknown[] }).arguments[0],
        "node-1",
        "should pass correct node ID"
      );
    });

    test("calls runner.runNode when runFromNode is false", () => {
      const runNodeFn = mock.fn(() => Promise.resolve({}));
      const runner = { runNode: runNodeFn } as unknown as HarnessRunner;

      dispatchRun(false, "node-1", runner);

      assert.strictEqual(
        runNodeFn.mock.callCount(),
        1,
        "runNode should be called"
      );
      assert.strictEqual(
        (runNodeFn.mock.calls[0] as { arguments: unknown[] }).arguments[0],
        "node-1",
        "should pass correct node ID"
      );
    });

    test("handles null runner gracefully for runFrom", () => {
      // Should not throw.
      dispatchRun(true, "node-1", null);
    });

    test("handles null runner gracefully for runNode", () => {
      // Should not throw.
      dispatchRun(false, "node-1", null);
    });

    test("handles runner without runFrom method", () => {
      const runner = {} as unknown as HarnessRunner;
      // Should not throw.
      dispatchRun(true, "node-1", runner);
    });

    test("handles runner without runNode method", () => {
      const runner = {} as unknown as HarnessRunner;
      // Should not throw.
      dispatchRun(false, "node-1", runner);
    });

    test("handles error outcome from runFrom", async () => {
      const runFromFn = mock.fn(() =>
        Promise.resolve({ $error: "run from failed" })
      );
      const runner = { runFrom: runFromFn } as unknown as HarnessRunner;

      dispatchRun(true, "node-1", runner);

      await new Promise<void>((r) => queueMicrotask(r));

      assert.ok(true, "should handle error outcome without throwing");
    });

    test("handles error outcome from runNode", async () => {
      const runNodeFn = mock.fn(() =>
        Promise.resolve({ $error: "run node failed" })
      );
      const runner = { runNode: runNodeFn } as unknown as HarnessRunner;

      dispatchRun(false, "node-1", runner);

      await new Promise<void>((r) => queueMicrotask(r));

      assert.ok(true, "should handle error outcome without throwing");
    });

    test("handles rejected runFrom promise", async () => {
      const runFromFn = mock.fn(() => Promise.reject(new Error("boom")));
      const runner = { runFrom: runFromFn } as unknown as HarnessRunner;

      dispatchRun(true, "node-1", runner);

      await new Promise<void>((r) => setTimeout(r, 10));

      assert.ok(true, "should handle rejection without throwing");
    });

    test("handles rejected runNode promise", async () => {
      const runNodeFn = mock.fn(() => Promise.reject(new Error("boom")));
      const runner = { runNode: runNodeFn } as unknown as HarnessRunner;

      dispatchRun(false, "node-1", runner);

      await new Promise<void>((r) => setTimeout(r, 10));

      assert.ok(true, "should handle rejection without throwing");
    });
  });
});
