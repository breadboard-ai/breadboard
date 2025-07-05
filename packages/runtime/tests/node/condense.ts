/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { condense } from "../../src/static/condense.js";

describe("condense function", () => {
  describe("basic functionality", () => {
    it("should return original graph when no nodes or edges", () => {
      const emptyGraph: GraphDescriptor = { nodes: [], edges: [] };
      const result = condense(emptyGraph);
      assert.deepEqual(result, emptyGraph);
    });

    it("should return original graph when no edges", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "output" },
        ],
        edges: [],
      };
      const result = condense(graph);
      assert.deepEqual(result, graph);
    });

    it("should return original graph when no nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [{ from: "a", to: "b" }],
      };
      const result = condense(graph);
      assert.deepEqual(result, graph);
    });

    it("should return original graph when no strongly connected components", () => {
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
      const result = condense(graph);
      assert.deepEqual(result, graph);
    });
  });

  describe("simple strongly connected components", () => {
    it("should condense a simple 2-node cycle", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "b", to: "a", out: "feedback", in: "previous" }, // Creates SCC
          { from: "b", to: "c", out: "result", in: "final" },
        ],
      };

      const result = condense(graph);

      // Should have condensed node instead of a and b
      assert.equal(result.nodes?.length, 2);
      assert.ok(result.nodes?.some((node) => node.id === "c"));
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));

      // Should have subgraph
      assert.ok(result.graphs);
      assert.ok(result.graphs["scc_0"]);

      // Subgraph should contain original nodes plus input/output
      const subgraph = result.graphs["scc_0"];
      assert.equal(subgraph.nodes?.length, 4); // input, a, b, output
      assert.ok(subgraph.nodes?.some((node) => node.id === "input"));
      assert.ok(subgraph.nodes?.some((node) => node.id === "output"));
      assert.ok(subgraph.nodes?.some((node) => node.id === "a"));
      assert.ok(subgraph.nodes?.some((node) => node.id === "b"));
    });

    it("should condense a 3-node cycle", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
        ],
        edges: [
          { from: "a", to: "b", out: "step1", in: "input" },
          { from: "b", to: "c", out: "step2", in: "data" },
          { from: "c", to: "a", out: "step3", in: "loop" }, // Creates 3-node SCC
        ],
      };

      const result = condense(graph);

      // Should have one condensed node
      assert.equal(result.nodes?.length, 1);
      assert.equal(result.nodes?.[0].id, "scc_0");
      assert.equal(result.nodes?.[0].type, "#scc_0");

      // Should have subgraph with all original nodes
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);
      assert.equal(subgraph.nodes?.length, 5); // input, a, b, c, output
    });

    it("should handle self-loops as SCCs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "output" },
        ],
        edges: [
          { from: "a", to: "a", out: "state", in: "previous" }, // Self-loop
          { from: "a", to: "b", out: "result", in: "final" },
        ],
      };

      const result = condense(graph);

      // Should condense the self-loop
      assert.equal(result.nodes?.length, 2);
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));
      assert.ok(result.nodes?.some((node) => node.id === "b"));

      // Should have subgraph
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);
      assert.ok(subgraph.nodes?.some((node) => node.id === "a"));
    });
  });

  describe("complex strongly connected components", () => {
    it("should handle multiple separate SCCs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
          { id: "e", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data1", in: "input1" },
          { from: "b", to: "a", out: "feedback1", in: "prev1" }, // First SCC: a-b
          { from: "c", to: "d", out: "data2", in: "input2" },
          { from: "d", to: "c", out: "feedback2", in: "prev2" }, // Second SCC: c-d
          { from: "b", to: "c", out: "connect", in: "bridge" }, // Connect SCCs
          { from: "d", to: "e", out: "final", in: "result" },
        ],
      };

      const result = condense(graph);

      // Should have 3 nodes: 2 condensed + e
      assert.equal(result.nodes?.length, 3);
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));
      assert.ok(result.nodes?.some((node) => node.id === "e"));

      // Should have 2 subgraphs
      assert.ok(result.graphs?.["scc_0"]);
      assert.ok(result.graphs?.["scc_1"]);
    });

    it("should handle nested SCCs with external connections", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "start", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "end", type: "output" },
        ],
        edges: [
          { from: "start", to: "a", out: "initial", in: "seed" },
          { from: "a", to: "b", out: "step1", in: "input" },
          { from: "b", to: "c", out: "step2", in: "data" },
          { from: "c", to: "a", out: "step3", in: "loop" }, // Creates SCC: a-b-c
          { from: "b", to: "end", out: "output", in: "result" },
        ],
      };

      const result = condense(graph);

      // Should have 3 nodes: start, condensed, end
      assert.equal(result.nodes?.length, 3);
      assert.ok(result.nodes?.some((node) => node.id === "start"));
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));
      assert.ok(result.nodes?.some((node) => node.id === "end"));

      // Should have proper edge connections
      const edges = result.edges || [];
      assert.ok(
        edges.some((edge) => edge.from === "start" && edge.to === "scc_0")
      );
      assert.ok(
        edges.some((edge) => edge.from === "scc_0" && edge.to === "end")
      );
    });
  });

  describe("edge handling", () => {
    it("should preserve edge metadata", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "output", in: "input" },
          { from: "b", to: "a", out: "result", in: "feedback" },
          { from: "b", to: "c", out: "data", in: "final" },
        ],
      };

      const result = condense(graph);

      // Check that external edge metadata is preserved
      const externalEdge = result.edges?.find((edge) => edge.to === "c");
      assert.ok(externalEdge);
      assert.equal(externalEdge.from, "scc_0");
      assert.equal(externalEdge.out, "data");
      assert.equal(externalEdge.in, "final");
    });

    it("should handle edges with explicit port names", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [
          { from: "a", to: "b", out: "primary", in: "input" },
          { from: "b", to: "a", out: "secondary", in: "feedback" },
        ],
      };

      const result = condense(graph);

      // Should successfully condense with port information
      assert.equal(result.nodes?.length, 1);
      assert.equal(result.nodes?.[0].id, "scc_0");

      // Check that subgraph preserves port names
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);
      const internalEdges = subgraph.edges?.filter(
        (e) => e.from === "a" && e.to === "b"
      );
      assert.ok(
        internalEdges?.some((e) => e.out === "primary" && e.in === "input")
      );
    });
  });

  describe("port mapping and consolidation", () => {
    it("should properly map incoming ports to input node", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "external1", type: "input" },
          { id: "external2", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "external1", to: "a", out: "data1", in: "input1" },
          { from: "external2", to: "b", out: "data2", in: "input2" },
          { from: "a", to: "b", out: "step1", in: "process" },
          { from: "b", to: "a", out: "step2", in: "feedback" }, // SCC
          { from: "b", to: "output", out: "result", in: "final" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Check input node has edges to both SCC entry points
      const inputEdges = subgraph.edges?.filter((e) => e.from === "input");
      assert.ok(inputEdges?.some((e) => e.to === "a" && e.in === "input1"));
      assert.ok(inputEdges?.some((e) => e.to === "b" && e.in === "input2"));
    });

    it("should properly map outgoing ports to output node", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "input", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "external1", type: "output" },
          { id: "external2", type: "output" },
        ],
        edges: [
          { from: "input", to: "a", out: "seed", in: "initial" },
          { from: "a", to: "b", out: "step1", in: "process" },
          { from: "b", to: "a", out: "step2", in: "feedback" }, // SCC
          { from: "a", to: "external1", out: "result1", in: "data1" },
          { from: "b", to: "external2", out: "result2", in: "data2" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Check output node has edges from both SCC exit points
      const outputEdges = subgraph.edges?.filter((e) => e.to === "output");
      assert.ok(
        outputEdges?.some((e) => e.from === "a" && e.out === "result1")
      );
      assert.ok(
        outputEdges?.some((e) => e.from === "b" && e.out === "result2")
      );
    });

    it("should handle multiple ports with same names", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "external", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "sink", type: "output" },
        ],
        edges: [
          { from: "external", to: "a", out: "value", in: "data" },
          { from: "a", to: "b", out: "value", in: "data" },
          { from: "b", to: "c", out: "value", in: "data" },
          { from: "c", to: "a", out: "value", in: "data" }, // SCC
          { from: "b", to: "sink", out: "value", in: "data" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // All internal edges should preserve "value"/"data" port names
      const internalEdges = subgraph.edges?.filter(
        (e) =>
          ["a", "b", "c"].includes(e.from) && ["a", "b", "c"].includes(e.to)
      );
      assert.ok(
        internalEdges?.every((e) => e.out === "value" && e.in === "data")
      );
    });

    it("should create unique port mappings for input/output nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "src1", type: "input" },
          { id: "src2", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "dest1", type: "output" },
          { id: "dest2", type: "output" },
        ],
        edges: [
          { from: "src1", to: "a", out: "alpha", in: "input1" },
          { from: "src2", to: "a", out: "beta", in: "input2" },
          { from: "a", to: "b", out: "gamma", in: "process" },
          { from: "b", to: "a", out: "delta", in: "feedback" }, // SCC
          { from: "a", to: "dest1", out: "epsilon", in: "output1" },
          { from: "b", to: "dest2", out: "zeta", in: "output2" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Check that all unique port names are preserved
      const inputToSccEdges = subgraph.edges?.filter((e) => e.from === "input");
      assert.ok(
        inputToSccEdges?.some((e) => e.to === "a" && e.in === "input1")
      );
      assert.ok(
        inputToSccEdges?.some((e) => e.to === "a" && e.in === "input2")
      );

      const sccToOutputEdges = subgraph.edges?.filter((e) => e.to === "output");
      assert.ok(
        sccToOutputEdges?.some((e) => e.from === "a" && e.out === "epsilon")
      );
      assert.ok(
        sccToOutputEdges?.some((e) => e.from === "b" && e.out === "zeta")
      );
    });
  });

  describe("port name preservation as function parameters", () => {
    it("should maintain port names as function parameters for subgraph execution", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "source", type: "input" },
          { id: "processor1", type: "llm" },
          { id: "processor2", type: "transform" },
          { id: "sink", type: "output" },
        ],
        edges: [
          { from: "source", to: "processor1", out: "prompt", in: "text" },
          {
            from: "processor1",
            to: "processor2",
            out: "completion",
            in: "input",
          },
          {
            from: "processor2",
            to: "processor1",
            out: "refinement",
            in: "context",
          }, // SCC
          {
            from: "processor2",
            to: "sink",
            out: "final_result",
            in: "response",
          },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Verify that the condensed node type points to the subgraph
      const condensedNode = result.nodes?.find((n) => n.id === "scc_0");
      assert.ok(condensedNode);
      assert.equal(condensedNode.type, "#scc_0");

      // Verify input node captures incoming port names correctly
      const inputToSccEdges = subgraph.edges?.filter((e) => e.from === "input");
      assert.ok(
        inputToSccEdges?.some(
          (e) => e.to === "processor1" && e.in === "text" && e.out === "text"
        )
      );

      // Verify output node captures outgoing port names correctly
      const sccToOutputEdges = subgraph.edges?.filter((e) => e.to === "output");
      assert.ok(
        sccToOutputEdges?.some(
          (e) =>
            e.from === "processor2" &&
            e.out === "final_result" &&
            e.in === "final_result"
        )
      );

      // Verify internal SCC edges preserve all port names
      const internalEdges = subgraph.edges?.filter(
        (e) =>
          ["processor1", "processor2"].includes(e.from) &&
          ["processor1", "processor2"].includes(e.to)
      );
      assert.ok(
        internalEdges?.some(
          (e) =>
            e.from === "processor1" &&
            e.to === "processor2" &&
            e.out === "completion" &&
            e.in === "input"
        )
      );
      assert.ok(
        internalEdges?.some(
          (e) =>
            e.from === "processor2" &&
            e.to === "processor1" &&
            e.out === "refinement" &&
            e.in === "context"
        )
      );
    });

    it("should handle complex port parameter scenarios", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "config", type: "input" },
          { id: "data", type: "input" },
          { id: "validator", type: "validate" },
          { id: "processor", type: "process" },
          { id: "cache", type: "cache" },
          { id: "output", type: "output" },
          { id: "error", type: "output" },
        ],
        edges: [
          // Inputs to SCC
          {
            from: "config",
            to: "validator",
            out: "schema",
            in: "validation_rules",
          },
          {
            from: "data",
            to: "validator",
            out: "payload",
            in: "data_to_validate",
          },

          // SCC internal edges
          {
            from: "validator",
            to: "processor",
            out: "validated_data",
            in: "clean_input",
          },
          {
            from: "processor",
            to: "cache",
            out: "processed_result",
            in: "cache_key",
          },
          {
            from: "cache",
            to: "validator",
            out: "cached_validation",
            in: "previous_validation",
          }, // Creates SCC

          // SCC outputs
          {
            from: "processor",
            to: "output",
            out: "success_result",
            in: "final_data",
          },
          {
            from: "validator",
            to: "error",
            out: "validation_error",
            in: "error_details",
          },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Verify all parameter names are preserved as function signature
      const inputNode = subgraph.nodes?.find((n) => n.id === "input");
      const outputNode = subgraph.nodes?.find((n) => n.id === "output");
      assert.ok(inputNode);
      assert.ok(outputNode);
      assert.equal(inputNode.type, "input");
      assert.equal(outputNode.type, "output");

      // Check that the subgraph title/description indicates it's a function
      assert.ok(subgraph.title?.includes("SCC"));
      assert.ok(subgraph.description?.includes("strongly connected component"));
    });
  });

  describe("subgraph creation", () => {
    it("should create proper input/output nodes in subgraph", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "external", type: "input" },
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "output", type: "output" },
        ],
        edges: [
          { from: "external", to: "a", out: "value", in: "data" },
          { from: "a", to: "b", out: "result", in: "process" },
          { from: "b", to: "a", out: "loop", in: "feedback" }, // SCC
          { from: "b", to: "output", out: "done", in: "final" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Check input node exists and has proper edges
      const inputNode = subgraph.nodes?.find((node) => node.id === "input");
      assert.ok(inputNode);
      assert.equal(inputNode.type, "input");

      // Check output node exists and has proper edges
      const outputNode = subgraph.nodes?.find((node) => node.id === "output");
      assert.ok(outputNode);
      assert.equal(outputNode.type, "output");

      // Check edges from input to SCC entry points
      const inputEdges =
        subgraph.edges?.filter((edge) => edge.from === "input") || [];
      assert.ok(inputEdges.length > 0);

      // Check edges from SCC exit points to output
      const outputEdges =
        subgraph.edges?.filter((edge) => edge.to === "output") || [];
      assert.ok(outputEdges.length > 0);
    });

    it("should preserve internal edges in subgraph", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
        ],
        edges: [
          { from: "a", to: "b", out: "data1", in: "step1" },
          { from: "b", to: "c", out: "data2", in: "step2" },
          { from: "c", to: "a", out: "data3", in: "step3" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // All internal edges should be preserved
      const internalEdges =
        subgraph.edges?.filter(
          (edge) =>
            ["a", "b", "c"].includes(edge.from) &&
            ["a", "b", "c"].includes(edge.to)
        ) || [];
      assert.equal(internalEdges.length, 3);

      // Check specific edge preservation
      assert.ok(
        internalEdges.some(
          (edge) =>
            edge.from === "a" &&
            edge.to === "b" &&
            edge.out === "data1" &&
            edge.in === "step1"
        )
      );
    });
  });

  describe("metadata preservation", () => {
    it("should preserve graph metadata", () => {
      const graph: GraphDescriptor = {
        title: "Test Graph",
        description: "A test graph for condensation",
        version: "1.0.0",
        nodes: [
          { id: "a", type: "process", metadata: { title: "Node A" } },
          { id: "b", type: "process", metadata: { title: "Node B" } },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      };

      const result = condense(graph);

      // Top-level metadata should be preserved
      assert.equal(result.title, "Test Graph");
      assert.equal(result.description, "A test graph for condensation");
      assert.equal(result.version, "1.0.0");

      // Condensed node should have descriptive metadata
      const condensedNode = result.nodes?.find((node) => node.id === "scc_0");
      assert.ok(condensedNode);
      assert.ok(condensedNode.metadata);
      assert.equal(condensedNode.metadata.title, 'Subgraph "scc_0"');
    });

    it("should preserve node metadata in subgraphs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          {
            id: "a",
            type: "process",
            metadata: {
              title: "Node A",
              description: "First node",
            },
          },
          {
            id: "b",
            type: "process",
            metadata: {
              title: "Node B",
              description: "Second node",
            },
          },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
      };

      const result = condense(graph);
      const subgraph = result.graphs?.["scc_0"];
      assert.ok(subgraph);

      // Original node metadata should be preserved
      const nodeA = subgraph.nodes?.find((node) => node.id === "a");
      assert.ok(nodeA);
      assert.equal(nodeA.metadata?.title, "Node A");
      assert.equal(nodeA.metadata?.description, "First node");
    });
  });

  describe("edge cases", () => {
    it("should handle disconnected components", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "process" },
        ],
        edges: [
          { from: "a", to: "b", out: "data1", in: "input1" },
          { from: "b", to: "a", out: "feedback1", in: "prev1" }, // First component SCC
          { from: "c", to: "d", out: "data2", in: "input2" }, // Second component (no SCC)
        ],
      };

      const result = condense(graph);

      // Should have condensed first component but left second unchanged
      assert.equal(result.nodes?.length, 3); // condensed_0, c, d
      assert.ok(result.nodes?.some((node) => node.id === "scc_0"));
      assert.ok(result.nodes?.some((node) => node.id === "c"));
      assert.ok(result.nodes?.some((node) => node.id === "d"));
    });

    it("should handle graphs with existing subgraphs", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "process" },
          { id: "b", type: "process" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "b", to: "a", out: "feedback", in: "prev" },
        ],
        graphs: {
          existing: {
            nodes: [{ id: "x", type: "test" }],
            edges: [],
          },
        },
      };

      const result = condense(graph);

      // Should preserve existing subgraphs
      assert.ok(result.graphs?.["existing"]);
      assert.equal(result.graphs?.["existing"].nodes?.[0].id, "x");

      // Should add new subgraph
      assert.ok(result.graphs?.["scc_0"]);
    });

    it("should handle empty node and edge arrays", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
      };

      const result = condense(graph);
      assert.deepEqual(result, graph);
    });
  });
});
