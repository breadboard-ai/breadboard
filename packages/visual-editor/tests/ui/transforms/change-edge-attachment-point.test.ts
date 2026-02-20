/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ChangeEdgeAttachmentPoint } from "../../../src/ui/transforms/change-edge-attachment-point.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
} from "@breadboard-ai/types";

function createMockContext() {
  const appliedEdits: EditSpec[][] = [];
  const context = {
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;
  return { context, appliedEdits };
}

describe("ChangeEdgeAttachmentPoint", () => {
  it("sets 'from' attachment point on edge with no metadata", async () => {
    const { context, appliedEdits } = createMockContext();

    const edge = { from: "a", to: "b", out: "o", in: "i" };
    const transform = new ChangeEdgeAttachmentPoint(
      "main",
      edge,
      "from",
      "Top"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    assert.equal(edit.type, "changeedgemetadata");
    if (edit.type === "changeedgemetadata") {
      const visual = edit.metadata?.visual as Record<string, string>;
      assert.equal(visual.from, "Top");
    }
  });

  it("sets 'to' attachment point on edge with existing metadata", async () => {
    const { context, appliedEdits } = createMockContext();

    const edge = {
      from: "a",
      to: "b",
      out: "o",
      in: "i",
      metadata: { visual: { from: "Left" as const } },
    };
    const transform = new ChangeEdgeAttachmentPoint(
      "main",
      edge,
      "to",
      "Bottom"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edit = appliedEdits[0][0];
    if (edit.type === "changeedgemetadata") {
      const visual = edit.metadata?.visual as Record<string, string>;
      assert.equal(visual.to, "Bottom");
      assert.equal(visual.from, "Left");
    }
  });

  it("includes the correct graphId in the edit", async () => {
    const { context, appliedEdits } = createMockContext();

    const edge = { from: "a", to: "b", out: "o", in: "i" };
    const transform = new ChangeEdgeAttachmentPoint(
      "sub-graph",
      edge,
      "from",
      "Right"
    );
    await transform.apply(context);

    const edit = appliedEdits[0][0];
    if (edit.type === "changeedgemetadata") {
      assert.equal(edit.graphId, "sub-graph");
    }
  });

  it("produces correct label text", async () => {
    const appliedLabels: string[] = [];
    const context = {
      apply: mock.fn(async (_edits: EditSpec[], label: string) => {
        appliedLabels.push(label);
        return { success: true };
      }),
    } as unknown as EditOperationContext;

    const edge = { from: "a", to: "b", out: "o", in: "i" };
    const transform = new ChangeEdgeAttachmentPoint("main", edge, "to", "Auto");
    await transform.apply(context);

    assert.ok(appliedLabels[0].includes("to"));
    assert.ok(appliedLabels[0].includes("Auto"));
  });
});
