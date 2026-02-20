/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { RemoveAssetWithRefs } from "../../../src/ui/transforms/remove-asset-with-refs.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

const assetChip = (path: string): TemplatePart => ({
  type: "asset",
  path,
  title: path,
});

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

function createMockContext(
  graphNodes: Record<string, { id: string; configuration: NodeConfiguration }[]>
) {
  const appliedEdits: EditSpec[][] = [];

  const graphEntries = new Map(
    Object.entries(graphNodes).map(([graphId, nodes]) => {
      const nodeConfigs = new Map(
        nodes.map((n) => [n.id, structuredClone(n.configuration)])
      );
      const inspectable = {
        nodes: () =>
          nodes.map((n) => ({
            descriptor: { id: n.id },
            configuration: () => nodeConfigs.get(n.id)!,
          })),
      };
      return [graphId, inspectable];
    })
  );

  const context = {
    graph: {
      nodes: [],
      edges: [],
      graphs: Object.fromEntries(
        Object.keys(graphNodes)
          .filter((k) => k !== "")
          .map((k) => [k, {}])
      ),
    },
    mutable: { graphs: graphEntries },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("RemoveAssetWithRefs", () => {
  it("marks asset refs as invalid and removes the asset", async () => {
    const { context, appliedEdits } = createMockContext({
      "": [
        {
          id: "node-1",
          configuration: configWith(
            `Use ${chip(assetChip("assets/my-file.txt"))}`
          ),
        },
      ],
    });

    const transform = new RemoveAssetWithRefs("assets/my-file.txt");
    const result = await transform.apply(context);

    assert.equal(result.success, true);

    // Should have at least:
    // 1. changeconfiguration to mark refs invalid
    // 2. removeasset
    const removeEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "removeasset")
    );
    assert.equal(removeEdits.length, 1);
    if (removeEdits[0].type === "removeasset") {
      assert.equal(removeEdits[0].path, "assets/my-file.txt");
    }
  });

  it("handles no refs across multiple graphs", async () => {
    const { context, appliedEdits } = createMockContext({
      "": [{ id: "node-1", configuration: configWith("no asset refs") }],
      "sub-1": [{ id: "node-2", configuration: configWith("also no refs") }],
    });

    const transform = new RemoveAssetWithRefs("assets/gone.txt");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // removeasset should still be emitted
    const removeEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "removeasset")
    );
    assert.equal(removeEdits.length, 1);
  });

  it("marks refs invalid in multiple graphs", async () => {
    const { context, appliedEdits } = createMockContext({
      "": [
        {
          id: "node-1",
          configuration: configWith(`${chip(assetChip("assets/shared.txt"))}`),
        },
      ],
      "sub-1": [
        {
          id: "node-2",
          configuration: configWith(`${chip(assetChip("assets/shared.txt"))}`),
        },
      ],
    });

    const transform = new RemoveAssetWithRefs("assets/shared.txt");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // changeconfiguration edits for both graphs' nodes
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 2);
  });

  it("handles graph with no subgraphs (graphs is undefined)", async () => {
    const appliedEdits: EditSpec[][] = [];
    const inspectable = {
      nodes: () => [
        {
          descriptor: { id: "n" },
          configuration: () => configWith("no chips"),
        },
      ],
    };
    const context = {
      graph: { nodes: [], edges: [] },
      mutable: { graphs: new Map([["", inspectable]]) },
      apply: mock.fn(
        async (edits: EditSpec[]): Promise<EditTransformResult> => {
          appliedEdits.push(edits);
          return { success: true };
        }
      ),
    } as unknown as EditOperationContext;

    const transform = new RemoveAssetWithRefs("assets/thing.txt");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const removeEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "removeasset")
    );
    assert.equal(removeEdits.length, 1);
  });

  it("does not mark non-matching asset refs", async () => {
    const { context, appliedEdits } = createMockContext({
      "": [
        {
          id: "node-1",
          configuration: configWith(`${chip(assetChip("assets/other.txt"))}`),
        },
      ],
    });

    const transform = new RemoveAssetWithRefs("assets/target.txt");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should NOT produce a changeconfiguration (only the removeasset)
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 0);
  });
});
