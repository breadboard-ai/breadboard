/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { Signal } from "signal-polyfill";

describe("AppScreen", () => {
  let ReactiveAppScreen: any;
  let getElasticProgress: any;

  before(async () => {
    // Mock setInterval to prevent the top-level interval in app-screen.ts from keeping the process alive.
    // We do this before importing the module.
    global.setInterval = (() => {
      return {} as NodeJS.Timeout;
    }) as unknown as typeof global.setInterval;

    // Dynamic import to ensure setInterval is mocked before the module executes.
    const module = await import("../state/app-screen.js");
    ReactiveAppScreen = module.ReactiveAppScreen;
    getElasticProgress = module.getElasticProgress;
  });

  describe("getElasticProgress", () => {
    it("returns linear progress before knee", () => {
      assert.strictEqual(getElasticProgress(0.5, 0.75), 0.5);
      assert.strictEqual(getElasticProgress(0.75, 0.75), 0.75);
    });

    it("returns elastic progress after knee", () => {
      const progress = getElasticProgress(0.8, 0.75);
      assert.ok(progress > 0.75);
      assert.ok(progress < 1.0);
    });

    it("never reaches 1.0", () => {
      // Use a reasonable large number.
      // Note: if the number is too large, Math.exp will underflow to 0 and we'll hit 1.0 due to precision.
      const progress = getElasticProgress(2.0, 0.75);
      assert.ok(progress < 1.0);
    });
  });

  describe("ReactiveAppScreen", () => {
    it("initializes with default values", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      assert.strictEqual(screen.title, "test");
      assert.strictEqual(screen.status, "processing");
      assert.strictEqual(screen.type, "progress");
      assert.strictEqual(screen.outputs.size, 0);
    });

    it("adds output correctly", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      const data = {
        node: { id: "node1", configuration: {} },
        outputs: { foo: "bar" },
        path: [0],
        timestamp: 0,
      };
      screen.addOutput(data, null);
      assert.strictEqual(screen.outputs.size, 1);
      const output = screen.last;
      assert.deepStrictEqual(output?.output, { foo: "bar" });
      assert.strictEqual(screen.outputs.get("e-0")?.output, data.outputs);
    });

    it("marks as input", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      screen.markAsInput();
      assert.strictEqual(screen.type, "input");
    });

    it("triggers watcher when status changes", async () => {
      const screen = new ReactiveAppScreen("test", undefined);
      let triggerCount = 0;
      const computed = new Signal.Computed(() => screen.status);
      const watcher = new Signal.subtle.Watcher(() => {
        triggerCount++;
      });
      watcher.watch(computed);

      // Pull once to activate
      computed.get();
      assert.strictEqual(triggerCount, 0);

      // Change status
      const data = {
        node: { id: "node1" },
        outputs: { result: "done" },
        path: [0],
        timestamp: 0,
      };
      screen.finalize(data);

      // In signal-polyfill, watchers are notified synchronously of dirtiness.
      // However, we might need to pull again or wait for microtask depending on implementation details.
      // But typically, the notification happens when dependency changes.
      // Let's check if it triggered.

      // Actually, standard signal watcher notifies when it *might* have changed (stale).
      // We often need to read it to confirm.
      // But let's assert triggerCount > 0.
      assert.ok(triggerCount > 0, "Watcher should have been triggered");
    });

    it("finalizes correctly", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      const data = {
        node: { id: "node1" },
        outputs: { result: "done" },
        path: [0],
        timestamp: 0,
      };
      screen.finalize(data);
      assert.strictEqual(screen.status, "complete");
      assert.strictEqual(screen.outputs.size, 1);
      assert.deepStrictEqual(screen.last?.output, { result: "done" });
    });

    it("handles expectedDuration updates", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);

      screen.expectedDuration = 10;
      assert.strictEqual(screen.expectedDuration, 10);
      // Can't easily test progressCompletion value without mocking time/signal,
      // but we can verify it doesn't crash and returns a number
      assert.ok(typeof screen.progressCompletion === "number");

      screen.expectedDuration = -1;
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);
    });
  });
});
