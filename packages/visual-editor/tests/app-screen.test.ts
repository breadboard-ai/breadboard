/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before } from "node:test";
import assert from "node:assert";

describe("AppScreen", () => {
  type AppScreenModule = typeof import("../src/sca/utils/app-screen.js");
  type ElasticProgressModule =
    typeof import("../src/sca/utils/elastic-progress.js");
  let createAppScreen: AppScreenModule["createAppScreen"];
  let setScreenDuration: AppScreenModule["setScreenDuration"];
  let tickScreenProgress: AppScreenModule["tickScreenProgress"];
  let getElasticProgress: ElasticProgressModule["getElasticProgress"];
  let currentTime = 1000; // Start at non-zero time

  before(async () => {
    // Mock performance.now
    Object.defineProperty(global, "performance", {
      value: {
        now: () => currentTime,
      },
      writable: true,
    });

    // Dynamic import to ensure mocks are in place before module execution
    const appScreenModule = await import("../src/sca/utils/app-screen.js");
    createAppScreen = appScreenModule.createAppScreen;
    setScreenDuration = appScreenModule.setScreenDuration;
    tickScreenProgress = appScreenModule.tickScreenProgress;

    const elasticModule = await import("../src/sca/utils/elastic-progress.js");
    getElasticProgress = elasticModule.getElasticProgress;
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

  describe("createAppScreen", () => {
    it("initializes with default values", () => {
      const screen = createAppScreen("test", undefined);
      assert.strictEqual(screen.title, "test");
      assert.strictEqual(screen.status, "processing");
      assert.strictEqual(screen.type, "progress");
      assert.strictEqual(screen.outputs.size, 0);
    });

    it("adds output correctly", () => {
      const screen = createAppScreen("test", undefined);
      const data = {
        node: { id: "node1", type: "test", configuration: {} },
        outputs: { foo: "bar" },
        path: [0],
        timestamp: 0,
        bubbled: false,
      };
      screen.addOutput(data);
      assert.strictEqual(screen.outputs.size, 1);
      const output = screen.last;
      assert.deepStrictEqual(output?.output, { foo: "bar" });
      assert.strictEqual(screen.outputs.get("e-0")?.output, data.outputs);
    });

    it("marks as input", () => {
      const screen = createAppScreen("test", undefined);
      screen.markAsInput();
      assert.strictEqual(screen.type, "input");
    });

    it("finalizes correctly", () => {
      const screen = createAppScreen("test", undefined);
      const data = {
        node: { id: "node1", type: "test" },
        outputs: { result: "done" },
        path: [0],
        timestamp: 0,
        inputs: {},
        newOpportunities: [],
      };
      screen.finalize(data);
      assert.strictEqual(screen.status, "complete");
      assert.strictEqual(screen.outputs.size, 1);
      assert.deepStrictEqual(screen.last?.output, { result: "done" });
    });

    it("handles expectedDuration updates and progress calculation", () => {
      const screen = createAppScreen("test", undefined);
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);

      // Set expected duration to 10 seconds via setScreenDuration
      currentTime = 1000; // Reset time
      setScreenDuration(screen, 10);
      assert.strictEqual(screen.expectedDuration, 10);

      // setScreenDuration records timestamp and sets progressCompletion = 0
      assert.strictEqual(screen.progressCompletion, 0);

      // Advance time by 5 seconds (50% progress)
      currentTime = 6000; // 1000 + 5000
      tickScreenProgress(screen);

      // (6000 - 1000) / 10000 = 0.5
      // getElasticProgress(0.5) = 0.5
      // 0.5 * 100 = 50
      assert.strictEqual(screen.progressCompletion, 50);

      // Advance time by 7.5 seconds (75% progress - knee)
      currentTime = 8500; // 1000 + 7500
      tickScreenProgress(screen);

      // (8500 - 1000) / 10000 = 0.75
      // getElasticProgress(0.75) = 0.75
      // 0.75 * 100 = 75
      assert.strictEqual(screen.progressCompletion, 75);

      // Advance time by 10 seconds (100% linear time, but elastic)
      currentTime = 11000; // 1000 + 10000
      tickScreenProgress(screen);

      // (11000 - 1000) / 10000 = 1.0
      // getElasticProgress(1.0) -> elastic phase
      const progress = screen.progressCompletion;
      assert.ok(progress > 75);
      assert.ok(progress < 100);
      assert.strictEqual(progress, 92);

      // Reset expected duration
      setScreenDuration(screen, -1);
      assert.strictEqual(screen.expectedDuration, -1);
      assert.strictEqual(screen.progressCompletion, -1);
    });
  });
});
