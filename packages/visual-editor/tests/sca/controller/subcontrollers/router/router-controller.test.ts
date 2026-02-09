/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import { RouterController } from "../../../../../src/sca/controller/subcontrollers/router/router-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";
import { SignalWatcher } from "../../../../signal-watcher.js";
import { Signal } from "signal-polyfill";

// RouterController tests!
suite("RouterController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  test("Basics - controller hydrates correctly", async () => {
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.hydrated, true);
    assert.strictEqual(controller.controllerId, "Router");
    assert.strictEqual(controller.persistenceId, "router");
  });

  test("parsedUrl reflects initial location", async () => {
    // Start with a home URL
    window.history.pushState(null, "", "http://localhost/");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "home");
  });

  test("parsedUrl reflects initial location with flow parameter", async () => {
    // Set up a graph URL with old scheme
    window.history.pushState(
      null,
      "",
      "http://localhost/?flow=drive:/12345&mode=canvas"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.flow, "drive:/12345");
      assert.strictEqual(controller.parsedUrl.mode, "canvas");
    }
  });

  test("go() updates browser history and parsedUrl", async () => {
    window.history.pushState(null, "", "http://localhost/");
    const controller = new RouterController();
    await controller.isHydrated;

    // Navigate to a graph page
    controller.go({
      page: "graph",
      mode: "canvas",
      flow: "drive:/abcdef",
      guestPrefixed: false,
    });

    assert.strictEqual(controller.parsedUrl.page, "graph");
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.flow, "drive:/abcdef");
      assert.strictEqual(controller.parsedUrl.mode, "canvas");
    }
    // URL should be updated
    assert.ok(window.location.href.includes("flow=drive:/abcdef"));
  });

  test("go() is a no-op if URL matches current location", async () => {
    window.history.pushState(null, "", "http://localhost/");
    const controller = new RouterController();
    await controller.isHydrated;

    const initialHref = window.location.href;

    // Navigate to the same place
    controller.go({
      page: "home",
      guestPrefixed: false,
    });

    // URL should remain unchanged
    assert.strictEqual(window.location.href, initialHref);
  });

  test("parsedUrl is reactive", async () => {
    window.history.pushState(null, "", "http://localhost/");
    const controller = new RouterController();
    await controller.isHydrated;

    // Create a computed signal that depends on parsedUrl
    const pageSignal = new Signal.Computed(() => controller.parsedUrl.page);
    const watcher = new SignalWatcher(pageSignal);
    watcher.watch();

    assert.strictEqual(pageSignal.get(), "home");

    // Navigate to a different page
    controller.go({
      page: "graph",
      mode: "app",
      flow: "drive:/xyz123",
      guestPrefixed: false,
    });

    // Verify the signal was updated
    assert.strictEqual(pageSignal.get(), "graph");
    assert.ok(watcher.count > 0, "Signal watcher should have been notified");
  });

  test("clearFlowParameters removes flow and tab params", async () => {
    window.history.pushState(
      null,
      "",
      "http://localhost/?flow=drive:/test&tab0=foo&mode=canvas"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    controller.clearFlowParameters();

    const url = new URL(window.location.href);
    assert.strictEqual(url.searchParams.has("flow"), false);
    assert.strictEqual(url.searchParams.has("tab0"), false);
    // mode should still be there (doesn't start with 'flow' or 'tab')
    assert.strictEqual(url.searchParams.has("mode"), true);
  });

  test("updateFromCurrentUrl syncs parsedUrl with browser URL", async () => {
    window.history.pushState(null, "", "http://localhost/");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "home");

    // Directly manipulate browser URL (simulating popstate)
    window.history.pushState(
      null,
      "",
      "http://localhost/?flow=drive:/updated&mode=canvas"
    );

    // parsedUrl should still be "home" until we update
    assert.strictEqual(controller.parsedUrl.page, "home");

    // Now sync it
    controller.updateFromCurrentUrl();

    assert.strictEqual(controller.parsedUrl.page, "graph");
    assert.strictEqual(
      (controller.parsedUrl as { flow: string }).flow,
      "drive:/updated"
    );
  });

  test("init() triggers URL change handling", async () => {
    window.history.pushState(
      null,
      "",
      "http://localhost/?flow=drive:/initflow&mode=app"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    // Create a computed based on parsedUrl
    const flowSignal = new Signal.Computed(() => {
      const parsed = controller.parsedUrl;
      return parsed.page === "graph" ? parsed.flow : null;
    });
    const watcher = new SignalWatcher(flowSignal);
    watcher.watch();

    // Call init which should trigger update
    controller.init();

    assert.strictEqual(flowSignal.get(), "drive:/initflow");
  });

  test("canonicalizes URL on construction", async () => {
    // Set a non-canonical URL (e.g., with encoded characters that get cleaned)
    window.history.pushState(
      null,
      "",
      "http://localhost/?flow=drive%3A%2Ftest&mode=canvas"
    );
    const originalHref = window.location.href;

    const controller = new RouterController();
    await controller.isHydrated;

    // The URL should be canonicalized to use drive:/ instead of drive%3A%2F
    assert.notStrictEqual(window.location.href, originalHref);
    assert.ok(
      window.location.href.includes("drive:/test"),
      "URL should be canonicalized"
    );
  });

  test("clears redirectFromLanding flag on construction", async () => {
    // Navigate to landing page with redirect params
    window.history.pushState(
      null,
      "",
      "http://localhost/landing/?flow=drive:/redir&mode=canvas"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    // The redirectFromLanding should be cleared from parsed state
    // (Note: this is internal behavior, we verify by checking the page type)
    assert.strictEqual(controller.parsedUrl.page, "landing");
  });

  test("parsedUrl includes lite mode when set", async () => {
    window.history.pushState(null, "", "http://localhost/?lite=true");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "home");
    if (controller.parsedUrl.page === "home") {
      assert.strictEqual(controller.parsedUrl.lite, true);
    }
  });

  test("parsedUrl includes color scheme when set", async () => {
    window.history.pushState(null, "", "http://localhost/?color-scheme=dark");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "home");
    if (controller.parsedUrl.page === "home") {
      assert.strictEqual(controller.parsedUrl.colorScheme, "dark");
    }
  });

  test("parsedUrl handles guestPrefixed URLs", async () => {
    window.history.pushState(
      null,
      "",
      "http://localhost/_app/?flow=drive:/guest&mode=canvas"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    assert.strictEqual(controller.parsedUrl.guestPrefixed, true);
  });

  // New URL scheme tests (/app/{driveId} and /edit/{driveId})

  test("parsedUrl handles new URL scheme for app mode", async () => {
    // New URL scheme: /app/{driveId}
    window.history.pushState(null, "", "http://localhost/app/abc123def456");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.mode, "app");
      // The flow should be prefixed with "drive:/"
      assert.strictEqual(controller.parsedUrl.flow, "drive:/abc123def456");
    }
  });

  test("parsedUrl handles new URL scheme for canvas/edit mode", async () => {
    // New URL scheme: /edit/{driveId}
    window.history.pushState(null, "", "http://localhost/edit/xyz789ghi012");
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.mode, "canvas");
      // The flow should be prefixed with "drive:/"
      assert.strictEqual(controller.parsedUrl.flow, "drive:/xyz789ghi012");
    }
  });

  test("parsedUrl handles new URL scheme with guestPrefixed", async () => {
    // New URL scheme with /_app prefix: /_app/app/{driveId}
    window.history.pushState(
      null,
      "",
      "http://localhost/_app/app/guestdrive123"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    assert.strictEqual(controller.parsedUrl.guestPrefixed, true);
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.mode, "app");
      assert.strictEqual(controller.parsedUrl.flow, "drive:/guestdrive123");
    }
  });

  test("parsedUrl handles new URL scheme with query params", async () => {
    // New URL scheme with additional query params (lite, color-scheme, etc.)
    window.history.pushState(
      null,
      "",
      "http://localhost/edit/somefile?lite=true&color-scheme=dark"
    );
    const controller = new RouterController();
    await controller.isHydrated;

    assert.strictEqual(controller.parsedUrl.page, "graph");
    if (controller.parsedUrl.page === "graph") {
      assert.strictEqual(controller.parsedUrl.mode, "canvas");
      assert.strictEqual(controller.parsedUrl.flow, "drive:/somefile");
      assert.strictEqual(controller.parsedUrl.lite, true);
      assert.strictEqual(controller.parsedUrl.colorScheme, "dark");
    }
  });
});
