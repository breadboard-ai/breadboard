/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { MarkInPortsInvalid } from "../../../src/ui/transforms/mark-in-ports-invalid.js";
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

const inChip = (path: string): TemplatePart => ({
  type: "in",
  path,
  title: `@${path}`,
});

const routeChip = (instance: string): TemplatePart => ({
  type: "tool",
  path: "control-flow/routing",
  instance,
  title: "Target",
});

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("MarkInPortsInvalid", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext([], "other");

    const transform = new MarkInPortsInvalid("missing", "from", "to");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
  });

  it("fails if 'to' node is not found", async () => {
    const { context } = createMockContext([
      { id: "from-node", configuration: {} },
    ]);

    const transform = new MarkInPortsInvalid("main", "from-node", "missing-to");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-to"));
    }
  });

  it("fails if 'from' node is not found", async () => {
    const { context } = createMockContext([
      { id: "to-node", configuration: {} },
    ]);

    const transform = new MarkInPortsInvalid("main", "missing-from", "to-node");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-from"));
    }
  });

  it("marks @-reference as invalid in 'to' node config", async () => {
    const { context, appliedEdits } = createMockContext([
      { id: "from-node", configuration: configWith("no refs") },
      {
        id: "to-node",
        configuration: configWith(`Use ${chip(inChip("from-node"))}`),
      },
    ]);

    const transform = new MarkInPortsInvalid("main", "from-node", "to-node");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const allEdits = appliedEdits.flat();
    const configEdits = allEdits.filter(
      (e) => e.type === "changeconfiguration"
    );
    // Should mark the "to" node's config with invalid flag
    const toEdit = configEdits.find(
      (e) => e.type === "changeconfiguration" && e.id === "to-node"
    );
    assert.ok(toEdit, "should have config change for to-node");
    if (toEdit?.type === "changeconfiguration") {
      const text = (
        toEdit.configuration.prompt as { parts: { text: string }[] }
      ).parts[0].text;
      assert.ok(text.includes('"invalid":true'));
    }
  });

  it("marks route chips as invalid in 'from' node config", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "from-node",
        configuration: configWith(`Route ${chip(routeChip("to-node"))}`),
      },
      { id: "to-node", configuration: configWith("no refs") },
    ]);

    const transform = new MarkInPortsInvalid("main", "from-node", "to-node");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const allEdits = appliedEdits.flat();
    const configEdits = allEdits.filter(
      (e) => e.type === "changeconfiguration"
    );
    const fromEdit = configEdits.find(
      (e) => e.type === "changeconfiguration" && e.id === "from-node"
    );
    assert.ok(fromEdit, "should have config change for from-node");
    if (fromEdit?.type === "changeconfiguration") {
      const text = (
        fromEdit.configuration.prompt as { parts: { text: string }[] }
      ).parts[0].text;
      assert.ok(text.includes('"invalid":true'));
    }
  });

  it("does nothing when no refs match", async () => {
    const { context, appliedEdits } = createMockContext([
      { id: "from-node", configuration: configWith("no refs") },
      { id: "to-node", configuration: configWith("also no refs") },
    ]);

    const transform = new MarkInPortsInvalid("main", "from-node", "to-node");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should only have 1 apply call with 0 edits
    assert.equal(appliedEdits.length, 1);
    assert.equal(appliedEdits[0].length, 0);
  });
});
