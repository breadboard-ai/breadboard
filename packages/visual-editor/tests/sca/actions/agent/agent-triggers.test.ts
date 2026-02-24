/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import {
  onGraphVersionChange,
  onGraphUrlChange,
} from "../../../../src/sca/actions/agent/triggers.js";

suite("Agent Triggers", () => {
  suite("onGraphVersionChange", () => {
    test("returns false when graph is readOnly", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              readOnly: true,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when readOnly");
    });

    test("returns false when version is -1", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: -1,
              readOnly: false,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when version is -1"
      );
    });

    test("returns version + 1 when conditions are met", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 42,
              readOnly: false,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        43,
        "Should return version + 1 when conditions met"
      );
    });

    test("returns 1 when version is 0", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
              readOnly: false,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, 1, "Should return 1 for version 0");
    });

    test("produces unique value per version bump (no Sticky Trigger)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
              readOnly: false,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);
      const results: unknown[] = [];

      // Simulate several version bumps
      for (let v = 0; v <= 5; v++) {
        mockBind.controller.editor.graph.version = v;
        results.push(trigger.condition());
      }

      // Every result must be truthy
      assert.ok(
        results.every((r) => r),
        "All results should be truthy"
      );

      // Every result must be unique (the Sticky Trigger Hazard is that
      // they'd all be `true`, causing the coordination system to think
      // nothing changed).
      const unique = new Set(results);
      assert.strictEqual(
        unique.size,
        results.length,
        `All ${results.length} values should be unique, got: ${JSON.stringify(results)}`
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { version: 1, readOnly: false } } },
        services: {},
      };

      const trigger = onGraphVersionChange(mockBind as never);

      assert.strictEqual(trigger.name, "Graph Version Change");
    });
  });

  suite("onGraphUrlChange", () => {
    test("returns false on initial load (no previous URL)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              url: "drive:/abc123",
            },
          },
        },
        services: {},
      };

      const trigger = onGraphUrlChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false on initial load");
    });

    test("returns true on actual URL change", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              url: "drive:/abc123",
            },
          },
        },
        services: {},
      };

      const trigger = onGraphUrlChange(mockBind as never);

      // First call - initial load
      trigger.condition();

      // Change URL
      mockBind.controller.editor.graph.url = "drive:/xyz789";

      // Second call - actual change
      const result = trigger.condition();

      assert.strictEqual(result, true, "Should return true on URL change");
    });

    test("returns false when URL has not changed", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              url: "drive:/abc123",
            },
          },
        },
        services: {},
      };

      const trigger = onGraphUrlChange(mockBind as never);

      // First call - initial load
      trigger.condition();

      // Second call - no change
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when URL unchanged"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { url: "" } } },
        services: {},
      };

      const trigger = onGraphUrlChange(mockBind as never);

      assert.strictEqual(trigger.name, "Graph URL Change");
    });
  });
});
