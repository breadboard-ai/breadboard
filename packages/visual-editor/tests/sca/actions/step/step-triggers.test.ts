/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import {
  onSelectionOrSidebarChange,
  onNodeActionRequested,
} from "../../../../src/sca/actions/step/triggers.js";

suite("Step Triggers", () => {
  suite("onSelectionOrSidebarChange", () => {
    test("returns false when no pending edits exist", () => {
      const mockBind = {
        controller: {
          editor: {
            selection: {
              selectionId: "node-123",
            },
            sidebar: {
              section: "inputs",
            },
            step: {
              pendingEdit: null,
              pendingAssetEdit: null,
            },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when no pending edits"
      );
    });

    test("returns true when pendingEdit exists", () => {
      const pendingEdit = {
        nodeId: "node-123",
        graphId: "graph-456",
        graphVersion: 5,
        values: { key: "value" },
      };

      const mockBind = {
        controller: {
          editor: {
            selection: {
              selectionId: "node-123",
            },
            sidebar: {
              section: "inputs",
            },
            step: {
              pendingEdit,
              pendingAssetEdit: null,
            },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when pendingEdit exists"
      );
    });

    test("returns true when pendingAssetEdit exists", () => {
      const pendingAssetEdit = {
        graphVersion: 5,
        title: "My Asset",
        dataPart: null,
        update: () => Promise.resolve(),
      };

      const mockBind = {
        controller: {
          editor: {
            selection: {
              selectionId: "node-123",
            },
            sidebar: {
              section: "inputs",
            },
            step: {
              pendingEdit: null,
              pendingAssetEdit,
            },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when pendingAssetEdit exists"
      );
    });

    test("returns true when both edits exist", () => {
      const pendingEdit = {
        nodeId: "node-123",
        graphId: "graph-456",
        graphVersion: 5,
        values: { key: "value" },
      };
      const pendingAssetEdit = {
        graphVersion: 5,
        title: "My Asset",
        dataPart: null,
        update: () => Promise.resolve(),
      };

      const mockBind = {
        controller: {
          editor: {
            selection: {
              selectionId: "node-123",
            },
            sidebar: {
              section: "inputs",
            },
            step: {
              pendingEdit,
              pendingAssetEdit,
            },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when both edits exist"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: {
          editor: {
            selection: { selectionId: null },
            sidebar: { section: null },
            step: { pendingEdit: null, pendingAssetEdit: null },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);

      assert.strictEqual(trigger.name, "Selection/Sidebar Change");
    });

    test("re-evaluates when selection changes", () => {
      const mockBind = {
        controller: {
          editor: {
            selection: {
              selectionId: "node-123",
            },
            sidebar: {
              section: "inputs",
            },
            step: {
              pendingEdit: null,
              pendingAssetEdit: null,
            },
          },
        },
        services: {},
      };

      const trigger = onSelectionOrSidebarChange(mockBind as never);

      // First call - no pending edits
      assert.strictEqual(trigger.condition(), false);

      // Change selection and add pending edit
      mockBind.controller.editor.selection.selectionId = "node-456";
      mockBind.controller.editor.step.pendingEdit = {
        nodeId: "node-456",
        graphId: "",
        graphVersion: 1,
        values: {},
      } as never;

      // Second call should return true
      const result = trigger.condition();
      assert.strictEqual(
        result,
        true,
        "Should return true after pending edit added"
      );
    });
  });

  suite("onNodeActionRequested", () => {
    test("returns true when request AND pendingEdit exist", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: {
                nodeId: "node-1",
                actionContext: "graph" as const,
              },
            },
          },
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "",
                graphVersion: 1,
                values: {},
              },
              pendingAssetEdit: null,
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
        "Should return true when request and pendingEdit exist"
      );
    });

    test("returns true when request AND pendingAssetEdit exist", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: {
                nodeId: "node-1",
                actionContext: "step" as const,
              },
            },
          },
          editor: {
            step: {
              pendingEdit: null,
              pendingAssetEdit: {
                graphVersion: 1,
                title: "asset",
                dataPart: null,
                update: () => Promise.resolve(),
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
        "Should return true when request and pendingAssetEdit exist"
      );
    });

    test("returns false when request exists but NO pending edits", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: {
                nodeId: "node-1",
                actionContext: "graph" as const,
              },
            },
          },
          editor: {
            step: {
              pendingEdit: null,
              pendingAssetEdit: null,
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
        "Should return false when no pending edits"
      );
    });

    test("returns false when pending edits exist but NO request", () => {
      const mockBind = {
        controller: {
          run: {
            main: {
              nodeActionRequest: null,
            },
          },
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "",
                graphVersion: 1,
                values: {},
              },
              pendingAssetEdit: null,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeActionRequested(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when no request");
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: {
          run: { main: { nodeActionRequest: null } },
          editor: {
            step: { pendingEdit: null, pendingAssetEdit: null },
          },
        },
        services: {},
      };

      const trigger = onNodeActionRequested(mockBind as never);

      assert.strictEqual(trigger.name, "Node Action Requested (Step)");
    });
  });
});
