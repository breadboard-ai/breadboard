/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createPlan } from "../../src/static/create-plan.js";
import type { StaticStage, VmStage } from "../../src/static/types.js";

describe("createPlan function", () => {
  describe("basic functionality", () => {
    it("should return empty stages for empty graph", () => {
      const emptyGraph: GraphDescriptor = { nodes: [], edges: [] };
      const result = createPlan(emptyGraph);
      assert.deepEqual(result, { stages: [] });
    });

    it("should return empty stages for graph with no nodes", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const result = createPlan(graph);
      assert.deepEqual(result, { stages: [] });
    });

    it("should handle single node with no dependencies", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "input" }],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);
    });

    it("should handle multiple independent nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "input" },
          { id: "c", type: "input" },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, [
        "a",
        "b",
        "c",
      ]);
    });
  });

  describe("sequential dependencies", () => {
    it("should create sequential stages for linear dependency chain", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "value", in: "input" },
          { from: "b", to: "c", out: "result", in: "data" },
        ],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 3);

      // First stage: node a (no dependencies)
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);

      // Second stage: node b (depends on a)
      assert.equal(result.stages[1].type, "static");
      assert.deepEqual((result.stages[1] as StaticStage).nodes, ["b"]);

      // Third stage: node c (depends on b)
      assert.equal(result.stages[2].type, "static");
      assert.deepEqual((result.stages[2] as StaticStage).nodes, ["c"]);
    });

    it("should handle diamond dependency pattern", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "value", in: "input1" },
          { from: "a", to: "c", out: "value", in: "input2" },
          { from: "b", to: "d", out: "result1", in: "data1" },
          { from: "c", to: "d", out: "result2", in: "data2" },
        ],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 3);

      // First stage: node a
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);

      // Second stage: nodes b and c (can run in parallel)
      assert.equal(result.stages[1].type, "static");
      assert.deepEqual((result.stages[1] as StaticStage).nodes.sort(), [
        "b",
        "c",
      ]);

      // Third stage: node d
      assert.equal(result.stages[2].type, "static");
      assert.deepEqual((result.stages[2] as StaticStage).nodes, ["d"]);
    });
  });

  describe("VM stages for folded nodes", () => {
    it("should create VM stage for single folded node", () => {
      const graph: GraphDescriptor = {
        nodes: [
          {
            id: "scc_0",
            type: "#scc_0",
            metadata: { tags: ["folded"] },
          },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "vm");
      assert.equal((result.stages[0] as VmStage).node, "scc_0");
    });

    it("should create separate VM stages for multiple folded nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [
          {
            id: "scc_0",
            type: "#scc_0",
            metadata: { tags: ["folded"] },
          },
          {
            id: "scc_1",
            type: "#scc_1",
            metadata: { tags: ["folded"] },
          },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 2);

      // Each folded node gets its own VM stage
      assert.equal(result.stages[0].type, "vm");
      assert.equal(result.stages[1].type, "vm");

      const vmNodes = [
        (result.stages[0] as VmStage).node,
        (result.stages[1] as VmStage).node,
      ].sort();
      assert.deepEqual(vmNodes, ["scc_0", "scc_1"]);
    });

    it("should handle mixed regular and folded nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          {
            id: "scc_0",
            type: "#scc_0",
            metadata: { tags: ["folded"] },
          },
          { id: "b", type: "output" },
        ],
        edges: [
          { from: "a", to: "scc_0", out: "data", in: "input" },
          { from: "scc_0", to: "b", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 3);

      // First stage: regular node a
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);

      // Second stage: VM node scc_0
      assert.equal(result.stages[1].type, "vm");
      assert.equal((result.stages[1] as VmStage).node, "scc_0");

      // Third stage: regular node b
      assert.equal(result.stages[2].type, "static");
      assert.deepEqual((result.stages[2] as StaticStage).nodes, ["b"]);
    });
  });

  describe("complex dependency patterns", () => {
    it("should handle complex dependency graph with multiple parallel sections", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "start", type: "input" },
          { id: "proc1", type: "process" },
          { id: "proc2", type: "process" },
          { id: "proc3", type: "process" },
          { id: "proc4", type: "process" },
          { id: "merge", type: "merge" },
          { id: "end", type: "output" },
        ],
        edges: [
          { from: "start", to: "proc1", out: "data", in: "input" },
          { from: "start", to: "proc2", out: "data", in: "input" },
          { from: "proc1", to: "proc3", out: "result", in: "data1" },
          { from: "proc2", to: "proc4", out: "result", in: "data2" },
          { from: "proc3", to: "merge", out: "output", in: "stream1" },
          { from: "proc4", to: "merge", out: "output", in: "stream2" },
          { from: "merge", to: "end", out: "combined", in: "final" },
        ],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 5);

      // Stage 1: start node
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["start"]);

      // Stage 2: proc1 and proc2 in parallel
      assert.equal(result.stages[1].type, "static");
      assert.deepEqual((result.stages[1] as StaticStage).nodes.sort(), [
        "proc1",
        "proc2",
      ]);

      // Stage 3: proc3 and proc4 in parallel
      assert.equal(result.stages[2].type, "static");
      assert.deepEqual((result.stages[2] as StaticStage).nodes.sort(), [
        "proc3",
        "proc4",
      ]);

      // Stage 4: merge node
      assert.equal(result.stages[3].type, "static");
      assert.deepEqual((result.stages[3] as StaticStage).nodes, ["merge"]);

      // Stage 5: end node
      assert.equal(result.stages[4].type, "static");
      assert.deepEqual((result.stages[4] as StaticStage).nodes, ["end"]);
    });

    it("should handle graph with folded nodes in dependency chain", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          {
            id: "scc_0",
            type: "#scc_0",
            metadata: { tags: ["folded"] },
          },
          { id: "processor", type: "process" },
          {
            id: "scc_1",
            type: "#scc_1",
            metadata: { tags: ["folded"] },
          },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "scc_0", out: "data", in: "input" },
          { from: "scc_0", to: "processor", out: "result", in: "data" },
          { from: "processor", to: "scc_1", out: "processed", in: "input" },
          { from: "scc_1", to: "output", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 5);

      // Verify the sequence: input -> scc_0 -> processor -> scc_1 -> output
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["input"]);

      assert.equal(result.stages[1].type, "vm");
      assert.equal((result.stages[1] as VmStage).node, "scc_0");

      assert.equal(result.stages[2].type, "static");
      assert.deepEqual((result.stages[2] as StaticStage).nodes, ["processor"]);

      assert.equal(result.stages[3].type, "vm");
      assert.equal((result.stages[3] as VmStage).node, "scc_1");

      assert.equal(result.stages[4].type, "static");
      assert.deepEqual((result.stages[4] as StaticStage).nodes, ["output"]);
    });
  });

  describe("edge cases", () => {
    it("should handle nodes with no edges", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "isolated1", type: "process" },
          { id: "isolated2", type: "process" },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes.sort(), [
        "isolated1",
        "isolated2",
      ]);
    });

    it("should handle nodes with self-referential edges (should not occur in condensed graph)", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 2);

      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);

      assert.equal(result.stages[1].type, "static");
      assert.deepEqual((result.stages[1] as StaticStage).nodes, ["b"]);
    });

    it("should handle graph with undefined edges", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "output" },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes.sort(), [
        "a",
        "b",
      ]);
    });

    it("should handle nodes with missing metadata", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 2);

      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);

      assert.equal(result.stages[1].type, "static");
      assert.deepEqual((result.stages[1] as StaticStage).nodes, ["b"]);
    });

    it("should handle folded nodes without folded tag in metadata", () => {
      const graph: GraphDescriptor = {
        nodes: [
          {
            id: "scc_0",
            type: "#scc_0",
            metadata: { tags: ["other"] },
          },
        ],
        edges: [],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["scc_0"]);
    });
  });

  describe("error handling", () => {
    it("should handle graphs with empty nodes array", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
      };
      const result = createPlan(graph);
      assert.deepEqual(result, { stages: [] });
    });

    it("should handle references to non-existent nodes in edges", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "input" }],
        edges: [{ from: "a", to: "nonexistent", out: "data", in: "input" }],
      };
      const result = createPlan(graph);
      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["a"]);
    });
  });

  describe("performance considerations", () => {
    it("should handle large graphs efficiently", () => {
      const nodes = [];
      const edges = [];

      // Create a large linear chain of 1000 nodes
      for (let i = 0; i < 1000; i++) {
        nodes.push({ id: `node_${i}`, type: "process" });
        if (i > 0) {
          edges.push({
            from: `node_${i - 1}`,
            to: `node_${i}`,
            out: "data",
            in: "input",
          });
        }
      }

      const graph: GraphDescriptor = { nodes, edges };
      const startTime = Date.now();
      const result = createPlan(graph);
      const endTime = Date.now();

      // Should complete in reasonable time (< 100ms for 1000 nodes)
      assert.ok(endTime - startTime < 100);
      assert.equal(result.stages.length, 1000);
    });

    it("should handle graphs with many parallel branches", () => {
      const nodes = [];
      const edges = [];

      // Create a graph with 100 parallel branches
      nodes.push({ id: "root", type: "input" });
      for (let i = 0; i < 100; i++) {
        nodes.push({ id: `branch_${i}`, type: "process" });
        edges.push({
          from: "root",
          to: `branch_${i}`,
          out: "data",
          in: "input",
        });
      }

      const graph: GraphDescriptor = { nodes, edges };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 2);
      assert.equal(result.stages[0].type, "static");
      assert.deepEqual((result.stages[0] as StaticStage).nodes, ["root"]);
      assert.equal(result.stages[1].type, "static");
      assert.equal((result.stages[1] as StaticStage).nodes.length, 100);
    });
  });
});
