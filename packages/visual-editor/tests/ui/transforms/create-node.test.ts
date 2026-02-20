/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CreateNode } from "../../../src/ui/transforms/create-node.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
} from "@breadboard-ai/types";

function createMockContext(opts: {
  graphId?: string;
  metadata?: Record<string, unknown>;
  typeMetadata?: { title?: string; example?: NodeConfiguration } | null;
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "main";

  const inspectableGraph = {
    metadata: () => opts.metadata ?? {},
    typeById: () => {
      if (opts.typeMetadata === null) return null;
      return {
        metadata: async () => opts.typeMetadata ?? { title: "Default Title" },
      };
    },
  };

  const graphs = new Map([[graphId, inspectableGraph]]);

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

describe("CreateNode", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext({ graphId: "other" });

    const transform = new CreateNode(
      "node-1",
      "missing-graph",
      "my-type",
      null,
      null,
      null
    );
    const result = await transform.apply(context);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-graph"));
    }
  });

  describe("comment nodes", () => {
    it("creates a comment via changegraphmetadata", async () => {
      const { context, appliedEdits } = createMockContext({
        metadata: { comments: [] },
      });

      const transform = new CreateNode(
        "comment-1",
        "main",
        "comment",
        null,
        { visual: { x: 10, y: 20 } },
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      assert.equal(appliedEdits.length, 1);
      const edit = appliedEdits[0][0];
      assert.equal(edit.type, "changegraphmetadata");
    });

    it("fails when no metadata is supplied for comment", async () => {
      const { context } = createMockContext({});

      const transform = new CreateNode(
        "comment-1",
        "main",
        "comment",
        null,
        null,
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("metadata"));
      }
    });
  });

  describe("regular nodes", () => {
    it("creates a node with title from type metadata", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: { title: "Generate Text" },
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "gen-text",
        null,
        null,
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const edit = appliedEdits[0][0];
      assert.equal(edit.type, "addnode");
      if (edit.type === "addnode") {
        assert.equal(edit.node.metadata?.title, "Generate Text");
      }
    });

    it("fails when type is unknown", async () => {
      const { context } = createMockContext({
        typeMetadata: null,
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "unknown-type",
        null,
        null,
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("unknown-type"));
      }
    });

    it("uses example configuration when no configuration is supplied", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: {
          title: "My Node",
          example: { prompt: "Hello" },
        },
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "my-type",
        null,
        null,
        null
      );
      await transform.apply(context);

      const edit = appliedEdits[0][0];
      if (edit.type === "addnode") {
        assert.deepEqual(edit.node.configuration, { prompt: "Hello" });
      }
    });

    it("uses supplied configuration over example", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: {
          title: "My Node",
          example: { prompt: "Default" },
        },
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "my-type",
        { prompt: "Custom" },
        null,
        null
      );
      await transform.apply(context);

      const edit = appliedEdits[0][0];
      if (edit.type === "addnode") {
        assert.deepEqual(edit.node.configuration, { prompt: "Custom" });
      }
    });

    it("adds an edge when options are provided", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: { title: "My Node" },
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "my-type",
        null,
        null,
        { sourceId: "source-node", portId: "output" }
      );
      await transform.apply(context);

      const edits = appliedEdits[0];
      assert.equal(edits.length, 2);
      assert.equal(edits[0].type, "addnode");
      assert.equal(edits[1].type, "addedge");
      if (edits[1].type === "addedge") {
        assert.equal(edits[1].edge.from, "source-node");
        assert.equal(edits[1].edge.to, "node-1");
        assert.equal(edits[1].edge.out, "output");
        assert.equal(edits[1].edge.in, "output");
      }
    });

    it("creates node without title when type has no title", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: {},
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "my-type",
        null,
        null,
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const edit = appliedEdits[0][0];
      if (edit.type === "addnode") {
        // No title should be set since type has no title
        assert.equal(edit.node.metadata, undefined);
      }
    });

    it("initializes comments array when creating first comment", async () => {
      // metadata with no comments array yet
      const { context, appliedEdits } = createMockContext({
        metadata: {},
      });

      const transform = new CreateNode(
        "comment-1",
        "main",
        "comment",
        null,
        { visual: { x: 0, y: 0 } },
        null
      );
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const edit = appliedEdits[0][0];
      if (edit.type === "changegraphmetadata") {
        assert.ok(
          Array.isArray(edit.metadata?.comments),
          "comments should be an array"
        );
      }
    });

    it("creates node without metadata when both metadata and title are absent", async () => {
      const { context, appliedEdits } = createMockContext({
        typeMetadata: {},
      });

      const transform = new CreateNode(
        "node-1",
        "main",
        "my-type",
        { key: "value" },
        null,
        null
      );
      await transform.apply(context);

      const edit = appliedEdits[0][0];
      if (edit.type === "addnode") {
        assert.deepEqual(edit.node.configuration, { key: "value" });
      }
    });
  });
});
