/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  onNarrowQueryChange,
  onMediumQueryChange,
} from "../../../../src/sca/actions/screen-size/triggers.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../../../src/sca/controller/subcontrollers/global/screen-size-controller.js";

suite("Screen Size Triggers", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  suite("onNarrowQueryChange", () => {
    test("returns null when window is undefined (SSR)", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = onNarrowQueryChange();

      assert.strictEqual(result, null, "Should return null in SSR environment");
    });

    test("returns null when matchMedia is not a function", () => {
      Object.defineProperty(globalThis, "window", {
        value: { matchMedia: "not a function" },
        writable: true,
        configurable: true,
      });

      const result = onNarrowQueryChange();

      assert.strictEqual(
        result,
        null,
        "Should return null when matchMedia is not a function"
      );
    });

    test("returns event trigger with correct configuration", () => {
      const mockQuery = {
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      Object.defineProperty(globalThis, "window", {
        value: {
          matchMedia: (query: string) => {
            // Verify correct breakpoint is used
            assert.ok(
              query.includes(String(NARROW_BREAKPOINT)),
              `Query should include NARROW_BREAKPOINT (${NARROW_BREAKPOINT})`
            );
            return mockQuery;
          },
        },
        writable: true,
        configurable: true,
      });

      const result = onNarrowQueryChange();

      assert.ok(result !== null, "Should return a trigger");
      assert.strictEqual(result!.name, "Narrow Query Change");
      assert.strictEqual(result!.type, "event");
      assert.strictEqual(result!.eventType, "change");
      assert.strictEqual(result!.target, mockQuery);
    });
  });

  suite("onMediumQueryChange", () => {
    test("returns null when window is undefined (SSR)", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = onMediumQueryChange();

      assert.strictEqual(result, null, "Should return null in SSR environment");
    });

    test("returns null when matchMedia is not a function", () => {
      Object.defineProperty(globalThis, "window", {
        value: { matchMedia: undefined },
        writable: true,
        configurable: true,
      });

      const result = onMediumQueryChange();

      assert.strictEqual(
        result,
        null,
        "Should return null when matchMedia is missing"
      );
    });

    test("returns event trigger with correct configuration", () => {
      const mockQuery = {
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      Object.defineProperty(globalThis, "window", {
        value: {
          matchMedia: (query: string) => {
            // Verify correct breakpoint is used
            assert.ok(
              query.includes(String(MEDIUM_BREAKPOINT)),
              `Query should include MEDIUM_BREAKPOINT (${MEDIUM_BREAKPOINT})`
            );
            return mockQuery;
          },
        },
        writable: true,
        configurable: true,
      });

      const result = onMediumQueryChange();

      assert.ok(result !== null, "Should return a trigger");
      assert.strictEqual(result!.name, "Medium Query Change");
      assert.strictEqual(result!.type, "event");
      assert.strictEqual(result!.eventType, "change");
      assert.strictEqual(result!.target, mockQuery);
    });
  });
});
