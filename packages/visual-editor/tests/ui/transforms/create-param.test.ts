/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CreateParam } from "../../../src/ui/transforms/create-param.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types";

function createMockContext(opts?: { metadata?: Record<string, unknown> }) {
  const appliedEdits: EditSpec[][] = [];

  const inspectableGraph = {
    metadata: () => opts?.metadata ?? {},
  };

  // CreateParam operates on the main graph (graphId = "")
  const graphs = new Map([["", inspectableGraph]]);

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

describe("CreateParam", () => {
  it("returns success immediately for subgraph params", async () => {
    const { context, appliedEdits } = createMockContext();

    const transform = new CreateParam("sub-graph-1", "my-param", "My Param");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 0, "No edits should be applied");
  });

  it("creates parameter metadata in main graph", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: { parameters: {} },
    });

    const transform = new CreateParam("", "my-param", "My Param");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    assert.equal(edit.type, "changegraphmetadata");
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { title: string; usedIn: string[] }
      >;
      assert.ok(params["my-param"]);
      assert.equal(params["my-param"].title, "My Param");
      assert.deepEqual(params["my-param"].usedIn, []);
    }
  });

  it("includes description when provided", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: { parameters: {} },
    });

    const transform = new CreateParam(
      "",
      "my-param",
      "My Param",
      "A nice parameter"
    );
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { title: string; description?: string }
      >;
      assert.equal(params["my-param"].description, "A nice parameter");
    }
  });

  it("creates parameters map when none exists", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: {},
    });

    const transform = new CreateParam("", "new-param", "New Param");
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<string, unknown>;
      assert.ok(params);
      assert.ok(params["new-param"]);
    }
  });

  it("fails if main graph is not inspectable", async () => {
    const context = {
      graph: { nodes: [], edges: [] },
      mutable: { graphs: new Map() },
      apply: mock.fn(async () => ({ success: true })),
    } as unknown as EditOperationContext;

    const transform = new CreateParam("", "my-param", "My Param");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("inspect"));
    }
  });

  it("propagates apply failure", async () => {
    const context = {
      graph: { nodes: [], edges: [] },
      mutable: {
        graphs: new Map([["", { metadata: () => ({}) }]]),
      },
      apply: mock.fn(async () => ({
        success: false,
        error: "apply failed",
      })),
    } as unknown as EditOperationContext;

    const transform = new CreateParam("", "param", "Param");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });
});
