/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";
import { Signal } from "signal-polyfill";
import { SignalWatcher } from "./signal-watcher.js";

describe("AppScreen", () => {
  let ReactiveAppScreen: any;
  let getElasticProgress: any;
  let intervalCallback: (() => void) | undefined;
  let currentTime = 1000; // Start at non-zero time

  before(async () => {
    // Mock performance.now
    // We need to do this on the global object for it to be picked up by the module
    Object.defineProperty(global, "performance", {
      value: {
        now: () => currentTime,
      },
      writable: true,
    });

    // Mock setInterval to capture the callback
    global.setInterval = ((callback: () => void) => {
      intervalCallback = callback;
      return {} as NodeJS.Timeout;
    }) as unknown as typeof global.setInterval;

    // Dynamic import to ensure mocks are in place before module execution
    // We use a query param to bypass cache if needed, though usually not needed in this context
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
      const computed = new Signal.Computed(() => screen.status);
      const watcher = new SignalWatcher(computed);
      watcher.watch();

      assert.strictEqual(watcher.count, 0);

      // Change status
      const data = {
        node: { id: "node1" },
        outputs: { result: "done" },
        path: [0],
        timestamp: 0,
      };
      screen.finalize(data);

      assert.ok(watcher.count > 0, "Watcher should have been triggered");
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

    it("triggers watcher on progressCompletion updates", async () => {
      const screen = new ReactiveAppScreen("test", undefined);
      const computed = new Signal.Computed(() => screen.progressCompletion);
      const watcher = new SignalWatcher(computed);
      watcher.watch();

      assert.strictEqual(watcher.count, 0);

      // 1. Set expected duration
      currentTime = 1000;
      screen.expectedDuration = 10;
      // Watcher should trigger because expectedDuration changed
      assert.ok(
        watcher.count > 0,
        "Watcher should trigger after setting expectedDuration"
      );
      const countAfterSet = watcher.count;

      // Re-watch if necessary (signal-polyfill watchers might be one-shot)
      watcher.watch();

      // 2. Advance time
      currentTime = 2000;
      assert.ok(intervalCallback, "intervalCallback should be defined");
      if (intervalCallback) intervalCallback();

      // This updates 'now' signal. progressCompletion depends on 'now'.
      // Watcher should trigger.
      assert.ok(
        watcher.count > countAfterSet,
        "Watcher should trigger after time update"
      );
      const countAfterTime = watcher.count;

      // Re-watch if necessary
      watcher.watch();

      // 3. Reset expected duration
      screen.expectedDuration = -1;
      assert.ok(
        watcher.count > countAfterTime,
        "Watcher should trigger after resetting expectedDuration"
      );
    });

    it("handles expectedDuration updates and progress calculation", () => {
      const screen = new ReactiveAppScreen("test", undefined);
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);

      // Set expected duration to 10 seconds
      currentTime = 1000; // Reset time
      screen.expectedDuration = 10;
      assert.strictEqual(screen.expectedDuration, 10);

      // At t=0 (relative to set time), progress should be 0
      // We need to trigger the interval to update 'now' signal
      if (intervalCallback) intervalCallback();

      // progressCompletion = (now - lastSet) / (duration * 1000)
      // (1000 - 1000) / 10000 = 0
      assert.strictEqual(screen.progressCompletion, 0);

      // Advance time by 5 seconds (50% progress)
      currentTime = 6000; // 1000 + 5000
      if (intervalCallback) intervalCallback();

      // (6000 - 1000) / 10000 = 0.5
      // getElasticProgress(0.5) = 0.5
      // 0.5 * 100 = 50
      assert.strictEqual(screen.progressCompletion, 50);

      // Advance time by 7.5 seconds (75% progress - knee)
      currentTime = 8500; // 1000 + 7500
      if (intervalCallback) intervalCallback();

      // (8500 - 1000) / 10000 = 0.75
      // getElasticProgress(0.75) = 0.75
      // 0.75 * 100 = 75
      assert.strictEqual(screen.progressCompletion, 75);

      // Advance time by 10 seconds (100% linear time, but elastic)
      currentTime = 11000; // 1000 + 10000
      if (intervalCallback) intervalCallback();

      // (11000 - 1000) / 10000 = 1.0
      // getElasticProgress(1.0) -> elastic phase
      // overtime = 1.0 - 0.75 = 0.25
      // remainingUI = 0.25
      // result = 1.0 - 0.25 * exp(-0.25 * 5.0)
      // exp(-1.25) ~= 0.2865
      // 1.0 - 0.25 * 0.2865 = 1.0 - 0.0716 = 0.9284
      // floor(92.84) = 92
      const progress = screen.progressCompletion;
      assert.ok(progress > 75);
      assert.ok(progress < 100);
      assert.strictEqual(progress, 92);

      // Reset expected duration
      screen.expectedDuration = -1;
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);
    });
  });
});
