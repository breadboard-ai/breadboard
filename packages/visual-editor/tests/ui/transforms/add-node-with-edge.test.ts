/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { AddNodeWithEdge } from "../../../src/ui/transforms/add-node-with-edge.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types";

/**
 * Creates a minimal mock context that captures `apply` calls and also
 * stubs the nested `ChangeEdge` dependency (which calls `mutable.graphs`).
 */
function createMockContext() {
  const appliedEdits: { edits: EditSpec[]; label: string }[] = [];

  const inspectableGraph = {
    nodeById: (id: string) => ({
      descriptor: { id },
      routes: () => [],
      ports: async () => ({
        outputs: {
          ports: [{ name: "output", schema: { behavior: ["main-port"] } }],
        },
      }),
      incoming: () => [],
      currentPorts: () => ({
        inputs: { ports: [] },
      }),
      title: () => "Step",
      describe: async () => ({ inputSchema: {} }),
      configuration: () => ({}),
    }),
    raw: () => ({ nodes: [], edges: [] }),
  };

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs: new Map([["main", inspectableGraph]]) },
    apply: mock.fn(
      async (
        edits: EditSpec[],
        label: string
      ): Promise<EditTransformResult> => {
        appliedEdits.push({ edits, label });
        return { success: true };
      }
    ),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

describe("AddNodeWithEdge", () => {
  it("emits an addnode edit followed by edge creation", async () => {
    const { context, appliedEdits } = createMockContext();

    const node = {
      id: "node-1",
      type: "my-type",
      metadata: { title: "My Step" },
    };
    const edge = { from: "source", to: "node-1", out: "output", in: "input" };
    const transform = new AddNodeWithEdge(node, edge, "main");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // First apply: addnode
    assert.ok(appliedEdits.length >= 1);
    const addNodeEdits = appliedEdits[0].edits;
    assert.equal(addNodeEdits.length, 1);
    assert.equal(addNodeEdits[0].type, "addnode");
    if (addNodeEdits[0].type === "addnode") {
      assert.equal(addNodeEdits[0].node.id, "node-1");
    }
  });

  it("uses metadata title in the label when available", async () => {
    const { context, appliedEdits } = createMockContext();

    const node = {
      id: "node-2",
      type: "my-type",
      metadata: { title: "Generate Text" },
    };
    const edge = { from: "source", to: "node-2", out: "o", in: "i" };
    const transform = new AddNodeWithEdge(node, edge, "main");
    await transform.apply(context);

    assert.ok(appliedEdits[0].label.includes("Generate Text"));
  });

  it("falls back to 'Untitled step' when no title in metadata", async () => {
    const { context, appliedEdits } = createMockContext();

    const node = { id: "node-3", type: "my-type" };
    const edge = { from: "source", to: "node-3", out: "o", in: "i" };
    const transform = new AddNodeWithEdge(node, edge, "main");
    await transform.apply(context);

    assert.ok(appliedEdits[0].label.includes("Untitled step"));
  });
});
