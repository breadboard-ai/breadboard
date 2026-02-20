/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateAssetWithRefs } from "../../../src/ui/transforms/update-asset-with-refs.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

const assetChip = (path: string, title: string): TemplatePart => ({
  type: "asset",
  path,
  title,
});

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

function createMockContext(
  nodes: { id: string; configuration: NodeConfiguration }[]
) {
  const appliedEdits: EditSpec[][] = [];

  const inspectable = {
    nodes: () =>
      nodes.map((n) => ({
        descriptor: { id: n.id },
        configuration: () => n.configuration,
      })),
  };

  const graphs = new Map([["", inspectable]]);

  const context = {
    graph: { nodes: [], edges: [], graphs: {} },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

describe("UpdateAssetWithRefs", () => {
  it("updates refs and changes metadata", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "node-1",
        configuration: configWith(
          `${chip(assetChip("assets/img.png", "Old"))}`
        ),
      },
    ]);

    const transform = new UpdateAssetWithRefs("assets/img.png", {
      title: "New Title",
      type: "content",
    });
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have both changeconfiguration (from UpdateAssetRefs) and changeassetmetadata
    const allEdits = appliedEdits.flat();
    const configEdits = allEdits.filter(
      (e) => e.type === "changeconfiguration"
    );
    const metadataEdits = allEdits.filter(
      (e) => e.type === "changeassetmetadata"
    );
    assert.ok(configEdits.length >= 1, "should update node configs");
    assert.ok(metadataEdits.length >= 1, "should change asset metadata");
  });

  it("stops if ref update fails", async () => {
    const context = {
      graph: { nodes: [], edges: [], graphs: {} },
      mutable: { graphs: new Map() }, // Empty — will fail
      apply: mock.fn(async () => ({ success: true })),
    } as unknown as EditOperationContext;

    const transform = new UpdateAssetWithRefs("assets/img.png", {
      title: "Title",
      type: "content",
    });
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("updates metadata when no refs match", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "node-1",
        configuration: configWith("no asset refs"),
      },
    ]);

    const transform = new UpdateAssetWithRefs("assets/img.png", {
      title: "Title",
      type: "content",
    });
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const metadataEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeassetmetadata");
    assert.ok(metadataEdits.length >= 1);
  });
});
