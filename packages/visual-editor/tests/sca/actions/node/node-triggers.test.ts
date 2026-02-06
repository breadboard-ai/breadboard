/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import { onNodeConfigChange } from "../../../../src/sca/actions/node/triggers.js";

suite("Node Triggers", () => {
  suite("onNodeConfigChange", () => {
    test("returns true when config change exists", () => {
      const configChange = { nodeId: "node-123", config: { foo: "bar" } };
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: configChange,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, true, "Should return true when config change exists");
    });

    test("returns false when no config change", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: null,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when no config change");
    });

    test("returns false when lastNodeConfigChange is undefined", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: undefined,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when undefined");
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { lastNodeConfigChange: null } } },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);

      assert.strictEqual(trigger.name, "Node Config Change");
    });
  });
});
