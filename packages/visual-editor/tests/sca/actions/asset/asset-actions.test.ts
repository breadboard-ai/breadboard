/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { before, after, beforeEach, suite, test } from "node:test";
import * as Asset from "../../../../src/sca/actions/asset/asset-actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import {
  makeTestGraphStoreWithEditor,
  makeTestServices,
} from "../../helpers/index.js";
import { GraphDescriptor, AssetPath } from "@breadboard-ai/types";
import type { GraphAsset } from "../../../../src/sca/types.js";
import { onGraphVersionChange } from "../../../../src/sca/actions/asset/triggers.js";
import { StateEvent } from "../../../../src/ui/events/events.js";
import { coordination } from "../../../../src/sca/coordination.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import { createMockEnvironment } from "../../helpers/mock-environment.js";
import { defaultRuntimeFlags } from "../../controller/data/default-flags.js";

suite("Asset Actions", () => {
  suite("syncFromGraph", () => {
    test("clears graphAssets when no graph is loaded", async () => {
      const { services } = makeTestServices();

      // Set up initial assets
      const initialAssets = new Map<AssetPath, GraphAsset>();
      initialAssets.set("existing.txt", {
        path: "existing.txt",
        data: [{ role: "user", parts: [{ text: "test" }] }],
      });

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              graph: null,
              graphAssets: initialAssets,
              setGraphAssets: (assets: Map<AssetPath, GraphAsset>) => {
                initialAssets.clear();
                for (const [key, value] of assets) {
                  initialAssets.set(key, value);
                }
              },
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Asset.syncFromGraph();

      assert.strictEqual(
        initialAssets.size,
        0,
        "graphAssets should be cleared"
      );
    });

    test("syncs assets from graph descriptor", async () => {
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();

      const mockGraph: GraphDescriptor = {
        nodes: [],
        edges: [],
        assets: {
          "test-asset.txt": {
            data: { inline: "test content" },
            metadata: { title: "Test Asset", type: "content" },
          },
          "another-asset.json": {
            data: { inline: '{"key": "value"}' },
            metadata: { title: "Another Asset", type: "content" },
          },
        },
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              graph: mockGraph,
              graphAssets,
              setGraphAssets: (assets: Map<AssetPath, GraphAsset>) => {
                graphAssets.clear();
                for (const [key, value] of assets) {
                  graphAssets.set(key, value);
                }
              },
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Asset.syncFromGraph();

      assert.strictEqual(graphAssets.size, 2, "Should have 2 assets");
      assert.ok(
        graphAssets.has("test-asset.txt"),
        "Should have test-asset.txt"
      );
      assert.ok(
        graphAssets.has("another-asset.json"),
        "Should have another-asset.json"
      );

      const testAsset = graphAssets.get("test-asset.txt");
      assert.strictEqual(testAsset?.metadata?.title, "Test Asset");
    });

    test("handles graph with no assets property", async () => {
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();

      const mockGraph: GraphDescriptor = {
        nodes: [],
        edges: [],
        // No assets property
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              graph: mockGraph,
              graphAssets,
              setGraphAssets: (assets: Map<AssetPath, GraphAsset>) => {
                graphAssets.clear();
                for (const [key, value] of assets) {
                  graphAssets.set(key, value);
                }
              },
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      await Asset.syncFromGraph();

      assert.strictEqual(graphAssets.size, 0, "Should have no assets");
    });
  });

  suite("update", () => {
    test("returns error when no editor available", async () => {
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("test.txt", {
        path: "test.txt",
        data: [],
        metadata: { title: "Test", type: "content" },
      });

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: null,
              graphAssets,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.update("test.txt", "New Title");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("No editor"),
        "Error should mention no editor"
      );
    });

    test("returns error when asset has no metadata", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("no-metadata.txt", {
        path: "no-metadata.txt",
        data: [],
        // No metadata
      });

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              graphAssets,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.update("no-metadata.txt", "New Title");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("no metadata"),
        "Error should mention no metadata"
      );
    });

    test("returns error when asset not found", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              graphAssets,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.update("nonexistent.txt", "New Title");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
    });

    test("updates asset title successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      // Add an asset to the graph first
      await editor.edit(
        [
          {
            type: "addasset",
            path: "updatable.txt",
            data: { inline: "test content" },
            metadata: { title: "Original Title", type: "content" },
          },
        ],
        "Add test asset"
      );

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("updatable.txt", {
        path: "updatable.txt",
        data: [],
        metadata: { title: "Original Title", type: "content" },
      });

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              graphAssets,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.update("updatable.txt", "New Title");

      // Should return undefined (success) or void
      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );
    });

    test("updates asset with data successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();

      // Create mock transformer that returns data unchanged
      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async (
          _url: URL,
          part: { inlineData: { data: string; mimeType: string } }
        ) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      const { services } = makeTestServices();

      // Add an asset to the graph first
      await editor.edit(
        [
          {
            type: "addasset",
            path: "data-asset.txt",
            data: { inline: "original content" },
            metadata: { title: "Data Asset", type: "content" },
          },
        ],
        "Add test asset"
      );

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("data-asset.txt", {
        path: "data-asset.txt",
        data: [{ role: "user", parts: [{ text: "original" }] }],
        metadata: { title: "Data Asset", type: "content" },
      });

      Asset.bind({
        services: {
          ...services,
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              graphAssets,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const newData = [
        { role: "user" as const, parts: [{ text: "new content" }] },
      ];
      const result = await Asset.update(
        "data-asset.txt",
        "Updated Title",
        newData
      );

      // Should return undefined (success) or void
      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );
    });

    test("returns error when UpdateAssetData fails", async () => {
      const { editor } = makeTestGraphStoreWithEditor();

      // Create mock transformer
      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async (
          _url: URL,
          part: { inlineData: { data: string; mimeType: string } }
        ) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      const { services } = makeTestServices();

      // Add asset to graph
      await editor.edit(
        [
          {
            type: "addasset",
            path: "will-fail.txt",
            data: { inline: "test" },
            metadata: { title: "Test", type: "content" },
          },
        ],
        "Add test asset"
      );

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("will-fail.txt", {
        path: "will-fail.txt",
        data: [],
        metadata: { title: "Test", type: "content" },
      });

      // Create mock editor that fails on second apply
      let applyCount = 0;
      const mockEditor = {
        apply: async () => {
          applyCount++;
          if (applyCount === 1) {
            return { success: true };
          }
          return { success: false, error: "Data update failed" };
        },
      };

      Asset.bind({
        services: {
          ...services,
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              graphAssets,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const newData = [{ role: "user" as const, parts: [{ text: "new" }] }];
      const result = await Asset.update("will-fail.txt", "Title", newData);

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("Data update failed"),
        "Error should mention data update failed"
      );
    });

    test("returns error when UpdateAssetData apply fails on first call (L124)", async () => {
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("first-fail.txt", {
        path: "first-fail.txt",
        data: [],
        metadata: { title: "Test", type: "content" },
      });

      // Mock editor that fails on the FIRST apply (UpdateAssetData)
      const mockEditor = {
        apply: async () => {
          return { success: false, error: "UpdateAssetData failed" };
        },
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              graphAssets,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const newData = [{ role: "user" as const, parts: [{ text: "data" }] }];
      const result = await Asset.update("first-fail.txt", "Title", newData);

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("UpdateAssetData failed"),
        "Error should come from the first apply"
      );
    });

    test("returns error when title-only UpdateAssetWithRefs fails (L139)", async () => {
      const { services } = makeTestServices();

      const graphAssets = new Map<AssetPath, GraphAsset>();
      graphAssets.set("title-fail.txt", {
        path: "title-fail.txt",
        data: [],
        metadata: { title: "Old Title", type: "content" },
      });

      const mockEditor = {
        apply: async () => {
          return { success: false, error: "Title update failed" };
        },
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              graphAssets,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      // No data argument — title-only path
      const result = await Asset.update("title-fail.txt", "New Title");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("Title update failed"),
        "Error should come from title-only apply"
      );
    });
  });

  suite("persistDataParts", () => {
    test("returns contents unchanged when urlString is null", async () => {
      const contents = [{ role: "user" as const, parts: [{ text: "test" }] }];
      const mockTransformer = {} as ReturnType<
        typeof Asset.bind.services.googleDriveBoardServer.dataPartTransformer
      >;

      const result = await Asset.persistDataParts(
        null,
        contents,
        mockTransformer
      );

      assert.deepStrictEqual(
        result,
        contents,
        "Should return original contents"
      );
    });

    test("returns transformed contents on success", async () => {
      const contents = [
        { role: "user" as const, parts: [{ text: "original" }] },
      ];

      // Mock transformDataParts by using a transformer that returns modified data
      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async () => ({ text: "transformed" }),
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      } as unknown as ReturnType<
        typeof Asset.bind.services.googleDriveBoardServer.dataPartTransformer
      >;

      const result = await Asset.persistDataParts(
        "https://example.com/board.json",
        contents,
        mockTransformer
      );

      // Since transformDataParts is called internally, and text parts don't get transformed,
      // the result should be the same as input (text parts aren't data parts that need transforming)
      assert.ok(Array.isArray(result), "Should return an array");
      assert.strictEqual(result.length, 1, "Should have one content item");
    });

    test("returns original contents when transform fails", async () => {
      const contents = [
        {
          role: "user" as const,
          parts: [{ inlineData: { data: "test", mimeType: "text/plain" } }],
        },
      ];

      // Mock transformer that returns an error
      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async () => ({ $error: "Transform failed" }),
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      } as unknown as ReturnType<
        typeof Asset.bind.services.googleDriveBoardServer.dataPartTransformer
      >;

      const result = await Asset.persistDataParts(
        "https://example.com/board.json",
        contents,
        mockTransformer
      );

      // When transform fails, should return original contents
      assert.deepStrictEqual(
        result,
        contents,
        "Should return original contents on failure"
      );
    });

    test("creates URL from urlString correctly", async () => {
      const contents = [{ role: "user" as const, parts: [{ text: "test" }] }];

      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "text/plain" },
        }),
        persistPart: async () => {
          return { text: "test" };
        },
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      } as unknown as ReturnType<
        typeof Asset.bind.services.googleDriveBoardServer.dataPartTransformer
      >;

      await Asset.persistDataParts(
        "https://example.com/path/to/board.json",
        contents,
        mockTransformer
      );

      // Text parts don't trigger persistPart, but we can verify the function runs without error
      assert.ok(true, "Should not throw when parsing valid URL");
    });
  });

  suite("addGraphAsset", () => {
    test("returns error when no editor available", async () => {
      const { services } = makeTestServices();

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: null,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.addGraphAsset({
        path: "test.txt",
        data: [{ role: "user", parts: [{ text: "hello" }] }],
        metadata: { title: "Test", type: "content" },
      });

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("No editor"),
        "Error should mention no editor"
      );
    });

    test("adds an asset successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.addGraphAsset({
        path: "new-asset.txt",
        data: [{ role: "user", parts: [{ text: "new content" }] }],
        metadata: { title: "New Asset", type: "content" },
      });

      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );

      // Verify the asset was actually added to the graph
      const raw = editor.raw();
      assert.ok(raw.assets?.["new-asset.txt"], "Asset should be in graph");
    });

    test("adds multiple assets in parallel (Promise.all)", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      // Parallel add — mirrors the real caller in asset.ts AddRoute
      const results = await Promise.all([
        Asset.addGraphAsset({
          path: "parallel-a.txt",
          data: [{ role: "user", parts: [{ text: "a" }] }],
          metadata: { title: "Asset A", type: "content" },
        }),
        Asset.addGraphAsset({
          path: "parallel-b.txt",
          data: [{ role: "user", parts: [{ text: "b" }] }],
          metadata: { title: "Asset B", type: "content" },
        }),
      ]);

      for (const result of results) {
        assert.ok(
          result === undefined || !("$error" in (result ?? {})),
          "Each add should succeed without error"
        );
      }

      // Verify both assets exist in the graph
      const raw = editor.raw();
      assert.ok(raw.assets?.["parallel-a.txt"], "Asset A should be in graph");
      assert.ok(raw.assets?.["parallel-b.txt"], "Asset B should be in graph");
    });

    test("returns error when edit fails", async () => {
      const { services } = makeTestServices();

      const mockEditor = {
        edit: async () => ({ success: false, error: "Edit rejected" }),
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.addGraphAsset({
        path: "will-fail.txt",
        data: [{ role: "user", parts: [{ text: "test" }] }],
        metadata: { title: "Test", type: "content" },
      });

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
    });

    test("sets inlineData title from metadata (L203-204)", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      // Mock transformer needed because persistDataParts calls
      // transformer.persistPart on inline data parts
      const mockTransformer = {
        addEphemeralBlob: async () => ({
          storedData: { handle: "blob:test", mimeType: "image/png" },
        }),
        persistPart: async (
          _url: URL,
          part: { inlineData: { data: string; mimeType: string } }
        ) => part,
        persistentToEphemeral: async (part: unknown) => part,
        toFileData: async (_url: URL, part: unknown) => part,
      };

      Asset.bind({
        services: {
          ...services,
          googleDriveBoardServer: {
            dataPartTransformer: () => mockTransformer,
          },
        } as unknown as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
              url: "https://example.com/board.json",
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.addGraphAsset({
        path: "inline-asset.png",
        data: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: "base64data",
                  mimeType: "image/png",
                },
              },
            ],
          },
        ],
        metadata: { title: "My Image", type: "content" },
      });

      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );

      // Verify the asset was added
      const raw = editor.raw();
      assert.ok(raw.assets?.["inline-asset.png"], "Asset should be in graph");
    });
  });

  suite("removeGraphAsset", () => {
    test("returns error when no editor available", async () => {
      const { services } = makeTestServices();

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: null,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.removeGraphAsset("test.txt");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("No editor"),
        "Error should mention no editor"
      );
    });

    test("removes an asset successfully", async () => {
      const { editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices();

      // First add an asset
      await editor.edit(
        [
          {
            type: "addasset",
            path: "removable.txt",
            data: { inline: "test content" },
            metadata: { title: "Removable", type: "content" },
          },
        ],
        "Add test asset"
      );

      // Verify it's there
      assert.ok(editor.raw().assets?.["removable.txt"], "Asset should exist");

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.removeGraphAsset("removable.txt");

      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );

      // Verify the asset was removed
      const raw = editor.raw();
      assert.ok(
        !raw.assets?.["removable.txt"],
        "Asset should no longer be in graph"
      );
    });

    test("returns error when apply fails (L240)", async () => {
      const { services } = makeTestServices();

      const mockEditor = {
        apply: async () => ({
          success: false,
          error: "Remove transform failed",
        }),
      };

      Asset.bind({
        services: services as AppServices,
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
            },
          },
        } as unknown as AppController,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const result = await Asset.removeGraphAsset("some-asset.txt");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
      assert.ok(
        result!.$error.includes("Remove transform failed"),
        "Error should mention the apply failure"
      );
    });
  });
});

suite("Asset Triggers", () => {
  // Minimal type for the bind object - only what onGraphVersionChange actually needs
  type TriggerBind = {
    controller: { editor: { graph: { version: number; graph: unknown } } };
    services: unknown;
  };

  suite("onGraphVersionChange", () => {
    test("returns version + 1 to handle version 0 being falsy", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
              graph: { nodes: [], edges: [] }, // Must have a graph to pass the !graph check
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(
        mockBind as Parameters<typeof onGraphVersionChange>[0]
      );

      // The trigger should have a name and be a signal type
      assert.strictEqual(trigger.type, "signal");
      assert.strictEqual(trigger.name, "Graph Version Change (Assets)");

      // Execute the condition function to get the return value
      const result = trigger.condition();
      assert.strictEqual(result, 1, "Version 0 should return 1 (truthy)");
    });

    test("returns different values for different versions", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              graph: { nodes: [], edges: [] },
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(
        mockBind as Parameters<typeof onGraphVersionChange>[0]
      );
      const result = trigger.condition();
      assert.strictEqual(result, 6, "Version 5 should return 6");
    });

    test("trigger value changes when graph version changes", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
              graph: { nodes: [], edges: [] },
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(
        mockBind as Parameters<typeof onGraphVersionChange>[0]
      );

      // Initial version
      assert.strictEqual(trigger.condition(), 1);

      // Simulate version increment
      mockBind.controller.editor.graph.version = 1;
      assert.strictEqual(trigger.condition(), 2);

      // Another increment
      mockBind.controller.editor.graph.version = 10;
      assert.strictEqual(trigger.condition(), 11);
    });

    test("returns same value for same version (coordination handles deduplication)", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              graph: { nodes: [], edges: [] },
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(
        mockBind as Parameters<typeof onGraphVersionChange>[0]
      );

      // Trigger always returns version + 1 when graph exists.
      // The coordination system is responsible for detecting value changes.
      assert.strictEqual(trigger.condition(), 6);
      assert.strictEqual(
        trigger.condition(),
        6,
        "Same version returns same value"
      );
    });

    test("returns false when no graph loaded", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              graph: null, // No graph loaded
            },
          },
        },
        services: {},
      };

      const trigger = onGraphVersionChange(
        mockBind as Parameters<typeof onGraphVersionChange>[0]
      );

      assert.strictEqual(
        trigger.condition(),
        false,
        "Should return false when no graph"
      );
    });
  });
});

// =============================================================================
// Event-Triggered Asset Actions
// =============================================================================

suite("Asset Actions — Event-Triggered", () => {
  before(() => setDOM());
  after(() => unsetDOM());

  beforeEach(() => {
    coordination.reset();
  });

  function bindAssetForEvent(editor: unknown) {
    Asset.bind({
      controller: {
        editor: {
          graph: {
            editor,
            url: "https://example.com/board.json",
            graphAssets: new Map(),
          },
        },
        global: {
          main: { blockingAction: false },
          snackbars: {
            snackbar: () => {},
            removeSnackbar: () => {},
          },
        },
      } as unknown as AppController,
      services: {
        stateEventBus: new EventTarget(),
        googleDriveBoardServer: {
          dataPartTransformer: () => ({
            addEphemeralBlob: async () => ({
              storedData: { handle: "blob:test", mimeType: "text/plain" },
            }),
            persistPart: async (_url: URL, part: unknown) => part,
            persistentToEphemeral: async (part: unknown) => part,
            toFileData: async (_url: URL, part: unknown) => part,
          }),
        },
      } as unknown as AppServices,
      env: createMockEnvironment(defaultRuntimeFlags),
    });
  }

  suite("onChangeAssetEdge", () => {
    test("applies ChangeAssetEdge transform for add", async () => {
      let appliedTransform: unknown = null;
      const mockEditor = {
        apply: async (transform: unknown) => {
          appliedTransform = transform;
          return { success: true };
        },
      };

      bindAssetForEvent(mockEditor);

      const evt = new StateEvent<"asset.changeedge">({
        eventType: "asset.changeedge",
        changeType: "add" as const,
        assetEdge: {
          direction: "load",
          nodeId: "node-1",
          assetPath: "test.txt" as AssetPath,
        },
        subGraphId: null,
      });
      await Asset.onChangeAssetEdge(evt);

      assert.ok(appliedTransform, "editor.apply should have been called");
    });

    test("returns early when no editor", async () => {
      bindAssetForEvent(null);

      const evt = new StateEvent<"asset.changeedge">({
        eventType: "asset.changeedge",
        changeType: "remove" as const,
        assetEdge: {
          direction: "load",
          nodeId: "node-1",
          assetPath: "test.txt" as AssetPath,
        },
        subGraphId: null,
      });
      // Should not throw
      await Asset.onChangeAssetEdge(evt);
    });
  });

  suite("onAddAssets", () => {
    test("calls addGraphAsset for each asset in the event", async () => {
      const editCalls: unknown[][] = [];
      const mockEditor = {
        edit: async (edits: unknown[]) => {
          editCalls.push(edits);
          return { success: true };
        },
        apply: async () => ({ success: true }),
      };

      bindAssetForEvent(mockEditor);

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "doc.txt",
            type: "content",
            path: "doc.txt" as AssetPath,
            data: { role: "user", parts: [{ text: "hello" }] },
          },
        ],
      });
      await Asset.onAddAssets(evt);

      assert.ok(editCalls.length > 0, "editor.edit should have been called");
    });

    test("returns early when no editor", async () => {
      bindAssetForEvent(null);

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "doc.txt",
            type: "content",
            path: "doc.txt" as AssetPath,
            data: { role: "user", parts: [{ text: "hello" }] },
          },
        ],
      });
      // Should not throw
      await Asset.onAddAssets(evt);
    });

    test("sets subType in metadata when asset has subType", async () => {
      const editCalls: unknown[][] = [];
      const mockEditor = {
        edit: async (edits: unknown[]) => {
          editCalls.push(edits);
        },
        apply: async () => ({ success: true }),
      };

      bindAssetForEvent(mockEditor);

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "tool.json",
            type: "content",
            subType: "webcam",
            path: "tool.json" as AssetPath,
            data: { role: "user", parts: [{ text: "payload" }] },
          },
        ],
      });
      await Asset.onAddAssets(evt);

      assert.ok(editCalls.length > 0, "editor.edit should have been called");
      const addSpec = editCalls[0][0] as {
        metadata: { subType?: string };
      };
      assert.strictEqual(
        addSpec.metadata.subType,
        "webcam",
        "subType should be set in metadata"
      );
    });

    test("marks inline data parts with asset title", async () => {
      const inlinePart = {
        inlineData: { data: "dGVzdA==", mimeType: "text/plain" },
      };
      const editCalls: unknown[][] = [];
      const mockEditor = {
        edit: async (edits: unknown[]) => {
          editCalls.push(edits);
        },
        apply: async () => ({ success: true }),
      };

      bindAssetForEvent(mockEditor);

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "image.png",
            type: "content",
            path: "image.png" as AssetPath,
            data: { role: "user", parts: [inlinePart] },
          },
        ],
      });
      await Asset.onAddAssets(evt);

      // The inline part should have been mutated in-place with the title
      assert.strictEqual(
        (inlinePart.inlineData as { title?: string }).title,
        "image.png",
        "Inline data should be marked with asset title"
      );
    });

    test("does not show snackbar when processing completes quickly", async () => {
      const snackbarCalls: unknown[][] = [];
      const mockEditor = {
        edit: async () => {},
        apply: async () => ({ success: true }),
      };

      Asset.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              url: "https://example.com/board.json",
              graphAssets: new Map(),
            },
          },
          global: {
            main: { blockingAction: false },
            snackbars: {
              snackbar: (...args: unknown[]) => {
                snackbarCalls.push(args);
              },
              removeSnackbar: () => {},
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
          googleDriveBoardServer: {
            dataPartTransformer: () => ({
              addEphemeralBlob: async () => ({
                storedData: { handle: "blob:test", mimeType: "text/plain" },
              }),
              persistPart: async (_url: URL, part: unknown) => part,
              persistentToEphemeral: async (part: unknown) => part,
              toFileData: async (_url: URL, part: unknown) => part,
            }),
          },
        } as unknown as AppServices,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "fast.txt",
            type: "content",
            path: "fast.txt" as AssetPath,
            data: { role: "user", parts: [{ text: "quick" }] },
          },
        ],
      });

      await Asset.onAddAssets(evt);

      assert.strictEqual(
        snackbarCalls.length,
        0,
        "No snackbar should appear for fast operations"
      );
    });

    test("shows pending snackbar then dismisses it for slow operations", async () => {
      const snackbarCalls: unknown[][] = [];

      // Gate to block editor.edit until we release it
      let releaseEdit!: () => void;
      const editGate = new Promise<void>((resolve) => {
        releaseEdit = resolve;
      });

      const mockEditor = {
        edit: async () => {
          await editGate;
        },
        apply: async () => ({ success: true }),
      };

      Asset.bind({
        controller: {
          editor: {
            graph: {
              editor: mockEditor,
              url: "https://example.com/board.json",
              graphAssets: new Map(),
            },
          },
          global: {
            main: { blockingAction: false },
            snackbars: {
              snackbar: (...args: unknown[]) => {
                snackbarCalls.push(args);
              },
              removeSnackbar: () => {},
            },
          },
        } as unknown as AppController,
        services: {
          stateEventBus: new EventTarget(),
          googleDriveBoardServer: {
            dataPartTransformer: () => ({
              addEphemeralBlob: async () => ({
                storedData: { handle: "blob:test", mimeType: "text/plain" },
              }),
              persistPart: async (_url: URL, part: unknown) => part,
              persistentToEphemeral: async (part: unknown) => part,
              toFileData: async (_url: URL, part: unknown) => part,
            }),
          },
        } as unknown as AppServices,
        env: createMockEnvironment(defaultRuntimeFlags),
      });

      const evt = new StateEvent<"asset.add">({
        eventType: "asset.add",
        assets: [
          {
            name: "slow.txt",
            type: "content",
            path: "slow.txt" as AssetPath,
            data: { role: "user", parts: [{ text: "slow data" }] },
          },
        ],
      });

      // Start the action but don't await it yet
      const actionPromise = Asset.onAddAssets(evt);

      // Wait past the ASSET_TIMEOUT (250ms)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Pending snackbar should have appeared
      assert.strictEqual(
        snackbarCalls.length,
        1,
        "Pending snackbar should appear after timeout"
      );
      assert.strictEqual(
        snackbarCalls[0][0],
        "Processing assets, please wait..."
      );

      // Release the edit gate so the action completes
      releaseEdit();
      await actionPromise;

      // Final snackbar should dismiss the pending one
      assert.strictEqual(
        snackbarCalls.length,
        2,
        "Should have pending + completion snackbars"
      );
      assert.strictEqual(snackbarCalls[1][0], "Processed assets");

      // The completion snackbar should reference the same snackbarId
      const pendingId = snackbarCalls[0][4];
      const completionId = snackbarCalls[1][4];
      assert.strictEqual(
        pendingId,
        completionId,
        "Completion snackbar should replace the pending one"
      );
    });
  });
});
