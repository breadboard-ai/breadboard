/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as stepActions from "../../../../src/sca/actions/step/step-actions.js";
import { ToastType } from "../../../../src/ui/events/events.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

suite("Step Actions", () => {
  beforeEach(() => {
    setDOM();
    coordination.reset();
  });

  afterEach(() => {
    unsetDOM();
  });

  suite("applyPendingNodeEdit", () => {
    test("clears pending edit before applying when graph version matches", async () => {
      // This test verifies the key coordination behavior:
      // - pendingEdit is cleared BEFORE applying (so if apply fails, we don't re-trigger)
      // - version check passes when versions match

      let clearCalled = false;
      let clearCalledBeforeApply = false;

      const mockController = {
        editor: {
          step: {
            pendingEdit: {
              nodeId: "node-123",
              graphId: "graph-456",
              graphVersion: 5,
              values: { key: "value" },
            },
            clearPendingEdit: () => {
              clearCalled = true;
              clearCalledBeforeApply = true;
            },
          },
          graph: {
            version: 5, // Matches pendingEdit.graphVersion
            editor: {
              apply: async () => ({ success: true }),
            },
            lastNodeConfigChange: null,
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {} as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingNodeEdit();

      assert.strictEqual(
        clearCalled,
        true,
        "clearPendingEdit should be called when version matches"
      );
      assert.strictEqual(
        clearCalledBeforeApply,
        true,
        "clearPendingEdit should be called before applying (to prevent re-triggers on failure)"
      );
    });

    test("shows warning toast and discards edit when graph version mismatches", async () => {
      let toastShown = false;
      let toastMessage = "";
      let toastType: ToastType | undefined;
      let clearCalled = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-123",
                graphId: "graph-456",
                graphVersion: 5,
                values: { key: "value" },
              },
              clearPendingEdit: () => {
                clearCalled = true;
              },
            },
            graph: {
              version: 10, // DIFFERENT from pendingEdit.graphVersion
            },
          },
          global: {
            toasts: {
              toast: (message: string, type: ToastType) => {
                toastShown = true;
                toastMessage = message;
                toastType = type;
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingNodeEdit();

      assert.strictEqual(clearCalled, true, "Pending edit should be cleared");
      assert.strictEqual(toastShown, true, "Toast should be shown");
      assert.strictEqual(
        toastType,
        ToastType.WARNING,
        "Toast should be a warning"
      );
      assert.ok(
        toastMessage.includes("discarded"),
        `Toast message should mention discarding, got: ${toastMessage}`
      );
    });

    test("does nothing when no pending node edit", async () => {
      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: null,
            },
            graph: {
              version: 1,
            },
          },
          global: {
            toasts: {
              toast: () => {
                assert.fail("Toast should not be called when no pending edits");
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingNodeEdit();

      assert.ok(true, "Should complete without doing anything");
    });
  });

  suite("applyPendingAssetEdit", () => {
    test("clears pending asset edit before applying when graph version matches", async () => {
      let clearPendingAssetEditCalled = false;

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "test/asset.txt",
              graphVersion: 5,
              title: "My Asset",
              dataPart: null,
            },
            clearPendingAssetEdit: () => {
              clearPendingAssetEditCalled = true;
            },
          },
          graph: {
            version: 5, // Matches
            graphAssets: new Map([
              [
                "test/asset.txt",
                {
                  path: "test/asset.txt",
                  metadata: { title: "Old Title", type: "content" },
                },
              ],
            ]),
            editor: {
              apply: async () => ({ success: true }),
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => ({}),
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(
        clearPendingAssetEditCalled,
        true,
        "clearPendingAssetEdit should be called when version matches"
      );
    });

    test("shows warning toast and discards asset edit when version mismatches", async () => {
      let toastShown = false;
      let toastType: ToastType | undefined;
      let clearCalled = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingAssetEdit: {
                assetPath: "test/asset.txt",
                graphVersion: 5,
                title: "My Asset",
                dataPart: null,
              },
              clearPendingAssetEdit: () => {
                clearCalled = true;
              },
            },
            graph: {
              version: 10, // DIFFERENT
            },
          },
          global: {
            toasts: {
              toast: (_message: string, type: ToastType) => {
                toastShown = true;
                toastType = type;
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(
        clearCalled,
        true,
        "Pending asset edit should be cleared"
      );
      assert.strictEqual(toastShown, true, "Toast should be shown");
      assert.strictEqual(
        toastType,
        ToastType.WARNING,
        "Toast should be a warning"
      );
    });

    test("does nothing when no pending asset edit", async () => {
      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingAssetEdit: null,
            },
            graph: {
              version: 1,
            },
          },
          global: {
            toasts: {
              toast: () => {
                assert.fail("Toast should not be called when no pending edits");
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.ok(true, "Should complete without doing anything");
    });

    test("warns and returns when asset is not found in graphAssets", async () => {
      let clearCalled = false;
      const warnMock = mock.method(console, "warn");

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "nonexistent/asset.txt",
              graphVersion: 5,
              title: "My Asset",
              dataPart: null,
            },
            clearPendingAssetEdit: () => {
              clearCalled = true;
            },
          },
          graph: {
            version: 5, // Matches
            graphAssets: new Map(), // Empty - asset not found
            editor: {
              apply: async () => {
                assert.fail("apply should not be called when asset not found");
                return { success: true };
              },
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {} as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(
        clearCalled,
        true,
        "Pending edit should still be cleared"
      );
      assert.ok(
        warnMock.mock.calls.some((c) =>
          c.arguments.some((a) => String(a).includes("no metadata"))
        ),
        `Should warn about missing metadata`
      );
    });

    test("warns and returns when asset has no metadata", async () => {
      let clearCalled = false;
      const warnMock = mock.method(console, "warn");

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "test/asset.txt",
              graphVersion: 5,
              title: "My Asset",
              dataPart: null,
            },
            clearPendingAssetEdit: () => {
              clearCalled = true;
            },
          },
          graph: {
            version: 5,
            graphAssets: new Map([
              ["test/asset.txt", { path: "test/asset.txt" }], // No metadata
            ]),
            editor: {
              apply: async () => {
                assert.fail("apply should not be called when no metadata");
                return { success: true };
              },
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {} as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(
        clearCalled,
        true,
        "Pending edit should still be cleared"
      );
      assert.ok(
        warnMock.mock.calls.some((c) =>
          c.arguments.some((a) => String(a).includes("no metadata"))
        ),
        `Should warn about missing metadata`
      );
    });

    test("warns and returns when UpdateAssetWithRefs fails", async () => {
      let clearCalled = false;
      const warnMock = mock.method(console, "warn");

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "test/asset.txt",
              graphVersion: 5,
              title: "My Asset",
              dataPart: null,
            },
            clearPendingAssetEdit: () => {
              clearCalled = true;
            },
          },
          graph: {
            version: 5,
            graphAssets: new Map([
              [
                "test/asset.txt",
                {
                  path: "test/asset.txt",
                  metadata: { title: "Old", type: "content" },
                },
              ],
            ]),
            editor: {
              apply: async () => ({
                success: false,
                error: "Refs update failed",
              }),
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {} as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(clearCalled, true, "Pending edit should be cleared");
      assert.ok(
        warnMock.mock.calls.some((c) =>
          c.arguments.some((a) =>
            String(a).includes("Failed to update asset refs")
          )
        ),
        `Should warn about refs failure`
      );
    });

    test("applies data update when dataPart is provided", async () => {
      let applyCallCount = 0;
      let clearCalled = false;

      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async (_url: URL, part: unknown) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "test/asset.txt",
              graphVersion: 5,
              title: "Updated Title",
              dataPart: { text: "new content" },
            },
            clearPendingAssetEdit: () => {
              clearCalled = true;
            },
          },
          graph: {
            version: 5,
            url: "https://example.com/board.json",
            graphAssets: new Map([
              [
                "test/asset.txt",
                {
                  path: "test/asset.txt",
                  metadata: { title: "Old", type: "content" },
                },
              ],
            ]),
            editor: {
              apply: async () => {
                applyCallCount++;
                return { success: true };
              },
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(clearCalled, true, "Pending edit should be cleared");
      assert.strictEqual(
        applyCallCount,
        2,
        "Should call apply twice: once for refs, once for data"
      );
    });

    test("warns when UpdateAssetData fails", async () => {
      let applyCallCount = 0;
      const warnMock = mock.method(console, "warn");

      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async (_url: URL, part: unknown) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      const mockController = {
        editor: {
          step: {
            pendingAssetEdit: {
              assetPath: "test/asset.txt",
              graphVersion: 5,
              title: "Updated Title",
              dataPart: { text: "new content" },
            },
            clearPendingAssetEdit: () => {},
          },
          graph: {
            version: 5,
            url: "https://example.com/board.json",
            graphAssets: new Map([
              [
                "test/asset.txt",
                {
                  path: "test/asset.txt",
                  metadata: { title: "Old", type: "content" },
                },
              ],
            ]),
            editor: {
              apply: async () => {
                applyCallCount++;
                if (applyCallCount === 1) {
                  return { success: true }; // First call (refs) succeeds
                }
                return { success: false, error: "Data update failed" }; // Second call (data) fails
              },
            },
          },
        },
        global: {
          toasts: {
            toast: () => {},
          },
        },
      };

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(applyCallCount, 2, "Should call apply twice");
      assert.ok(
        warnMock.mock.calls.some((c) =>
          c.arguments.some((a) =>
            String(a).includes("Failed to update asset refs")
          )
        ),
        `Should warn about data update failure`
      );
    });
  });
});
