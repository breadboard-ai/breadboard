/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { GENERATE_COMPONENT_URL } from "../../../../src/a2/agent/graph-editing/constants.js";
import { describe, it } from "node:test";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { HeadlessGraphEditor } from "../../../../eval/headless-graph-editor.js";
import { GraphEditingManager } from "../../../../src/a2/agent/graph-editing/graph-editing-manager.js";

describe("GraphEditingManager", () => {
  it("executes addnode and addedge edit specs perfectly", async () => {
    const graph: GraphDescriptor = {
      nodes: [],
      edges: [],
    };

    const editor = HeadlessGraphEditor.create(graph);
    const manager = new GraphEditingManager(editor);

    const result = await manager.applyEdits({
      edits: [
        {
          type: "addnode",
          graphId: "",
          node: {
            id: "node-1",
            type: GENERATE_COMPONENT_URL,
          },
        },
        {
          type: "addnode",
          graphId: "",
          node: {
            id: "node-2",
            type: GENERATE_COMPONENT_URL,
          },
        },
      ],
      label: "Add steps",
    });

    if (!result.success) {
      console.log("MUTATION ERROR:", result.error);
    }
    assert.strictEqual(result.success, true);
    assert.strictEqual(editor.raw().nodes?.length, 2);

    const edgeResult = await manager.applyEdits({
      edits: [
        {
          type: "addedge",
          graphId: "",
          edge: {
            from: "node-1",
            to: "node-2",
            out: "text",
            in: "p-z-node-1",
          },
        },
      ],
      label: "Wire steps",
    });

    assert.strictEqual(edgeResult.success, true);
    assert.strictEqual(editor.raw().edges?.length, 1);
    assert.strictEqual(editor.raw().edges?.[0].from, "node-1");
  });
});
