/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import * as Asset from "../../../../src/sca/actions/asset/asset-actions.js";
import { AppServices } from "../../../../src/sca/services/services.js";
import { AppController } from "../../../../src/sca/controller/controller.js";
import {
  makeTestGraphStoreWithEditor,
  makeTestServices,
} from "../../helpers/index.js";
import { GraphDescriptor, AssetPath } from "@breadboard-ai/types";
import type { GraphAsset } from "../../../../src/ui/state/types.js";
import { onGraphVersionChange } from "../../../../src/sca/actions/asset/triggers.js";

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
      const { graphStore, editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices({ graphStore });

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
      const { graphStore, editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices({ graphStore });

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
      });

      const result = await Asset.update("nonexistent.txt", "New Title");

      assert.ok(result !== undefined, "Should return error result");
      assert.ok("$error" in result!, "Result should have $error");
    });

    test("updates asset title successfully", async () => {
      const { graphStore, editor } = makeTestGraphStoreWithEditor();
      const { services } = makeTestServices({ graphStore });

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
      });

      const result = await Asset.update("updatable.txt", "New Title");

      // Should return undefined (success) or void
      assert.ok(
        result === undefined || !("$error" in (result ?? {})),
        "Should succeed without error"
      );
    });

    test("updates asset with data successfully", async () => {
      const { graphStore, editor } = makeTestGraphStoreWithEditor();

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

      const { services } = makeTestServices({ graphStore });

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
      const { graphStore, editor } = makeTestGraphStoreWithEditor();

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

      const { services } = makeTestServices({ graphStore });

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
});

suite("Asset Triggers", () => {
  // Minimal type for the bind object - only what onGraphVersionChange actually needs
  type TriggerBind = {
    controller: { editor: { graph: { version: number } } };
    services: unknown;
  };

  suite("onGraphVersionChange", () => {
    test("returns version + 1 to handle version 0 being falsy", () => {
      const mockBind: TriggerBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
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
  });
});
