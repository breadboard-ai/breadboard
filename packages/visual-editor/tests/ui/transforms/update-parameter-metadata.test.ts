/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateParameterMetadata } from "../../../src/ui/transforms/update-parameter-metadata.js";
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
  nodes?: { id: string; configuration: NodeConfiguration }[];
  metadata?: Record<string, unknown>;
}) {
  const appliedEdits: EditSpec[][] = [];

  const inspectable = {
    nodes: () =>
      (opts.nodes ?? []).map((n) => ({
        descriptor: { id: n.id },
        configuration: () => n.configuration,
      })),
    metadata: () => opts.metadata ?? {},
  };

  const graphs = new Map([["", inspectable]]);

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

describe("UpdateParameterMetadata", () => {
  it("returns success immediately for subgraph", async () => {
    const { context, appliedEdits } = createMockContext({});

    const transform = new UpdateParameterMetadata("sub-graph");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 0);
  });

  it("fails if main graph is not found", async () => {
    const context = {
      graph: { nodes: [], edges: [] },
      mutable: { graphs: new Map() },
      apply: mock.fn(async () => ({ success: true })),
    } as unknown as EditOperationContext;

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("discovers params from node configurations and creates metadata", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          configuration: configWith(
            `Use ${chip(paramChip("api-key", "API Key"))}`
          ),
        },
      ],
      metadata: {},
    });

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    assert.equal(appliedEdits.length, 1);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { title: string; usedIn: string[] }
      >;
      assert.ok(params["api-key"]);
      assert.equal(params["api-key"].title, "API Key");
      assert.deepEqual(params["api-key"].usedIn, ["node-1"]);
    }
  });

  it("preserves existing param metadata and updates usedIn", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          configuration: configWith(`${chip(paramChip("api-key", "API Key"))}`),
        },
      ],
      metadata: {
        parameters: {
          "api-key": {
            title: "Custom Title",
            description: "Custom desc",
            usedIn: ["old-node"],
          },
        },
      },
    });

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { title: string; description?: string; usedIn: string[] }
      >;
      // Should preserve existing title and description
      assert.equal(params["api-key"].title, "Custom Title");
      assert.equal(params["api-key"].description, "Custom desc");
      // usedIn should be updated to current usage
      assert.deepEqual(params["api-key"].usedIn, ["node-1"]);
    }
  });

  it("marks unused params with empty usedIn", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", configuration: configWith("no params") }],
      metadata: {
        parameters: {
          "old-param": { title: "Old", usedIn: ["node-1"] },
        },
      },
    });

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { usedIn: string[] }
      >;
      assert.deepEqual(
        params["old-param"].usedIn,
        [],
        "unused param should have empty usedIn"
      );
    }
  });

  it("tracks multiple nodes using the same param", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          configuration: configWith(`${chip(paramChip("key", "Key"))}`),
        },
        {
          id: "node-2",
          configuration: configWith(`${chip(paramChip("key", "Key"))}`),
        },
      ],
      metadata: {},
    });

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<
        string,
        { usedIn: string[] }
      >;
      assert.deepEqual(params["key"].usedIn, ["node-1", "node-2"]);
    }
  });

  it("handles empty graph with no nodes", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [],
      metadata: {},
    });

    const transform = new UpdateParameterMetadata("");
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edit = appliedEdits[0][0];
    if (edit.type === "changegraphmetadata") {
      const params = edit.metadata?.parameters as Record<string, unknown>;
      assert.deepEqual(Object.keys(params), []);
    }
  });
});
