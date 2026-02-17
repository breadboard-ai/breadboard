/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import { onTitleChange } from "../../../../src/sca/actions/shell/triggers.js";

suite("Shell Triggers", () => {
  suite("onTitleChange", () => {
    test("returns true when title exists", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              title: "My Board Title",
            },
          },
        },
        services: {},
      };

      const trigger = onTitleChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, true, "Should return true when title exists");
    });

    test("returns true when title is empty string", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              title: "",
            },
          },
        },
        services: {},
      };

      const trigger = onTitleChange(mockBind as never);
      const result = trigger.condition();

      // Empty string !== null, so it returns true
      assert.strictEqual(result, true, "Should return true for empty string");
    });

    test("returns false when title is null", () => {
      const mockBind = {
        controller: { editor: { graph: { title: null } } },
        services: {},
      };

      const trigger = onTitleChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when title is null"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { title: "" } } },
        services: {},
      };

      const trigger = onTitleChange(mockBind as never);

      assert.strictEqual(trigger.name, "Graph Title Change");
    });
  });
});
