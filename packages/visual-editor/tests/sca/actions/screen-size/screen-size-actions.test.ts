/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as screenSizeActions from "../../../../src/sca/actions/screen-size/screen-size-actions.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../../../src/sca/controller/subcontrollers/global/screen-size-controller.js";

suite("ScreenSize Actions", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    coordination.reset();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  suite("updateScreenSize", () => {
    test("sets size to 'narrow' when narrow query matches", async () => {
      let sizeSet: string | undefined;

      // Mock window.matchMedia using actual breakpoint values
      const mockWindow = {
        matchMedia: (query: string) => {
          if (query === `(max-width: ${NARROW_BREAKPOINT}px)`) {
            return { matches: true };
          }
          return { matches: false };
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      screenSizeActions.bind({
        services: {} as never,
        controller: {
          global: {
            screenSize: {
              set size(val: string) {
                sizeSet = val;
              },
            },
          },
        } as never,
      });

      await screenSizeActions.updateScreenSize();

      assert.strictEqual(sizeSet, "narrow", "Size should be set to narrow");
    });

    test("sets size to 'medium' when medium query matches but not narrow", async () => {
      let sizeSet: string | undefined;

      const mockWindow = {
        matchMedia: (query: string) => {
          if (query === `(max-width: ${MEDIUM_BREAKPOINT}px)`) {
            return { matches: true };
          }
          return { matches: false };
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      screenSizeActions.bind({
        services: {} as never,
        controller: {
          global: {
            screenSize: {
              set size(val: string) {
                sizeSet = val;
              },
            },
          },
        } as never,
      });

      await screenSizeActions.updateScreenSize();

      assert.strictEqual(sizeSet, "medium", "Size should be set to medium");
    });

    test("sets size to 'wide' when no queries match", async () => {
      let sizeSet: string | undefined;

      const mockWindow = {
        matchMedia: () => ({ matches: false }),
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      screenSizeActions.bind({
        services: {} as never,
        controller: {
          global: {
            screenSize: {
              set size(val: string) {
                sizeSet = val;
              },
            },
          },
        } as never,
      });

      await screenSizeActions.updateScreenSize();

      assert.strictEqual(sizeSet, "wide", "Size should be set to wide");
    });

    test("handles SSR environment (no window)", async () => {
      // Set window to undefined to simulate SSR
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      screenSizeActions.bind({
        services: {} as never,
        controller: {
          global: {
            screenSize: {},
          },
        } as never,
      });

      // Should not throw
      await screenSizeActions.updateScreenSize();

      // If we get here, the test passed (no crash in SSR)
      assert.ok(true, "Should handle SSR without throwing");
    });
  });

  suite("init", () => {
    test("delegates to updateScreenSize", async () => {
      let sizeSet: string | undefined;

      const mockWindow = {
        matchMedia: () => ({ matches: false }),
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      screenSizeActions.bind({
        services: {} as never,
        controller: {
          global: {
            screenSize: {
              set size(val: string) {
                sizeSet = val;
              },
            },
          },
        } as never,
      });

      await screenSizeActions.init();

      assert.strictEqual(
        sizeSet,
        "wide",
        "init should delegate to updateScreenSize"
      );
    });
  });
});
