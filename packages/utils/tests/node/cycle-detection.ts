/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, GraphDescriptor } from "@breadboard-ai/types";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { willCreateCycle } from "../../src/cycle-detection.js";

describe("willCreateCycle function", () => {
  describe("basic functionality", () => {
    it("should return false for empty graph", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const edge: Edge = { from: "a", to: "b" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return false when graph has no nodes", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const edge: Edge = { from: "a", to: "b" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return false when graph has no edges", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "output" },
        ],
        edges: [],
      };
      const edge: Edge = { from: "a", to: "b" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return false when target node does not exist", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "input" }],
        edges: [],
      };
      const edge: Edge = { from: "a", to: "nonexistent" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return false when source node does not exist", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "b", type: "output" }],
        edges: [],
      };
      const edge: Edge = { from: "nonexistent", to: "b" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });
  });

  describe("self-loop detection", () => {
    it("should return true for self-loop", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "process" }],
        edges: [],
      };
      const edge: Edge = { from: "a", to: "a" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should return false for existing self-loop", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "process" }],
        edges: [{ from: "a", to: "a" }],
      };
      const edge: Edge = { from: "a", to: "a" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });
  });

  describe("simple cycle detection", () => {
    it("should return true for simple two-node cycle", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b" }],
      };
      const edge: Edge = { from: "b", to: "a" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should return false for already existing two-node cycle", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      };
      const edge: Edge = { from: "a", to: "b" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return false for acyclic three-node chain", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      };
      const edge: Edge = { from: "a", to: "c" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should return true for three-node cycle", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      };
      const edge: Edge = { from: "c", to: "a" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });
  });

  describe("complex cycle detection", () => {
    it("should detect cycles in complex graphs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
          { id: "e", type: "output" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "c", to: "d" },
          { from: "d", to: "e" },
        ],
      };

      // Adding edge from d to b would create a cycle: b -> c -> d -> b
      const edge: Edge = { from: "d", to: "b" };
      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should handle branching graphs correctly", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
          { id: "e", type: "output" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "c" }, // Branch from a
          { from: "b", to: "d" },
          { from: "c", to: "d" }, // Merge at d
          { from: "d", to: "e" },
        ],
      };

      // Adding edge from d to a would create a cycle
      const cycleEdge: Edge = { from: "d", to: "a" };
      const result1 = willCreateCycle(cycleEdge, graph);
      assert.equal(result1, true);

      // Adding edge from e to b would create a cycle (b -> d -> e -> b)
      const cycleEdge2: Edge = { from: "e", to: "b" };
      const result2 = willCreateCycle(cycleEdge2, graph);
      assert.equal(result2, true);
    });

    it("should handle multiple independent cycles", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
          { id: "e", type: "process" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" }, // First cycle: a <-> b
          { from: "c", to: "d" },
          { from: "d", to: "c" }, // Second cycle: c <-> d
          { from: "b", to: "e" }, // Connection to isolated node
        ],
      };

      // Adding edge from e to a would create a larger cycle
      const edge: Edge = { from: "e", to: "a" };
      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should handle long paths correctly", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "n1", type: "input" },
          { id: "n2", type: "process" },
          { id: "n3", type: "process" },
          { id: "n4", type: "process" },
          { id: "n5", type: "process" },
          { id: "n6", type: "process" },
          { id: "n7", type: "output" },
        ],
        edges: [
          { from: "n1", to: "n2" },
          { from: "n2", to: "n3" },
          { from: "n3", to: "n4" },
          { from: "n4", to: "n5" },
          { from: "n5", to: "n6" },
          { from: "n6", to: "n7" },
        ],
      };

      // Adding edge from n7 to n1 would create a large cycle
      const cycleEdge: Edge = { from: "n7", to: "n1" };
      const result1 = willCreateCycle(cycleEdge, graph);
      assert.equal(result1, true);

      // Adding edge from n5 to n2 would create a smaller cycle
      const smallerCycleEdge: Edge = { from: "n5", to: "n2" };
      const result2 = willCreateCycle(smallerCycleEdge, graph);
      assert.equal(result2, true);

      // Adding edge from n1 to n7 would not create a cycle (already a path)
      const nonCycleEdge: Edge = { from: "n1", to: "n7" };
      const result3 = willCreateCycle(nonCycleEdge, graph);
      assert.equal(result3, false);
    });
  });

  describe("edge cases", () => {
    it("should handle single node graph", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "a", type: "process" }],
        edges: [],
      };
      const edge: Edge = { from: "a", to: "a" };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should handle disconnected components", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
        ],
        edges: [
          { from: "a", to: "b" }, // First component
          { from: "c", to: "d" }, // Second component
        ],
      };

      // Connecting components should not create cycle
      const edge: Edge = { from: "b", to: "c" };
      const result = willCreateCycle(edge, graph);
      assert.equal(result, false);
    });

    it("should handle graphs with missing nodes or edges", () => {
      const graph1: GraphDescriptor = { nodes: [], edges: [] };
      const edge: Edge = { from: "a", to: "b" };

      const result1 = willCreateCycle(edge, graph1);
      assert.equal(result1, false);
    });
  });

  describe("edges with ports", () => {
    it("should work with edges containing port values (simple)", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "result", in: "input" }],
      };

      const edge: Edge = { from: "b", to: "a", out: "feedback", in: "control" };
      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });

    it("should work with edges containing port values (complex)", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "node1", type: "llm" },
          { id: "node2", type: "transform" },
          { id: "node3", type: "output" },
        ],
        edges: [
          {
            from: "node1",
            to: "node2",
            out: "completion",
            in: "text",
          },
          {
            from: "node2",
            to: "node3",
            out: "result",
            in: "final",
          },
        ],
      };

      const edge: Edge = {
        from: "node3",
        to: "node1",
        out: "feedback",
        in: "context",
      };

      const result = willCreateCycle(edge, graph);
      assert.equal(result, true);
    });
  });
});
