/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert/strict";
import { ThemeController } from "../../../../../src/sca/controller/subcontrollers/editor/theme-controller.js";

import type { GraphDescriptor } from "@breadboard-ai/types";

suite("ThemeController", () => {
  suite("themeHash getter", () => {
    test("returns 0 initially", () => {
      const ctrl = new ThemeController("theme_1", "ThemeController");
      assert.strictEqual(ctrl.themeHash, 0);
    });
  });

  suite("updateHash", () => {
    test("sets themeHash to 0 when graph is null", () => {
      const ctrl = new ThemeController("theme_2", "ThemeController");
      ctrl.updateHash(null);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when graph is undefined", () => {
      const ctrl = new ThemeController("theme_3", "ThemeController");
      ctrl.updateHash(undefined);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when graph has no metadata", () => {
      const ctrl = new ThemeController("theme_4", "ThemeController");
      ctrl.updateHash({} as GraphDescriptor);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when graph has no visual metadata", () => {
      const ctrl = new ThemeController("theme_5", "ThemeController");
      ctrl.updateHash({ metadata: {} } as GraphDescriptor);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when no themes are defined", () => {
      const ctrl = new ThemeController("theme_6", "ThemeController");
      ctrl.updateHash({
        metadata: { visual: { presentation: {} } },
      } as unknown as GraphDescriptor);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when theme name is set but not in themes", () => {
      const ctrl = new ThemeController("theme_7", "ThemeController");
      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { light: { color: "#fff" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("sets themeHash to 0 when themes exist but no theme name", () => {
      const ctrl = new ThemeController("theme_8", "ThemeController");
      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              themes: { light: { color: "#fff" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      assert.strictEqual(ctrl.themeHash, 0);
    });

    test("computes non-zero hash when theme exists in themes", () => {
      const ctrl = new ThemeController("theme_9", "ThemeController");
      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: { color: "#000", background: "#111" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      assert.notStrictEqual(ctrl.themeHash, 0, "hash should be non-zero");
    });

    test("produces different hashes for different theme values", () => {
      const ctrl = new ThemeController("theme_10", "ThemeController");

      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: { color: "#000" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      const hash1 = ctrl.themeHash;

      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: { color: "#fff" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      const hash2 = ctrl.themeHash;

      assert.notStrictEqual(
        hash1,
        hash2,
        "different values should produce different hashes"
      );
    });

    test("produces same hash for same theme values", () => {
      const themeData = { color: "#000", background: "#111" };
      const ctrl = new ThemeController("theme_11", "ThemeController");

      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: themeData },
            },
          },
        },
      } as unknown as GraphDescriptor);
      const hash1 = ctrl.themeHash;

      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: { ...themeData } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      const hash2 = ctrl.themeHash;

      assert.strictEqual(hash1, hash2, "same values should produce same hash");
    });

    test("resets to 0 after valid hash when graph becomes null", () => {
      const ctrl = new ThemeController("theme_12", "ThemeController");

      ctrl.updateHash({
        metadata: {
          visual: {
            presentation: {
              theme: "dark",
              themes: { dark: { color: "#000" } },
            },
          },
        },
      } as unknown as GraphDescriptor);
      assert.notStrictEqual(ctrl.themeHash, 0, "should have non-zero hash");

      ctrl.updateHash(null);
      assert.strictEqual(ctrl.themeHash, 0, "should reset to 0");
    });
  });
});
