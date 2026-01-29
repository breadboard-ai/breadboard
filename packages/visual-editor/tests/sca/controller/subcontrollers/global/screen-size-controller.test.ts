/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { afterEach, beforeEach, suite, test } from "node:test";
import {
  MEDIUM_BREAKPOINT,
  NARROW_BREAKPOINT,
  ScreenSizeController,
} from "../../../../../src/sca/controller/subcontrollers/global/screen-size-controller.js";
import { setDOM, unsetDOM } from "../../../../fake-dom.js";

// Media query strings matching the controller's implementation
const NARROW_QUERY = `(max-width: ${NARROW_BREAKPOINT}px)`;
const MEDIUM_QUERY = `(max-width: ${MEDIUM_BREAKPOINT}px)`;

/**
 * Creates a mock matchMedia function that tracks registered listeners
 * and allows simulating media query changes.
 */
function createMockMatchMedia() {
  // Track media query states and listeners
  const queryStates = new Map<string, boolean>();
  const listeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
  // Cache MediaQueryList objects so we can update their matches property
  const queryListCache = new Map<string, MediaQueryList>();

  // Default initial states for narrow screen
  queryStates.set(NARROW_QUERY, true);  // narrow matches
  queryStates.set(MEDIUM_QUERY, true);  // medium also matches

  const mockMatchMedia = (query: string): MediaQueryList => {
    // Return cached instance if it exists
    if (queryListCache.has(query)) {
      return queryListCache.get(query)!;
    }

    if (!listeners.has(query)) {
      listeners.set(query, new Set());
    }

    const queryListeners = listeners.get(query)!;

    // Create a mutable object we can update later
    const queryList = {
      get matches() { return queryStates.get(query) ?? false; },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        queryListeners.add(listener);
      },
      removeEventListener: (_event: string, listener: (event: { matches: boolean }) => void) => {
        queryListeners.delete(listener);
      },
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;

    queryListCache.set(query, queryList);
    return queryList;
  };

  // Helper to simulate a viewport change
  const setViewport = (size: "narrow" | "medium" | "wide") => {
    switch (size) {
      case "narrow":
        queryStates.set(NARROW_QUERY, true);
        queryStates.set(MEDIUM_QUERY, true);
        break;
      case "medium":
        queryStates.set(NARROW_QUERY, false);
        queryStates.set(MEDIUM_QUERY, true);
        break;
      case "wide":
        queryStates.set(NARROW_QUERY, false);
        queryStates.set(MEDIUM_QUERY, false);
        break;
    }

    // Notify all listeners of the change
    for (const [query, queryListeners] of listeners) {
      const matches = queryStates.get(query) ?? false;
      for (const listener of queryListeners) {
        listener({ matches });
      }
    }
  };

  return { mockMatchMedia, setViewport, queryStates };
}

suite("ScreenSizeController", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
    // Clean up matchMedia mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window?.matchMedia;
  });

  test("Defaults to wide when matchMedia is unavailable", async () => {
    // Don't set matchMedia - it should default to "wide"
    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_1"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "wide");
  });

  test("Returns narrow when narrow query matches", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, true);
    queryStates.set(MEDIUM_QUERY, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_2"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "narrow");
  });

  test("Returns medium when only medium query matches", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_3"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "medium");
  });

  test("Returns wide when no queries match", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_4"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "wide");
  });

  test("Updates size reactively when viewport changes", async () => {
    const { mockMatchMedia, setViewport, queryStates } = createMockMatchMedia();
    // Start wide
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const controller = new ScreenSizeController(
      "ScreenSize",
      "ScreenSizeController_5"
    );
    await controller.isHydrated;

    assert.strictEqual(controller.size, "wide");

    // Simulate resize to narrow
    setViewport("narrow");
    assert.strictEqual(controller.size, "narrow");

    // Simulate resize to medium
    setViewport("medium");
    assert.strictEqual(controller.size, "medium");

    // Back to wide
    setViewport("wide");
    assert.strictEqual(controller.size, "wide");
  });

});

