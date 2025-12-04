/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert";
import type { ProjectRun } from "../state/types.js";
import { SignalWatcher } from "./signal-watcher.js";
import { Signal } from "signal-polyfill";

describe("ReactiveApp", () => {
  type AppStateModule = typeof import("../state/app.js");
  type AppScreenModule = typeof import("../state/app-screen.js");

  let ReactiveApp: AppStateModule["ReactiveApp"];
  let ReactiveAppScreen: AppScreenModule["ReactiveAppScreen"];

  let mockRun: ProjectRun;
  let app: InstanceType<AppStateModule["ReactiveApp"]>;

  before(async () => {
    // Mock performance
    Object.defineProperty(global, "performance", {
      value: {
        now: () => 1000,
      },
      writable: true,
      configurable: true,
    });

    // Mock setInterval
    global.setInterval = ((_callback: () => void) => {
      return {} as NodeJS.Timeout;
    }) as unknown as typeof global.setInterval;

    // Dynamic imports to ensure mocks are in place before modules load
    const appModule = await import("../state/app.js");
    const appScreenModule = await import("../state/app-screen.js");

    ReactiveApp = appModule.ReactiveApp;
    ReactiveAppScreen = appScreenModule.ReactiveAppScreen;
  });

  beforeEach(() => {
    mockRun = {
      error: null,
      input: null,
    } as unknown as ProjectRun;
    app = new ReactiveApp(mockRun);
  });

  it("initializes with 'splash' state when no screens", () => {
    assert.strictEqual(app.state, "splash");
  });

  it("switches to 'consent' state when consentRequests exist", () => {
    app.consentRequests.push({
      request: {
        type: "GET_ANY_WEBPAGE" as any,
        scope: {},
        graphUrl: "test",
      },
      consentCallback: () => {},
    });
    assert.strictEqual(app.state, "consent");
  });

  it("switches to 'error' state when run has error", () => {
    // We need to add a screen so it's not 'splash'
    const screen = new ReactiveAppScreen("test", undefined);
    app.screens.set("s1", screen);

    // Mock error
    mockRun.error = { message: "Something went wrong" } as any;

    assert.strictEqual(app.state, "error");
  });

  it("switches to 'input' state when run has input", () => {
    const screen = new ReactiveAppScreen("test", undefined);
    app.screens.set("s1", screen);

    mockRun.input = { id: "node1", schema: {} } as any;
    assert.strictEqual(app.state, "input");
  });

  it("switches to 'output' state when all screens are complete", () => {
    const screen = new ReactiveAppScreen("test", undefined);
    screen.status = "complete";
    app.screens.set("s1", screen);

    // current.size should be 0 because it filters out complete screens
    assert.strictEqual(app.current.size, 0);
    assert.strictEqual(app.state, "output");
  });

  it("switches to 'interactive' state when a screen is interactive", () => {
    const screen = new ReactiveAppScreen("test", undefined);
    screen.status = "interactive";
    // Mock last output with a2ui
    // We need to manually set the output because addOutput doesn't currently support setting a2ui property
    screen.outputs.set("o1", {
      schema: {},
      output: {},
      a2ui: { processor: {}, receiver: { sendMessage: () => {} } } as any,
    });

    app.screens.set("s1", screen);

    assert.strictEqual(app.state, "interactive");
  });

  it("defaults to 'progress' state", () => {
    const screen = new ReactiveAppScreen("test", undefined);
    screen.status = "processing";
    app.screens.set("s1", screen);

    assert.strictEqual(app.state, "progress");
  });

  it("computes 'current' correctly", () => {
    const s1 = new ReactiveAppScreen("s1", undefined);
    s1.status = "processing";
    const s2 = new ReactiveAppScreen("s2", undefined);
    s2.status = "complete";

    app.screens.set("1", s1);
    app.screens.set("2", s2);

    const current = app.current;
    assert.strictEqual(current.size, 1);
    assert.ok(current.has("1"));
    assert.ok(!current.has("2"));
  });

  it("computes 'last' correctly", () => {
    const s1 = new ReactiveAppScreen("s1", undefined);
    const s2 = new ReactiveAppScreen("s2", undefined);
    const s3 = new ReactiveAppScreen("s3", undefined);

    // s3 is input and complete, should be ignored by findLast
    s3.type = "input";
    s3.status = "complete";

    app.screens.set("1", s1);
    app.screens.set("2", s2);
    app.screens.set("3", s3);

    assert.strictEqual(app.last, s2);
  });
  describe("Reactivity", () => {
    it("updates 'state' when consentRequests change", () => {
      const computed = new Signal.Computed(() => app.state);
      const watcher = new SignalWatcher(computed);
      watcher.watch();

      assert.strictEqual(app.state, "splash");
      assert.strictEqual(watcher.count, 0);

      app.consentRequests.push({
        request: {
          type: "GET_ANY_WEBPAGE" as any,
          scope: {},
          graphUrl: "test",
        },
        consentCallback: () => {},
      });

      assert.strictEqual(app.state, "consent");
      assert.strictEqual(watcher.count, 1);
    });

    it("updates 'state' when screens change", () => {
      const computed = new Signal.Computed(() => app.state);
      const watcher = new SignalWatcher(computed);
      watcher.watch();

      assert.strictEqual(app.state, "splash");
      assert.strictEqual(watcher.count, 0);

      const screen = new ReactiveAppScreen("test", undefined);
      app.screens.set("s1", screen);

      assert.strictEqual(app.state, "progress");
      assert.strictEqual(watcher.count, 1);
    });

    it("updates 'current' when screens change", () => {
      const computed = new Signal.Computed(() => app.current);
      const watcher = new SignalWatcher(computed);
      watcher.watch();

      assert.strictEqual(app.current.size, 0);
      assert.strictEqual(watcher.count, 0);

      const screen = new ReactiveAppScreen("test", undefined);
      screen.status = "processing";
      app.screens.set("s1", screen);

      assert.strictEqual(app.current.size, 1);
      assert.strictEqual(watcher.count, 1);
    });
  });
});
