/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createPlan } from "../../src/static/create-plan.js";

describe("createPlan function", () => {
  describe("basic functionality", () => {
    it("should return empty plan for empty graph", () => {
      const emptyGraph: GraphDescriptor = { nodes: [], edges: [] };
      const result = createPlan(emptyGraph);
      assert.deepEqual(result, { stages: [] });
    });

    it("should return empty plan when no nodes", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const result = createPlan(graph);
      assert.deepEqual(result, { stages: [] });
    });

    it("should handle single node with no edges", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "process" }],
        edges: [],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 1);
        assert.equal(result.stages[0].nodes[0].node.id, "a");
      }
    });

    it("should handle multiple nodes with no edges", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 1);
      assert.equal(result.stages[0].type, "static");
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 3);
        const nodeIds = result.stages[0].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("a"));
        assert.ok(nodeIds.includes("b"));
        assert.ok(nodeIds.includes("c"));
      }
    });
  });

  describe("linear graphs", () => {
    it("should create sequential stages for linear graph", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "b", to: "c", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 3);

      // Stage 1: node a
      assert.equal(result.stages[0].type, "static");
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 1);
        assert.equal(result.stages[0].nodes[0].node.id, "a");
      }

      // Stage 2: node b
      assert.equal(result.stages[1].type, "static");
      if (result.stages[1].type === "static") {
        assert.equal(result.stages[1].nodes.length, 1);
        assert.equal(result.stages[1].nodes[0].node.id, "b");
      }

      // Stage 3: node c
      assert.equal(result.stages[2].type, "static");
      if (result.stages[2].type === "static") {
        assert.equal(result.stages[2].nodes.length, 1);
        assert.equal(result.stages[2].nodes[0].node.id, "c");
      }
    });

    it("should handle longer linear chains", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "n1", type: "input" },
          { id: "n2", type: "process" },
          { id: "n3", type: "process" },
          { id: "n4", type: "process" },
          { id: "n5", type: "output" },
        ],
        edges: [
          { from: "n1", to: "n2", out: "step1", in: "input" },
          { from: "n2", to: "n3", out: "step2", in: "data" },
          { from: "n3", to: "n4", out: "step3", in: "process" },
          { from: "n4", to: "n5", out: "step4", in: "final" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 5);

      // Each stage should have one node in sequence
      const expectedNodes = ["n1", "n2", "n3", "n4", "n5"];
      result.stages.forEach((stage, index) => {
        assert.equal(stage.type, "static");
        if (stage.type === "static") {
          assert.equal(stage.nodes.length, 1);
          assert.equal(stage.nodes[0].node.id, expectedNodes[index]);
        }
      });
    });
  });

  describe("parallel graphs", () => {
    it("should create parallel stages for independent branches", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "start", type: "input" },
          { id: "branch1", type: "process" },
          { id: "branch2", type: "process" },
          { id: "end", type: "output" },
        ],
        edges: [
          { from: "start", to: "branch1", out: "data", in: "input1" },
          { from: "start", to: "branch2", out: "data", in: "input2" },
          { from: "branch1", to: "end", out: "result1", in: "merge1" },
          { from: "branch2", to: "end", out: "result2", in: "merge2" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 3);

      // Stage 1: start node
      assert.equal(result.stages[0].type, "static");
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 1);
        assert.equal(result.stages[0].nodes[0].node.id, "start");
      }

      // Stage 2: parallel branches
      assert.equal(result.stages[1].type, "static");
      if (result.stages[1].type === "static") {
        assert.equal(result.stages[1].nodes.length, 2);
        const nodeIds = result.stages[1].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("branch1"));
        assert.ok(nodeIds.includes("branch2"));
      }

      // Stage 3: end node
      assert.equal(result.stages[2].type, "static");
      if (result.stages[2].type === "static") {
        assert.equal(result.stages[2].nodes.length, 1);
        assert.equal(result.stages[2].nodes[0].node.id, "end");
      }
    });

    it("should handle multiple parallel branches", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "p1", type: "process" },
          { id: "p2", type: "process" },
          { id: "p3", type: "process" },
          { id: "p4", type: "process" },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "p1", out: "data", in: "input1" },
          { from: "input", to: "p2", out: "data", in: "input2" },
          { from: "input", to: "p3", out: "data", in: "input3" },
          { from: "input", to: "p4", out: "data", in: "input4" },
          { from: "p1", to: "output", out: "result1", in: "merge1" },
          { from: "p2", to: "output", out: "result2", in: "merge2" },
          { from: "p3", to: "output", out: "result3", in: "merge3" },
          { from: "p4", to: "output", out: "result4", in: "merge4" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 3);

      // Check parallel processing stage
      assert.equal(result.stages[1].type, "static");
      if (result.stages[1].type === "static") {
        assert.equal(result.stages[1].nodes.length, 4);
        const nodeIds = result.stages[1].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("p1"));
        assert.ok(nodeIds.includes("p2"));
        assert.ok(nodeIds.includes("p3"));
        assert.ok(nodeIds.includes("p4"));
      }
    });
  });

  describe("complex graphs", () => {
    it("should handle diamond-shaped graphs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "start", type: "input" },
          { id: "left", type: "process" },
          { id: "right", type: "process" },
          { id: "merge", type: "output" },
        ],
        edges: [
          { from: "start", to: "left", out: "data", in: "input1" },
          { from: "start", to: "right", out: "data", in: "input2" },
          { from: "left", to: "merge", out: "result1", in: "combine1" },
          { from: "right", to: "merge", out: "result2", in: "combine2" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 3);

      // Verify parallel processing happens in middle stage
      assert.equal(result.stages[1].type, "static");
      if (result.stages[1].type === "static") {
        assert.equal(result.stages[1].nodes.length, 2);
        const nodeIds = result.stages[1].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("left"));
        assert.ok(nodeIds.includes("right"));
      }
    });

    it("should handle complex multi-stage graphs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "stage1a", type: "process" },
          { id: "stage1b", type: "process" },
          { id: "stage2", type: "process" },
          { id: "stage3a", type: "process" },
          { id: "stage3b", type: "process" },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "stage1a", out: "data", in: "input1" },
          { from: "input", to: "stage1b", out: "data", in: "input2" },
          { from: "stage1a", to: "stage2", out: "result1", in: "combine1" },
          { from: "stage1b", to: "stage2", out: "result2", in: "combine2" },
          { from: "stage2", to: "stage3a", out: "processed", in: "input3" },
          { from: "stage2", to: "stage3b", out: "processed", in: "input4" },
          { from: "stage3a", to: "output", out: "final1", in: "merge1" },
          { from: "stage3b", to: "output", out: "final2", in: "merge2" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 5);

      // Check that each stage has the right number of nodes
      const stageSizes = result.stages.map((stage) =>
        stage.type === "static" ? stage.nodes.length : 1
      );
      assert.deepEqual(stageSizes, [1, 2, 1, 2, 1]);
    });
  });

  describe("vm stages (strongly connected components)", () => {
    it("should create vm stage for node with folded tag", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "scc_0", type: "subgraph", metadata: { tags: ["folded"] } },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "scc_0", out: "data", in: "input" },
          { from: "scc_0", to: "output", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 3);

      // Check that middle stage is a vm stage
      assert.equal(result.stages[1].type, "vm");
      if (result.stages[1].type === "vm") {
        assert.equal(result.stages[1].node.node.id, "scc_0");
      }
    });

    it("should handle multiple vm stages", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "scc_0", type: "subgraph", metadata: { tags: ["folded"] } },
          { id: "scc_1", type: "subgraph", metadata: { tags: ["folded"] } },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "scc_0", out: "data", in: "input1" },
          { from: "input", to: "scc_1", out: "data", in: "input2" },
          { from: "scc_0", to: "output", out: "result1", in: "merge1" },
          { from: "scc_1", to: "output", out: "result2", in: "merge2" },
        ],
      };
      const result = createPlan(graph);

      // VM stages should run in parallel, so they create separate stages
      assert.equal(result.stages.length, 4);

      // Check that we have input, two vm stages, and output
      assert.equal(result.stages[0].type, "static");
      assert.equal(result.stages[1].type, "vm");
      assert.equal(result.stages[2].type, "vm");
      assert.equal(result.stages[3].type, "static");
    });

    it("should handle mixed static and vm stages", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "process", type: "process" },
          { id: "scc_0", type: "subgraph", metadata: { tags: ["folded"] } },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "input", to: "process", out: "data", in: "input1" },
          { from: "process", to: "scc_0", out: "processed", in: "input2" },
          { from: "scc_0", to: "output", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 4);

      // Check stage types
      assert.equal(result.stages[0].type, "static");
      assert.equal(result.stages[1].type, "static");
      assert.equal(result.stages[2].type, "vm");
      assert.equal(result.stages[3].type, "static");
    });
  });

  describe("node information", () => {
    it("should populate downstream dependencies", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "b", to: "c", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);

      const stage0 = result.stages[0];
      if (stage0.type === "static") {
        const nodeA = stage0.nodes[0];
        assert.equal(nodeA.node.id, "a");
        assert.equal(nodeA.downstream.length, 1);
        assert.equal(nodeA.downstream[0].to.node.id, "b");
        assert.equal(nodeA.downstream[0].out, "data");
      }
    });

    it("should populate upstream dependencies", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "b", to: "c", out: "result", in: "final" },
        ],
      };
      const result = createPlan(graph);

      const stage1 = result.stages[1];
      if (stage1.type === "static") {
        const nodeB = stage1.nodes[0];
        assert.equal(nodeB.node.id, "b");
        assert.equal(nodeB.upstream.length, 1);
        assert.equal(nodeB.upstream[0].from.node.id, "a");
        assert.equal(nodeB.upstream[0].in, "input");
      }
    });

    it("should handle nodes with multiple dependencies", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "input" },
          { id: "c", type: "process" },
          { id: "d", type: "output" },
          { id: "e", type: "output" },
        ],
        edges: [
          { from: "a", to: "c", out: "data1", in: "input1" },
          { from: "b", to: "c", out: "data2", in: "input2" },
          { from: "c", to: "d", out: "result1", in: "final1" },
          { from: "c", to: "e", out: "result2", in: "final2" },
        ],
      };
      const result = createPlan(graph);

      const stage1 = result.stages[1];
      if (stage1.type === "static") {
        const nodeC = stage1.nodes[0];
        assert.equal(nodeC.node.id, "c");
        assert.equal(nodeC.upstream.length, 2);
        assert.equal(nodeC.downstream.length, 2);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle graphs with no edges", () => {
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
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 2);
      }
    });

    it("should handle graphs with undefined edges", () => {
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
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 2);
      }
    });

    it("should handle disconnected components", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "input" },
          { id: "d", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data1", in: "input1" },
          { from: "c", to: "d", out: "data2", in: "input2" },
        ],
      };
      const result = createPlan(graph);

      assert.equal(result.stages.length, 2);

      // First stage should have both starting nodes
      assert.equal(result.stages[0].type, "static");
      if (result.stages[0].type === "static") {
        assert.equal(result.stages[0].nodes.length, 2);
        const nodeIds = result.stages[0].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("a"));
        assert.ok(nodeIds.includes("c"));
      }

      // Second stage should have both ending nodes
      assert.equal(result.stages[1].type, "static");
      if (result.stages[1].type === "static") {
        assert.equal(result.stages[1].nodes.length, 2);
        const nodeIds = result.stages[1].nodes.map((n) => n.node.id);
        assert.ok(nodeIds.includes("b"));
        assert.ok(nodeIds.includes("d"));
      }
    });
  });

  describe("port handling", () => {
    it("should preserve port names in dependencies", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "llm", type: "llm" },
          { id: "transform", type: "transform" },
        ],
        edges: [
          { from: "llm", to: "transform", out: "completion", in: "text" },
        ],
      };
      const result = createPlan(graph);

      const stage0 = result.stages[0];
      if (stage0.type === "static") {
        const llmNode = stage0.nodes[0];
        assert.equal(llmNode.downstream[0].out, "completion");
      }

      const stage1 = result.stages[1];
      if (stage1.type === "static") {
        const transformNode = stage1.nodes[0];
        assert.equal(transformNode.upstream[0].in, "text");
      }
    });

    it("should handle edges with missing port information", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "output" },
        ],
        edges: [{ from: "a", to: "b" }],
      };
      const result = createPlan(graph);

      const stage0 = result.stages[0];
      if (stage0.type === "static") {
        const nodeA = stage0.nodes[0];
        assert.equal(nodeA.downstream[0].out, "");
      }

      const stage1 = result.stages[1];
      if (stage1.type === "static") {
        const nodeB = stage1.nodes[0];
        assert.equal(nodeB.upstream[0].in, "");
      }
    });
  });
});
