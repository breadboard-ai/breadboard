/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { after, afterEach, before, suite, test } from "node:test";
import {
  registerMediaQueryTrigger,
  bind,
} from "../../../../src/sca/triggers/screen-size/screen-size-triggers.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../../../src/sca/controller/subcontrollers/global/screen-size-controller.js";
import { appController } from "../../../../src/sca/controller/controller.js";
import { AppActions } from "../../../../src/sca/actions/actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { flushEffects } from "../utils.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

// Media query strings matching the trigger's implementation
const NARROW_QUERY = `(max-width: ${NARROW_BREAKPOINT}px)`;
const MEDIUM_QUERY = `(max-width: ${MEDIUM_BREAKPOINT}px)`;

/**
 * Creates a mock matchMedia function that tracks registered listeners
 * and allows simulating media query changes.
 */
function createMockMatchMedia() {
  const queryStates = new Map<string, boolean>();
  const listeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
  const queryListCache = new Map<string, MediaQueryList>();

  // Default to wide screen
  queryStates.set(NARROW_QUERY, false);
  queryStates.set(MEDIUM_QUERY, false);

  const mockMatchMedia = (query: string): MediaQueryList => {
    if (queryListCache.has(query)) {
      return queryListCache.get(query)!;
    }

    if (!listeners.has(query)) {
      listeners.set(query, new Set());
    }

    const queryListeners = listeners.get(query)!;

    const queryList = {
      get matches() {
        return queryStates.get(query) ?? false;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (
        _event: string,
        listener: (event: { matches: boolean }) => void
      ) => {
        queryListeners.add(listener);
      },
      removeEventListener: (
        _event: string,
        listener: (event: { matches: boolean }) => void
      ) => {
        queryListeners.delete(listener);
      },
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;

    queryListCache.set(query, queryList);
    return queryList;
  };

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

    // Notify all listeners
    for (const [query, queryListeners] of listeners) {
      const matches = queryStates.get(query) ?? false;
      for (const listener of queryListeners) {
        listener({ matches });
      }
    }
  };

  return { mockMatchMedia, setViewport, queryStates };
}

suite("ScreenSize Triggers - Media Query", () => {
  let controller: ReturnType<typeof appController>;

  before(async () => {
    setDOM();
    controller = appController(defaultRuntimeFlags);
    await controller.isHydrated;
  });

  after(() => {
    unsetDOM();
  });

  afterEach(() => {
    bind.clean();
    // Reset matchMedia mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window?.matchMedia;
    // Reset controller state
    controller.global.screenSize.size = "wide";
  });

  test("Sets size to narrow when narrow query matches initially", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, true);
    queryStates.set(MEDIUM_QUERY, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    registerMediaQueryTrigger();
    await flushEffects();

    assert.strictEqual(controller.global.screenSize.size, "narrow");
  });

  test("Sets size to medium when only medium query matches", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    registerMediaQueryTrigger();
    await flushEffects();

    assert.strictEqual(controller.global.screenSize.size, "medium");
  });

  test("Sets size to wide when no queries match", async () => {
    const { mockMatchMedia, queryStates } = createMockMatchMedia();
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    registerMediaQueryTrigger();
    await flushEffects();

    assert.strictEqual(controller.global.screenSize.size, "wide");
  });

  test("Reacts to viewport changes", async () => {
    const { mockMatchMedia, setViewport, queryStates } = createMockMatchMedia();
    // Start wide
    queryStates.set(NARROW_QUERY, false);
    queryStates.set(MEDIUM_QUERY, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    registerMediaQueryTrigger();
    await flushEffects();

    assert.strictEqual(controller.global.screenSize.size, "wide");

    // Simulate resize to narrow
    setViewport("narrow");
    await flushEffects();
    assert.strictEqual(controller.global.screenSize.size, "narrow");

    // Simulate resize to medium
    setViewport("medium");
    await flushEffects();
    assert.strictEqual(controller.global.screenSize.size, "medium");

    // Back to wide
    setViewport("wide");
    await flushEffects();
    assert.strictEqual(controller.global.screenSize.size, "wide");
  });

  test("Handles SSR environment (no matchMedia)", async () => {
    // Don't set matchMedia - should not throw
    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    // Should not throw and size should remain default
    registerMediaQueryTrigger();
    await flushEffects();

    assert.strictEqual(controller.global.screenSize.size, "wide");
  });

  test("Triggers are registered and can be listed", async () => {
    const { mockMatchMedia } = createMockMatchMedia();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.matchMedia = mockMatchMedia;

    const actions = {} as AppActions;
    const services = {} as AppServices;
    bind({ controller, services, actions });

    registerMediaQueryTrigger();

    const registered = bind.list();
    assert.ok(
      registered.includes("[bridge] Screen Size Narrow Query"),
      `Expected narrow query trigger to be registered, got: ${registered}`
    );
    assert.ok(
      registered.includes("[bridge] Screen Size Medium Query"),
      `Expected medium query trigger to be registered, got: ${registered}`
    );
  });
});
