/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ChangeAssetEdge } from "../../../src/ui/transforms/change-asset-edge.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { AssetEdge } from "../../../src/ui/types/types.js";

function createMockContext(opts: {
  nodes?: {
    id: string;
    configuration?: NodeConfiguration;
    ports?: {
      name: string;
      behaviors: string[];
      value?: unknown;
    }[];
  }[];
  graphId?: string;
  assets?: Map<string, { data: unknown[]; title: string }>;
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "main";
  const nodes = opts.nodes ?? [];

  const inspectable = {
    nodeById: (id: string) => {
      const n = nodes.find((n) => n.id === id);
      if (!n) return null;
      return {
        descriptor: { id: n.id },
        configuration: () => n.configuration ?? {},
        ports: async () => ({
          inputs: {
            ports: (n.ports ?? []).map((p) => ({
              name: p.name,
              schema: { behavior: p.behaviors },
              value: p.value,
            })),
          },
        }),
      };
    },
    assets: () => opts.assets ?? new Map(),
  };

  const graphs = new Map([[graphId, inspectable]]);

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

describe("ChangeAssetEdge", () => {
  it("fails when graph is not found", async () => {
    const { context } = createMockContext({ graphId: "other" });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "node-1",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("add", "missing", edge);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("returns success when node is not found (silent no-op)", async () => {
    const { context } = createMockContext({
      nodes: [{ id: "node-1" }],
    });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "missing-node",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("add", "main", edge);
    const result = await transform.apply(context);

    // ChangeAssetEdge returns { success: true } for missing nodes (line 48)
    assert.equal(result.success, true);
  });

  it("fails when no preview/content port is found", async () => {
    const { context } = createMockContext({
      nodes: [
        {
          id: "node-1",
          ports: [{ name: "regular-port", behaviors: ["text"] }],
        },
      ],
    });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "node-1",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("add", "main", edge);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("fails when asset is not found", async () => {
    const { context } = createMockContext({
      nodes: [
        {
          id: "node-1",
          ports: [
            {
              name: "preview",
              behaviors: ["hint-preview", "llm-content"],
            },
          ],
        },
      ],
      assets: new Map(), // empty
    });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "node-1",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("add", "main", edge);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("adds asset reference when port and asset exist", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          configuration: {},
          ports: [
            {
              name: "preview",
              behaviors: ["hint-preview", "llm-content"],
            },
          ],
        },
      ],
      assets: new Map([
        [
          "assets/img.png",
          {
            data: [
              {
                parts: [{ inlineData: { data: "abc", mimeType: "image/png" } }],
              },
            ],
            title: "My Image",
          },
        ],
      ]),
    });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "node-1",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("add", "main", edge);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeconfiguration");
    assert.ok(configEdits.length >= 1);
  });

  it("removes asset reference from existing config", async () => {
    const assetChip = `{{"type":"asset","path":"assets/img.png","title":"My Image"}}`;
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          configuration: {
            preview: {
              role: "user",
              parts: [{ text: `Use ${assetChip}` }],
            },
          },
          ports: [
            {
              name: "preview",
              behaviors: ["hint-preview", "llm-content"],
              value: {
                role: "user",
                parts: [{ text: `Use ${assetChip}` }],
              },
            },
          ],
        },
      ],
      assets: new Map([
        [
          "assets/img.png",
          {
            data: [{ parts: [{ text: "" }] }],
            title: "My Image",
          },
        ],
      ]),
    });

    const edge: AssetEdge = {
      direction: "load",
      nodeId: "node-1",
      assetPath: "assets/img.png",
    };
    const transform = new ChangeAssetEdge("remove", "main", edge);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeconfiguration");
    assert.ok(configEdits.length >= 1);
  });
});
