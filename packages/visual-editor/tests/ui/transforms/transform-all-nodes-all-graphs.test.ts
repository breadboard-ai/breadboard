/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TransformAllNodesAllGraphs } from "../../../src/ui/transforms/transform-all-nodes-all-graphs.js";
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

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

const inChip = (path: string): TemplatePart => ({
  type: "in",
  path,
  title: `@${path}`,
});

function createMockContext(
  graphNodes: Record<string, { id: string; configuration: NodeConfiguration }[]>
) {
  const appliedEdits: EditSpec[][] = [];

  const graphEntries = new Map(
    Object.entries(graphNodes).map(([graphId, nodes]) => {
      const inspectable = {
        nodes: () =>
          nodes.map((n) => ({
            descriptor: { id: n.id },
            configuration: () => n.configuration,
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

describe("TransformAllNodesAllGraphs", () => {
  it("iterates all graphs including main", async () => {
    const { context, appliedEdits } = createMockContext({
      "": [
        {
          id: "main-node",
          configuration: configWith(`${chip(inChip("x"))}`),
        },
      ],
      "sub-1": [
        {
          id: "sub-node",
          configuration: configWith(`${chip(inChip("x"))}`),
        },
      ],
    });

    const transform = new TransformAllNodesAllGraphs(
      (part) => ({ ...part, title: "changed" }),
      "all graphs test"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Both graphs should have config changes applied
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 2);
  });

  it("succeeds with empty graphs", async () => {
    const { context } = createMockContext({
      "": [],
    });

    const transform = new TransformAllNodesAllGraphs(() => null, "empty test");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
  });

  it("stops on first graph failure", async () => {
    // Create a context where the main graph lookup will fail
    // (TransformAllNodes will return an error when graph is not in mutable.graphs)
    const context = {
      graph: {
        nodes: [],
        edges: [],
        graphs: { "sub-1": {} },
      },
      mutable: { graphs: new Map() }, // Empty map — no graph will be found
      apply: mock.fn(async () => ({ success: true })),
    } as unknown as EditOperationContext;

    const transform = new TransformAllNodesAllGraphs(() => null, "fail test");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });
});
