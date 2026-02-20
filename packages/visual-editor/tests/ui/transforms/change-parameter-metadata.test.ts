/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ChangeParameterMetadata } from "../../../src/ui/transforms/change-parameter-metadata.js";
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

const paramChip = (path: string, title: string): TemplatePart => ({
  type: "param",
  path,
  title,
});

function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

function createMockContext(opts: {
  graphId?: string;
  metadata?: Record<string, unknown>;
  nodes?: { id: string; configuration: NodeConfiguration }[];
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "";
  const nodeConfigs = new Map(
    (opts.nodes ?? []).map((n) => [n.id, structuredClone(n.configuration)])
  );

  const inspectable = {
    metadata: () => opts.metadata ?? {},
    nodes: () =>
      (opts.nodes ?? []).map((n) => ({
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
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ChangeParameterMetadata", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext({ graphId: "other" });

    const transform = new ChangeParameterMetadata(
      "my-param",
      { title: "New Title", usedIn: [] },
      "missing"
    );
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
  });

  it("fails if no parameter metadata exists", async () => {
    const { context } = createMockContext({
      metadata: {},
    });

    const transform = new ChangeParameterMetadata(
      "my-param",
      { title: "New Title", usedIn: [] },
      ""
    );
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("No parameter metadata"));
    }
  });

  it("fails if specified parameter does not exist", async () => {
    const { context } = createMockContext({
      metadata: {
        parameters: { "other-param": { title: "Other", usedIn: [] } },
      },
    });

    const transform = new ChangeParameterMetadata(
      "missing-param",
      { title: "New Title", usedIn: [] },
      ""
    );
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-param"));
    }
  });

  it("updates parameter metadata and preserves usedIn", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: {
        parameters: {
          "my-param": { title: "Old Title", usedIn: ["node-1"] },
        },
      },
    });

    const transform = new ChangeParameterMetadata(
      "my-param",
      { title: "New Title", description: "A desc", usedIn: [] },
      ""
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have at least a changegraphmetadata edit
    const metadataEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changegraphmetadata")
    );
    assert.ok(metadataEdits.length >= 1);
    if (metadataEdits[0].type === "changegraphmetadata") {
      const params = metadataEdits[0].metadata?.parameters as Record<
        string,
        { title: string; usedIn: string[] }
      >;
      assert.equal(params["my-param"].title, "New Title");
      // usedIn should come from the existing param, not the input
      assert.deepEqual(params["my-param"].usedIn, ["node-1"]);
    }
  });

  it("updates param titles in node configurations", async () => {
    const { context, appliedEdits } = createMockContext({
      metadata: {
        parameters: {
          "my-param": { title: "Old", usedIn: ["node-1"] },
        },
      },
      nodes: [
        {
          id: "node-1",
          configuration: configWith(
            `Use ${chip(paramChip("my-param", "Old"))}`
          ),
        },
      ],
    });

    const transform = new ChangeParameterMetadata(
      "my-param",
      { title: "Renamed Param", usedIn: [] },
      ""
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have a changeconfiguration edit for the node
    const configEdits = appliedEdits.flatMap((batch) =>
      batch.filter((e) => e.type === "changeconfiguration")
    );
    assert.ok(configEdits.length >= 1);
    if (configEdits[0].type === "changeconfiguration") {
      assert.equal(configEdits[0].id, "node-1");
      const prompt = configEdits[0].configuration.prompt as {
        parts: { text: string }[];
      };
      assert.ok(
        prompt.parts[0].text.includes("Renamed Param"),
        "title should be updated in the config"
      );
    }
  });
});
