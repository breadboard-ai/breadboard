/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import {
  onGraphVersionForSync,
  onNodeActionRequested,
  onTopologyChange,
} from "../../../../src/sca/actions/run/triggers.js";

suite("Run Triggers", () => {
  suite("onGraphVersionForSync", () => {
    test("returns version + 1 when version is valid (>= 0)", () => {
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

      assert.strictEqual(
        result,
        43,
        "Should return version + 1 for valid version"
      );
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

      assert.strictEqual(
        result,
        false,
        "Should return false for invalid version"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { version: 1 } } },
        services: {},
      };

      const trigger = onGraphVersionForSync(mockBind as never);

      assert.strictEqual(trigger.name, "Graph Version (Sync)");
    });

    test("returns 1 for version 0", () => {
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

      assert.strictEqual(result, 1, "Should return 1 for version 0");
    });

    test("produces unique value per version bump (no Sticky Trigger)", () => {
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
      const results: unknown[] = [];

      for (let v = 0; v <= 5; v++) {
        mockBind.controller.editor.graph.version = v;
        results.push(trigger.condition());
      }

      assert.ok(
        results.every((r) => r),
        "All results should be truthy"
      );

      const unique = new Set(results);
      assert.strictEqual(
        unique.size,
        results.length,
        `All ${results.length} values should be unique, got: ${JSON.stringify(results)}`
      );
    });
  });

  suite("onTopologyChange", () => {
    test("returns topologyVersion + 1", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              topologyVersion: 3,
            },
          },
        },
        services: {},
      };

      const trigger = onTopologyChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, 4, "Should return topologyVersion + 1");
    });

    test("returns 1 for topologyVersion 0", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              topologyVersion: 0,
            },
          },
        },
        services: {},
      };

      const trigger = onTopologyChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, 1, "Should return 1 for topologyVersion 0");
    });

    test("produces unique value per topology bump (no Sticky Trigger)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              topologyVersion: 0,
            },
          },
        },
        services: {},
      };

      const trigger = onTopologyChange(mockBind as never);
      const results: unknown[] = [];

      for (let v = 0; v <= 5; v++) {
        mockBind.controller.editor.graph.topologyVersion = v;
        results.push(trigger.condition());
      }

      assert.ok(
        results.every((r) => r),
        "All results should be truthy"
      );

      const unique = new Set(results);
      assert.strictEqual(
        unique.size,
        results.length,
        `All ${results.length} values should be unique, got: ${JSON.stringify(results)}`
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { topologyVersion: 0 } } },
        services: {},
      };

      const trigger = onTopologyChange(mockBind as never);

      assert.strictEqual(trigger.name, "Topology Change (Re-prepare)");
    });
  });

  suite("onNodeActionRequested", () => {
    test("returns true when nodeActionRequest is non-null", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: {
                nodeId: "node-1",
                actionContext: "graph",
              },
            },
          },
        },
        services: {},
      };

      const trigger = onNodeActionRequested(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when request is set"
      );
    });

    test("returns false when nodeActionRequest is null", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: null,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeActionRequested(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when request is null"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: {
          run: { main: { nodeActionRequest: null } },
        },
        services: {},
      };

      const trigger = onNodeActionRequested(mockBind as never);

      assert.strictEqual(trigger.name, "Node Action Requested (Run)");
    });
  });
});
