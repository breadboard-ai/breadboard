/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  TransformAllNodes,
  type EditTransformFactory,
} from "../../../src/ui/transforms/transform-all-nodes.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Serializes a TemplatePart into the `{{...}}` format used in templates. */
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
  nodes: { id: string; configuration: NodeConfiguration }[],
  graphId = "main"
) {
  const appliedEdits: EditSpec[][] = [];
  const nodeConfigs = new Map(
    nodes.map((n) => [n.id, structuredClone(n.configuration)])
  );

  const inspectable = {
    nodeById: (id: string) => {
      const config = nodeConfigs.get(id);
      if (!config) return null;
      return { descriptor: { id }, configuration: () => config };
    },
    nodes: () =>
      nodes.map((n) => ({
        descriptor: { id: n.id },
        configuration: () => nodeConfigs.get(n.id)!,
      })),
  };

  const graphs = new Map([[graphId, inspectable]]);

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      // Update nodeConfigs to reflect config changes (like real context does)
      for (const edit of edits) {
        if (edit.type === "changeconfiguration") {
          nodeConfigs.set(edit.id, edit.configuration);
        }
      }
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits, nodeConfigs };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("TransformAllNodes", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext([], "other-graph");

    const transform = new TransformAllNodes("missing", () => null, "test");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
  });

  it("iterates all nodes and transforms matching parts", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "node-a",
        configuration: configWith(`Hello ${chip(inChip("node-b"))}`),
      },
      { id: "node-b", configuration: configWith("No chips here") },
    ]);

    const transform = new TransformAllNodes(
      "main",
      (part) => {
        if (part.path === "node-b") {
          return { ...part, title: "Renamed" };
        }
        return null;
      },
      "Renaming refs"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Only node-a should have a configuration change
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 1);
    if (configEdits[0].type === "changeconfiguration") {
      assert.equal(configEdits[0].id, "node-a");
    }
  });

  it("skips specified nodes", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "skip-me",
        configuration: configWith(`${chip(inChip("x"))}`),
      },
      {
        id: "transform-me",
        configuration: configWith(`${chip(inChip("x"))}`),
      },
    ]);

    const transform = new TransformAllNodes(
      "main",
      (part) => ({ ...part, title: "changed" }),
      "skipping test",
      undefined,
      ["skip-me"]
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    // Only transform-me should be changed
    assert.equal(configEdits.length, 1);
    if (configEdits[0].type === "changeconfiguration") {
      assert.equal(configEdits[0].id, "transform-me");
    }
  });

  it("calls nodeTransformer for nodes with config changes", async () => {
    const nodeTransformerCalls: string[] = [];

    const { context } = createMockContext([
      {
        id: "node-a",
        configuration: configWith(`${chip(inChip("x"))}`),
      },
    ]);

    const nodeTransformer: EditTransformFactory = (id) => {
      nodeTransformerCalls.push(id);
      return {
        apply: async () => ({ success: true }),
      };
    };

    const transform = new TransformAllNodes(
      "main",
      (part) => ({ ...part, title: "changed" }),
      "with node transformer",
      nodeTransformer
    );
    await transform.apply(context);

    assert.deepEqual(nodeTransformerCalls, ["node-a"]);
  });

  it("does not call nodeTransformer when no config changes", async () => {
    const nodeTransformerCalls: string[] = [];

    const { context } = createMockContext([
      { id: "node-a", configuration: configWith("no chips") },
    ]);

    const nodeTransformer: EditTransformFactory = (id) => {
      nodeTransformerCalls.push(id);
      return { apply: async () => ({ success: true }) };
    };

    const transform = new TransformAllNodes(
      "main",
      () => null,
      "no changes",
      nodeTransformer
    );
    await transform.apply(context);

    assert.equal(nodeTransformerCalls.length, 0);
  });

  it("succeeds with zero nodes", async () => {
    const { context } = createMockContext([]);

    const transform = new TransformAllNodes("main", () => null, "empty graph");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
  });

  it("stops on first apply failure", async () => {
    let applyCount = 0;
    const nodes = [
      {
        id: "node-a",
        configuration: configWith(`${chip(inChip("x"))}`),
      },
      {
        id: "node-b",
        configuration: configWith(`${chip(inChip("x"))}`),
      },
    ];

    const inspectable = {
      nodes: () =>
        nodes.map((n) => ({
          descriptor: { id: n.id },
          configuration: () => n.configuration,
        })),
    };

    const context = {
      graph: { nodes: [], edges: [] },
      mutable: { graphs: new Map([["main", inspectable]]) },
      apply: mock.fn(async (): Promise<EditTransformResult> => {
        applyCount++;
        return { success: false, error: "fail" };
      }),
    } as unknown as EditOperationContext;

    const transform = new TransformAllNodes(
      "main",
      (part) => ({ ...part, title: "changed" }),
      "stop on fail"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    assert.equal(applyCount, 1, "should stop after first failure");
  });
});
