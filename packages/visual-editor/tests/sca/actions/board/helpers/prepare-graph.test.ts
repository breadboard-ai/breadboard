/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  validateSubGraphId,
  renameLegacyMainBoard,
  prepareGraph,
} from "../../../../../src/sca/actions/board/helpers/prepare-graph.js";
import type { GraphDescriptor } from "@breadboard-ai/types";

suite("prepare-graph helpers", () => {
  suite("validateSubGraphId", () => {
    test("returns null when no subGraphId", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      assert.strictEqual(validateSubGraphId(graph, null), null);
    });

    test("returns null when subGraphId does not exist", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: { other: { nodes: [], edges: [] } },
      };
      assert.strictEqual(validateSubGraphId(graph, "nonexistent"), null);
    });

    test("returns subGraphId when it exists", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: { myGraph: { nodes: [], edges: [] } },
      };
      assert.strictEqual(validateSubGraphId(graph, "myGraph"), "myGraph");
    });
  });

  suite("renameLegacyMainBoard", () => {
    test("does nothing when no Main board subgraph", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: { other: { nodes: [], edges: [] } },
      };
      renameLegacyMainBoard(graph);
      assert.ok(!("Main board" in (graph.graphs ?? {})));
      assert.ok("other" in (graph.graphs ?? {}));
    });

    test("renames Main board to random UUID", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: {
          "Main board": { nodes: [], edges: [] },
          other: { nodes: [], edges: [] },
        },
      };
      renameLegacyMainBoard(graph);
      assert.ok(!("Main board" in (graph.graphs ?? {})));
      // Should have 2 entries still - renamed one and other
      assert.strictEqual(Object.keys(graph.graphs ?? {}).length, 2);
      assert.ok("other" in (graph.graphs ?? {}));
    });
  });

  suite("prepareGraph", () => {
    test("resolves valid subgraph ID", async () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: { myGraph: { nodes: [], edges: [] } },
      };

      const result = await prepareGraph(graph, {
        subGraphId: "myGraph",
      });

      assert.strictEqual(result.subGraphId, "myGraph");
      assert.strictEqual(result.graph, graph);
    });

    test("returns null for invalid subgraph ID", async () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };

      const result = await prepareGraph(graph, {
        subGraphId: "nonexistent",
      });

      assert.strictEqual(result.subGraphId, null);
    });

    test("renames legacy Main board during preparation", async () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
        graphs: { "Main board": { nodes: [], edges: [] } },
      };

      await prepareGraph(graph);

      assert.ok(!("Main board" in (graph.graphs ?? {})));
      assert.strictEqual(Object.keys(graph.graphs ?? {}).length, 1);
    });

    test("works with no options", async () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };

      const result = await prepareGraph(graph);

      assert.strictEqual(result.graph, graph);
      assert.strictEqual(result.subGraphId, null);
    });
  });
});
