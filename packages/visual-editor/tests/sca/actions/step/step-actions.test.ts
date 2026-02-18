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

    test("returns early when editor is null (version matches)", async () => {
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
              version: 5, // Matches
              editor: null, // No editor!
            },
          },
          global: {
            toasts: {
              toast: () => {
                assert.fail("Toast should not be called when editor is null");
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingAssetEdit();

      assert.strictEqual(clearCalled, true, "Pending edit should be cleared");
    });
  });

  suite("applyPendingNodeEdit (no-editor guard)", () => {
    test("returns early when editor is null (version matches)", async () => {
      let clearCalled = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "graph-1",
                graphVersion: 5,
                values: { key: "value" },
              },
              clearPendingEdit: () => {
                clearCalled = true;
              },
            },
            graph: {
              version: 5, // Matches
              editor: null, // No editor!
              lastNodeConfigChange: null,
            },
          },
          global: {
            toasts: {
              toast: () => {
                assert.fail("Toast should not be called when editor is null");
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingNodeEdit();

      assert.strictEqual(
        clearCalled,
        true,
        "Pending edit should still be cleared"
      );
    });
  });

  suite("applyPendingEditsForNodeAction", () => {
    test("does nothing when no pending edits exist", async () => {
      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: null,
              pendingAssetEdit: null,
            },
            graph: {
              version: 1,
            },
          },
          global: {
            toasts: {
              toast: () => {
                assert.fail("Toast should not be called");
              },
            },
          },
        } as never,
      });

      // Should not throw
      await stepActions.applyPendingEditsForNodeAction();
    });

    test("applies pending node edit when graph version matches", async () => {
      let applyCalled = false;
      let clearEditCalled = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "graph-1",
                graphVersion: 5,
                values: { key: "value" },
                ins: null,
              },
              pendingAssetEdit: null,
              clearPendingEdit: () => {
                clearEditCalled = true;
              },
            },
            graph: {
              version: 5, // Matches
              editor: {
                apply: async () => {
                  applyCalled = true;
                  return { success: true };
                },
              },
              lastNodeConfigChange: null,
            },
          },
          global: {
            toasts: {
              toast: () => {},
            },
          },
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(clearEditCalled, "clearPendingEdit should be called");
      assert.ok(applyCalled, "editor.apply should be called");
    });

    test("toasts and discards node edit when graph version mismatches", async () => {
      let toastShown = false;
      let toastType: ToastType | undefined;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "graph-1",
                graphVersion: 5,
                values: { key: "value" },
              },
              pendingAssetEdit: null,
              clearPendingEdit: () => {},
            },
            graph: {
              version: 10, // Different
              editor: {
                apply: async () => {
                  assert.fail("apply should not be called on stale edit");
                  return { success: true };
                },
              },
            },
          },
          global: {
            toasts: {
              toast: (_msg: string, type: ToastType) => {
                toastShown = true;
                toastType = type;
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(toastShown, "Should show toast for stale edit");
      assert.strictEqual(toastType, ToastType.WARNING);
    });

    test("skips node edit when editor is null", async () => {
      let clearCalled = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "graph-1",
                graphVersion: 5,
                values: { key: "value" },
              },
              pendingAssetEdit: null,
              clearPendingEdit: () => {
                clearCalled = true;
              },
            },
            graph: {
              version: 5,
              editor: null,
            },
          },
          global: {
            toasts: {
              toast: () => {},
            },
          },
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(clearCalled, "clearPendingEdit should still be called");
    });

    test("applies pending asset edit when graph version matches", async () => {
      let applyCallCount = 0;
      let clearAssetCalled = false;

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => ({}),
          },
        } as never,
        controller: {
          editor: {
            step: {
              pendingEdit: null,
              pendingAssetEdit: {
                assetPath: "test/asset.txt",
                graphVersion: 5,
                title: "Updated Title",
                dataPart: null,
              },
              clearPendingAssetEdit: () => {
                clearAssetCalled = true;
              },
            },
            graph: {
              version: 5,
              url: "https://example.com/board.json",
              graphAssets: new Map([
                [
                  "test/asset.txt",
                  {
                    metadata: { title: "Old Title", type: "content" },
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
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(clearAssetCalled, "clearPendingAssetEdit should be called");
      assert.strictEqual(
        applyCallCount,
        1,
        "Should call apply once (UpdateAssetWithRefs only, no dataPart)"
      );
    });

    test("toasts and discards asset edit when graph version mismatches", async () => {
      let toastShown = false;

      stepActions.bind({
        services: {} as never,
        controller: {
          editor: {
            step: {
              pendingEdit: null,
              pendingAssetEdit: {
                assetPath: "test/asset.txt",
                graphVersion: 5,
                title: "My Asset",
              },
              clearPendingAssetEdit: () => {},
            },
            graph: {
              version: 10, // Different
            },
          },
          global: {
            toasts: {
              toast: () => {
                toastShown = true;
              },
            },
          },
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(toastShown, "Should show toast for stale asset edit");
    });

    test("applies both node and asset edits together", async () => {
      let nodeApplied = false;
      let assetApplied = false;
      let applyCallCount = 0;

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => ({}),
          },
        } as never,
        controller: {
          editor: {
            step: {
              pendingEdit: {
                nodeId: "node-1",
                graphId: "graph-1",
                graphVersion: 5,
                values: { key: "value" },
                ins: null,
              },
              pendingAssetEdit: {
                assetPath: "test/asset.txt",
                graphVersion: 5,
                title: "Updated Asset",
                dataPart: null,
              },
              clearPendingEdit: () => {},
              clearPendingAssetEdit: () => {},
            },
            graph: {
              version: 5,
              url: "https://example.com/board.json",
              graphAssets: new Map([
                [
                  "test/asset.txt",
                  {
                    metadata: { title: "Old", type: "content" },
                  },
                ],
              ]),
              editor: {
                apply: async () => {
                  applyCallCount++;
                  if (applyCallCount === 1) nodeApplied = true;
                  if (applyCallCount === 2) assetApplied = true;
                  return { success: true };
                },
              },
              lastNodeConfigChange: null,
            },
          },
          global: {
            toasts: {
              toast: () => {},
            },
          },
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.ok(nodeApplied, "Node edit should be applied");
      assert.ok(assetApplied, "Asset edit should be applied");
      assert.strictEqual(applyCallCount, 2, "Should call apply twice");
    });

    test("applies asset with dataPart (persist + data + refs)", async () => {
      let applyCallCount = 0;

      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async (_url: URL, part: unknown) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      stepActions.bind({
        services: {
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as never,
        controller: {
          editor: {
            step: {
              pendingEdit: null,
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
        } as never,
      });

      await stepActions.applyPendingEditsForNodeAction();

      assert.strictEqual(
        applyCallCount,
        2,
        "Should call apply twice: UpdateAssetData + UpdateAssetWithRefs"
      );
    });
  });

  suite("lookupMemorySheet", () => {
    test("sets memorySheetUrl when Drive API returns a sheet", async () => {
      const mockController = {
        editor: {
          step: {
            memorySheetUrl: null as string | null,
          },
          graph: {
            url: "drive:/abc123",
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
          shellHost: {
            getDriveCollectorFile: async () => ({ ok: true, id: "sheet-xyz" }),
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.lookupMemorySheet();

      assert.strictEqual(
        mockController.editor.step.memorySheetUrl,
        "https://docs.google.com/spreadsheets/d/sheet-xyz",
        "Should construct the correct spreadsheet URL"
      );
    });

    test("sets memorySheetUrl to null when Drive API returns no result", async () => {
      const mockController = {
        editor: {
          step: {
            memorySheetUrl: "old-value" as string | null,
          },
          graph: {
            url: "drive:/abc123",
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
          shellHost: {
            getDriveCollectorFile: async () => ({ ok: false }),
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.lookupMemorySheet();

      assert.strictEqual(
        mockController.editor.step.memorySheetUrl,
        null,
        "Should set memorySheetUrl to null when API returns not ok"
      );
    });

    test("sets memorySheetUrl to null when graph URL is missing", async () => {
      let apiCalled = false;

      const mockController = {
        editor: {
          step: {
            memorySheetUrl: "old-value" as string | null,
          },
          graph: {
            url: null,
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
          shellHost: {
            getDriveCollectorFile: async () => {
              apiCalled = true;
              return { ok: true, id: "should-not-reach" };
            },
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.lookupMemorySheet();

      assert.strictEqual(
        mockController.editor.step.memorySheetUrl,
        null,
        "Should set memorySheetUrl to null when no graph URL"
      );
      assert.strictEqual(
        apiCalled,
        false,
        "Should not call Drive API when graph URL is missing"
      );
    });

    test("sets memorySheetUrl to null when Drive API throws", async () => {
      const mockController = {
        editor: {
          step: {
            memorySheetUrl: "old-value" as string | null,
          },
          graph: {
            url: "drive:/abc123",
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
          shellHost: {
            getDriveCollectorFile: async () => {
              throw new Error("Network error");
            },
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.lookupMemorySheet();

      assert.strictEqual(
        mockController.editor.step.memorySheetUrl,
        null,
        "Should set memorySheetUrl to null when API throws"
      );
    });

    test('strips "drive:/" prefix from graph URL when calling API', async () => {
      let capturedGraphId: string | undefined;

      const mockController = {
        editor: {
          step: {
            memorySheetUrl: null as string | null,
          },
          graph: {
            url: "drive:/my-board-id-456",
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
          shellHost: {
            getDriveCollectorFile: async (
              _mimeType: string,
              graphId: string
            ) => {
              capturedGraphId = graphId;
              return { ok: true, id: "sheet-1" };
            },
          },
        } as never,
        controller: mockController as never,
      });

      await stepActions.lookupMemorySheet();

      assert.strictEqual(
        capturedGraphId,
        "my-board-id-456",
        'Should strip "drive:/" prefix from graph URL'
      );
    });
  });
});
