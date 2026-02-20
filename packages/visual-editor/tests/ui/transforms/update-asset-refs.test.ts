/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateAssetRefs } from "../../../src/ui/transforms/update-asset-refs.js";
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

describe("UpdateAssetRefs", () => {
  it("updates asset title in node configs when path matches", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "node-1",
        configuration: configWith(
          `Use ${chip(assetChip("assets/img.png", "Old Title"))}`
        ),
      },
    ]);

    const transform = new UpdateAssetRefs("assets/img.png", "New Title");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1);
    if (configEdits[0].type === "changeconfiguration") {
      const prompt = configEdits[0].configuration.prompt as {
        parts: { text: string }[];
      };
      assert.ok(prompt.parts[0].text.includes("New Title"));
    }
  });

  it("does not change configs when path does not match", async () => {
    const { context, appliedEdits } = createMockContext([
      {
        id: "node-1",
        configuration: configWith(
          `Use ${chip(assetChip("assets/other.png", "Other"))}`
        ),
      },
    ]);

    const transform = new UpdateAssetRefs("assets/img.png", "New Title");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.equal(configEdits.length, 0);
  });

  it("handles empty graph", async () => {
    const { context } = createMockContext([]);

    const transform = new UpdateAssetRefs("assets/img.png", "Title");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
  });
});
