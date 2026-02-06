/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import { onGraphVersionForSync } from "../../../../src/sca/actions/run/triggers.js";

suite("Run Triggers", () => {
  suite("onGraphVersionForSync", () => {
    test("returns true when version is valid (>= 0)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 42,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionForSync(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, true, "Should return true for valid version");
    });

    test("returns false when version is -1", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: -1,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionForSync(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false for invalid version");
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { version: 1 } } },
        services: {},
      };

      const trigger = onGraphVersionForSync(mockBind as never);

      assert.strictEqual(trigger.name, "Graph Version (Sync)");
    });

    test("returns true for version 0", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionForSync(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, true, "Should return true for version 0");
    });
  });
});
