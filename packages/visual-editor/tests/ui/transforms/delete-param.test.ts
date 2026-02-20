/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { DeleteParam } from "../../../src/ui/transforms/delete-param.js";
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

describe("DeleteParam", () => {
  it("returns success immediately for subgraph params", async () => {
    const { context, appliedEdits } = createMockContext();

    const transform = new DeleteParam("sub-graph-1", "my-param");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 0);
  });

  it("deletes a parameter from graph metadata", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: {
        parameters: {
          "keep-me": { title: "Keep", usedIn: [] },
          "delete-me": { title: "Delete", usedIn: [] },
        },
      },
    });

    const transform = new DeleteParam("", "delete-me");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<string, unknown>;
      assert.ok(!params["delete-me"], "deleted param should be gone");
      assert.ok(params["keep-me"], "other param should be preserved");
    }
  });

  it("handles deleting from empty parameters gracefully", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: { parameters: {} },
    });

    const transform = new DeleteParam("", "nonexistent");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
  });

  it("fails if main graph is not inspectable", async () => {
    const context = {
      graph: { nodes: [], edges: [] },
      mutable: { graphs: new Map() },
      apply: mock.fn(async () => ({ success: true })),
    } as unknown as EditOperationContext;

    const transform = new DeleteParam("", "my-param");
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

    const transform = new DeleteParam("", "param");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("handles missing metadata gracefully", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: undefined as unknown as Record<string, unknown>,
    });

    const transform = new DeleteParam("", "my-param");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
  });
});
