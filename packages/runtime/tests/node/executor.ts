/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "@breadboard-ai/types";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Executor } from "../../src/static/executor.js";
import type {
  ExecutionPlan,
  NodeLogic,
  PlanNodeInfo,
} from "../../src/static/types.js";

// Mock NodeLogic for testing
class MockNodeLogic implements NodeLogic {
  private mockBehaviors: Map<
    string,
    (inputs: InputValues) => Promise<OutputValues | { $error: string }>
  > = new Map();

  setMockBehavior(
    nodeId: string,
    behavior: (
      inputs: InputValues
    ) => Promise<OutputValues | { $error: string }>
  ): void {
    this.mockBehaviors.set(nodeId, behavior);
  }

  async invoke(
    node: NodeDescriptor,
    inputs: InputValues
  ): Promise<OutputValues | { $error: string }> {
    const behavior = this.mockBehaviors.get(node.id);
    if (behavior) {
      return behavior(inputs);
    }

    // Default behavior based on node type
    switch (node.type) {
      case "input":
        return { data: `input-${node.id}` };
      case "process":
        return { result: `processed-${JSON.stringify(inputs)}` };
      case "output":
        return inputs;
      default:
        return { $error: `Unknown node type: ${node.type}` };
    }
  }
}

// Helper to create test execution plans
function createTestPlan(nodes: PlanNodeInfo[]): ExecutionPlan {
  return {
    stages: [
      {
        type: "static",
        nodes: nodes,
      },
    ],
  };
}

function createLinearPlan(nodeIds: string[]): ExecutionPlan {
  const nodeInfos: PlanNodeInfo[] = nodeIds.map((id) => ({
    id,
    upstream: [],
    downstream: [],
  }));

  // Add dependencies between nodes
  for (let i = 0; i < nodeInfos.length - 1; i++) {
    const currentNode = nodeInfos[i];
    const nextNode = nodeInfos[i + 1];

    currentNode.downstream.push({ to: nextNode, out: "data" });
    nextNode.upstream.push({ from: currentNode, in: "data" });
  }

  // Create stages
  const stages = nodeInfos.map((nodeInfo) => ({
    type: "static" as const,
    nodes: [nodeInfo],
  }));

  return { stages };
}

function createParallelPlan(nodeIds: string[]): ExecutionPlan {
  const nodes = nodeIds.map((id) => ({
    id,
    upstream: [],
    downstream: [],
  }));

  return {
    stages: [
      {
        type: "static",
        nodes,
      },
    ],
  };
}

describe("Executor", () => {
  describe("constructor and initialization", () => {
    it("should create executor with valid plan and graph", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      assert.equal(executor.plan, plan);
      assert.equal(executor.graph, graph);
    });

    it("should initialize node controllers for static stages", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "a", upstream: [], downstream: [] },
        { id: "b", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const status = executor.status();

      assert.equal(status.length, 2);
      assert.equal(status[0].id, "a");
      assert.equal(status[0].state, "waiting");
      assert.equal(status[1].id, "b");
      assert.equal(status[1].state, "waiting");
    });

    it("should initialize node controllers for VM stages", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "vm_node", type: "subgraph" }],
        edges: [],
      };
      const plan: ExecutionPlan = {
        stages: [
          {
            type: "vm",
            node: { id: "vm_node", upstream: [], downstream: [] },
          },
        ],
      };
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const status = executor.status();

      assert.equal(status.length, 1);
      assert.equal(status[0].id, "vm_node");
      assert.equal(status[0].state, "waiting");
    });

    it("should handle empty plan", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const plan: ExecutionPlan = { stages: [] };
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const status = executor.status();

      assert.equal(status.length, 0);
    });
  });

  describe("NodeStateController.beforeInvoking", () => {
    it("should transition to 'cached' when results exist in cache", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Pre-populate cache
      executor.clearResults();
      executor["cache"].set("test", new Map([["output", "cached_value"]]));

      // Get node controller and call beforeInvoking
      const controller = executor["nodeControllers"].get("test");
      assert.ok(controller);

      controller.beforeInvoking(executor["cache"]);
      assert.equal(controller.state, "cached");
    });

    it("should transition to 'ready' when all dependencies are satisfied", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };
      const plan: ExecutionPlan = createLinearPlan(["a", "b"]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Pre-populate cache with upstream dependency
      executor["cache"].set("a", new Map([["data", "upstream_value"]]));

      const controller = executor["nodeControllers"].get("b");
      assert.ok(controller);

      controller.beforeInvoking(executor["cache"]);
      assert.equal(controller.state, "ready");
    });

    it("should remain 'waiting' when dependencies are not satisfied", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };
      const plan: ExecutionPlan = createLinearPlan(["a", "b"]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      const controller = executor["nodeControllers"].get("b");
      assert.ok(controller);

      controller.beforeInvoking(executor["cache"]);
      assert.equal(controller.state, "waiting");
    });
  });

  describe("NodeStateController.afterInvoking", () => {
    it("should transition to 'succeeded' when invocation succeeds", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const controller = executor["nodeControllers"].get("test");
      assert.ok(controller);

      controller.afterInvoking(false);
      assert.equal(controller.state, "succeeded");
    });

    it("should transition to 'failed' when invocation fails", () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const controller = executor["nodeControllers"].get("test");
      assert.ok(controller);

      controller.afterInvoking(true);
      assert.equal(controller.state, "failed");
    });
  });

  describe("runNode", () => {
    it("should return error when no NodeLogic is provided", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);

      const executor = new Executor(plan, graph);
      const result = await executor.runNode("test");

      assert.ok(result !== undefined && "$error" in result);
      if (result !== undefined && "$error" in result) {
        assert.equal(result.$error, "No NodeLogic provided to executor");
      }
    });

    it("should return error for unknown node", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.runNode("unknown");

      assert.ok("$error" in result);
      assert.equal(
        result.$error,
        "Node with id 'unknown' not found in execution plan"
      );
    });

    it("should return cached results when available", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Pre-populate cache
      executor["cache"].set("test", new Map([["output", "cached_value"]]));

      const result = await executor.runNode("test");

      assert.ok(result === undefined || !("$error" in result));
      assert.equal(result.output, "cached_value");
    });

    it("should execute node when ready", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("test", async () => ({ result: "success" }));

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.runNode("test");

      assert.ok(result === undefined || !("$error" in result));
      assert.equal(result.result, "success");
    });

    it("should handle node logic errors", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("test", async () => ({
        $error: "Node failed",
      }));

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.runNode("test");

      assert.ok("$error" in result);
      assert.equal(result.$error, "Node failed");
    });

    it("should handle node logic exceptions", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("test", async () => {
        throw new Error("Node crashed");
      });

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.runNode("test");

      assert.ok("$error" in result);
      assert.equal(result.$error, "Node crashed");
    });

    it("should gather inputs from dependencies", async () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };

      // Create a plan that matches the actual edge ports
      const nodeA: PlanNodeInfo = { id: "a", upstream: [], downstream: [] };
      const nodeB: PlanNodeInfo = { id: "b", upstream: [], downstream: [] };

      nodeA.downstream.push({ to: nodeB, out: "data" });
      nodeB.upstream.push({ from: nodeA, in: "input" });

      const plan: ExecutionPlan = {
        stages: [
          { type: "static", nodes: [nodeA] },
          { type: "static", nodes: [nodeB] },
        ],
      };
      const nodeLogic = new MockNodeLogic();

      let capturedInputs: InputValues;
      nodeLogic.setMockBehavior("b", async (inputs) => {
        capturedInputs = inputs;
        return { result: "processed" };
      });

      const executor = new Executor(plan, graph, nodeLogic);

      // First run node 'a' to populate cache
      await executor.runNode("a");

      // Now run node 'b' which depends on 'a'
      await executor.runNode("b");

      assert.ok(capturedInputs!);
      assert.ok("input" in capturedInputs!);
    });

    it("should update node state during execution", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("test", async () => {
        // Check state during execution
        const controller = executor["nodeControllers"].get("test");
        assert.equal(controller!.state, "running");
        return { result: "success" };
      });

      const executor = new Executor(plan, graph, nodeLogic);
      await executor.runNode("test");

      const controller = executor["nodeControllers"].get("test");
      assert.equal(controller!.state, "succeeded");
    });
  });

  describe("run", () => {
    it("should return error when no NodeLogic is provided", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);

      const executor = new Executor(plan, graph);
      const result = await executor.run();

      assert.ok(result !== undefined && "$error" in result);
      if (result !== undefined && "$error" in result) {
        assert.equal(result.$error, "No NodeLogic provided to executor");
      }
    });

    it("should execute all nodes in parallel stage", async () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "input" },
          { id: "c", type: "input" },
        ],
        edges: [],
      };
      const plan: ExecutionPlan = createParallelPlan(["a", "b", "c"]);
      const nodeLogic = new MockNodeLogic();

      const executionOrder: string[] = [];
      ["a", "b", "c"].forEach((id) => {
        nodeLogic.setMockBehavior(id, async () => {
          executionOrder.push(id);
          return { result: `${id}_result` };
        });
      });

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.run();

      assert.ok(result === undefined || !("$error" in result));
      assert.equal(executionOrder.length, 3);
      assert.ok(executionOrder.includes("a"));
      assert.ok(executionOrder.includes("b"));
      assert.ok(executionOrder.includes("c"));
    });

    it("should execute stages in sequence", async () => {
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

      // Create a plan that matches the actual edge ports
      const nodeA: PlanNodeInfo = { id: "a", upstream: [], downstream: [] };
      const nodeB: PlanNodeInfo = { id: "b", upstream: [], downstream: [] };
      const nodeC: PlanNodeInfo = { id: "c", upstream: [], downstream: [] };

      nodeA.downstream.push({ to: nodeB, out: "data" });
      nodeB.upstream.push({ from: nodeA, in: "input" });
      nodeB.downstream.push({ to: nodeC, out: "result" });
      nodeC.upstream.push({ from: nodeB, in: "final" });

      const plan: ExecutionPlan = {
        stages: [
          { type: "static", nodes: [nodeA] },
          { type: "static", nodes: [nodeB] },
          { type: "static", nodes: [nodeC] },
        ],
      };
      const nodeLogic = new MockNodeLogic();

      const executionOrder: string[] = [];
      nodeLogic.setMockBehavior("a", async () => {
        executionOrder.push("a");
        return { data: "a_result" };
      });
      nodeLogic.setMockBehavior("b", async () => {
        executionOrder.push("b");
        return { result: "b_result" };
      });
      nodeLogic.setMockBehavior("c", async () => {
        executionOrder.push("c");
        return { final: "c_result" };
      });

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.run();

      assert.ok(result === undefined || !("$error" in result));
      assert.deepEqual(executionOrder, ["a", "b", "c"]);
    });

    it("should handle VM stages", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "vm_node", type: "subgraph" }],
        edges: [],
      };
      const plan: ExecutionPlan = {
        stages: [
          {
            type: "vm",
            node: { id: "vm_node", upstream: [], downstream: [] },
          },
        ],
      };
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("vm_node", async () => ({
        result: "vm_result",
      }));

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.run();

      assert.ok(result === undefined || !("$error" in result));
    });

    it("should return error on node execution failure", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      nodeLogic.setMockBehavior("test", async () => ({
        $error: "Node failed",
      }));

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.run();

      assert.ok(result !== undefined && "$error" in result);
      if (result !== undefined && "$error" in result) {
        assert.ok(result.$error.includes("Error in node 'test': Node failed"));
      }
    });

    it("should skip cached nodes", async () => {
      const graph: GraphDescriptor = {
        nodes: [{ id: "test", type: "input" }],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "test", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      let executionCount = 0;
      nodeLogic.setMockBehavior("test", async () => {
        executionCount++;
        return { result: "success" };
      });

      const executor = new Executor(plan, graph, nodeLogic);

      // First run should execute
      await executor.run();
      assert.equal(executionCount, 1);

      // Second run should skip cached node
      await executor.run();
      assert.equal(executionCount, 1);
    });
  });

  describe("cache management", () => {
    it("should clear results for specific node", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "a", upstream: [], downstream: [] },
        { id: "b", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Populate cache
      executor["cache"].set("a", new Map([["output", "value_a"]]));
      executor["cache"].set("b", new Map([["output", "value_b"]]));

      // Mark as succeeded
      executor["nodeControllers"].get("a")!.state = "succeeded";
      executor["nodeControllers"].get("b")!.state = "succeeded";

      executor.clearResultsForNode("a");

      assert.ok(!executor["cache"].has("a"));
      assert.ok(executor["cache"].has("b"));
      assert.equal(executor["nodeControllers"].get("a")!.state, "waiting");
      assert.equal(executor["nodeControllers"].get("b")!.state, "succeeded");
    });

    it("should clear all results", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "a", upstream: [], downstream: [] },
        { id: "b", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Populate cache
      executor["cache"].set("a", new Map([["output", "value_a"]]));
      executor["cache"].set("b", new Map([["output", "value_b"]]));

      // Mark as succeeded
      executor["nodeControllers"].get("a")!.state = "succeeded";
      executor["nodeControllers"].get("b")!.state = "succeeded";

      executor.clearResults();

      assert.equal(executor["cache"].size, 0);
      assert.equal(executor["nodeControllers"].get("a")!.state, "waiting");
      assert.equal(executor["nodeControllers"].get("b")!.state, "waiting");
    });
  });

  describe("status", () => {
    it("should return current state of all nodes", () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "output" },
        ],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "a", upstream: [], downstream: [] },
        { id: "b", upstream: [], downstream: [] },
        { id: "c", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Modify some states
      executor["nodeControllers"].get("a")!.state = "succeeded";
      executor["nodeControllers"].get("b")!.state = "running";
      executor["nodeControllers"].get("c")!.state = "waiting";

      const status = executor.status();

      assert.equal(status.length, 3);

      const aStatus = status.find((s) => s.id === "a");
      const bStatus = status.find((s) => s.id === "b");
      const cStatus = status.find((s) => s.id === "c");

      assert.equal(aStatus?.state, "succeeded");
      assert.equal(bStatus?.state, "running");
      assert.equal(cStatus?.state, "waiting");
    });

    it("should return empty array for empty plan", () => {
      const graph: GraphDescriptor = { nodes: [], edges: [] };
      const plan: ExecutionPlan = { stages: [] };
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const status = executor.status();

      assert.equal(status.length, 0);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle missing nodes in graph", () => {
      const graph: GraphDescriptor = {
        nodes: [],
        edges: [],
      };
      const plan: ExecutionPlan = createTestPlan([
        { id: "missing", upstream: [], downstream: [] },
      ]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const status = executor.status();

      // Should not create controller for missing node
      assert.equal(status.length, 0);
    });

    it("should handle complex dependency chains", async () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
          { id: "c", type: "process" },
          { id: "d", type: "output" },
        ],
        edges: [
          { from: "a", to: "b", out: "data", in: "input" },
          { from: "a", to: "c", out: "data", in: "input" },
          { from: "b", to: "d", out: "result", in: "left" },
          { from: "c", to: "d", out: "result", in: "right" },
        ],
      };

      const plan: ExecutionPlan = {
        stages: [
          {
            type: "static",
            nodes: [
              {
                id: "a",
                upstream: [],
                downstream: [
                  {
                    to: { id: "b", upstream: [], downstream: [] },
                    out: "data",
                  },
                  {
                    to: { id: "c", upstream: [], downstream: [] },
                    out: "data",
                  },
                ],
              },
            ],
          },
          {
            type: "static",
            nodes: [
              {
                id: "b",
                upstream: [
                  {
                    from: { id: "a", upstream: [], downstream: [] },
                    in: "input",
                  },
                ],
                downstream: [
                  {
                    to: { id: "d", upstream: [], downstream: [] },
                    out: "result",
                  },
                ],
              },
              {
                id: "c",
                upstream: [
                  {
                    from: { id: "a", upstream: [], downstream: [] },
                    in: "input",
                  },
                ],
                downstream: [
                  {
                    to: { id: "d", upstream: [], downstream: [] },
                    out: "result",
                  },
                ],
              },
            ],
          },
          {
            type: "static",
            nodes: [
              {
                id: "d",
                upstream: [
                  {
                    from: { id: "b", upstream: [], downstream: [] },
                    in: "left",
                  },
                  {
                    from: { id: "c", upstream: [], downstream: [] },
                    in: "right",
                  },
                ],
                downstream: [],
              },
            ],
          },
        ],
      };

      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);
      const result = await executor.run();

      assert.ok(result === undefined || !("$error" in result));
    });

    it("should handle execution with no ready nodes", async () => {
      const graph: GraphDescriptor = {
        nodes: [
          { id: "a", type: "input" },
          { id: "b", type: "process" },
        ],
        edges: [{ from: "a", to: "b", out: "data", in: "input" }],
      };
      const plan: ExecutionPlan = createLinearPlan(["a", "b"]);
      const nodeLogic = new MockNodeLogic();

      const executor = new Executor(plan, graph, nodeLogic);

      // Mark first node as failed so second node can't run
      executor["nodeControllers"].get("a")!.state = "failed";

      const result = await executor.run();

      // Should complete without error even if no nodes are ready
      assert.ok(result === undefined || !("$error" in result));
    });
  });
});
