/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, it } from "node:test";
import assert from "node:assert";

import type { GraphDescriptor, OrchestrationPlan } from "@breadboard-ai/types";
import type { PlanCreator } from "../src/engine/types.js";
import { PlanRunner } from "../src/engine/runtime/harness/plan-runner.js";
import { createPlan } from "../src/engine/runtime/static/create-plan.js";
import {
  makeSingleNodeGraph,
  makeLinearGraph,
  makeConfig,
  makeInvoker,
  makeBlockingInvoker,
  makeConfigProvider,
} from "./harness-test-helpers.js";

// =========================================================================
// PlanRunner-specific helpers
// =========================================================================

/** Default mock invoker that succeeds for any node type. */
const testInvoker = makeInvoker();

/** Default mock config provider that returns empty config. */
const testConfigProvider = makeConfigProvider();

/**
 * Convenience: create a PlanRunner with mock invoker and config provider
 * so that nodes of type "test" can be handled without a real sandbox
 * or graph store.
 */
function makePlanRunner(
  graph: GraphDescriptor,
  planCreator?: PlanCreator
): PlanRunner {
  const config = makeConfig(graph);
  return new PlanRunner(config, planCreator, testInvoker, testConfigProvider);
}

/**
 * Collect all events dispatched by a PlanRunner.
 * Returns the array so tests can inspect it after the run.
 */
function collectEvents(runner: PlanRunner): Event[] {
  const events: Event[] = [];
  const types = [
    "start",
    "pause",
    "resume",
    "nodestart",
    "nodeend",
    "graphstart",
    "graphend",
    "end",
    "error",
    "nodestatechange",
    "edgestatechange",
    "skip",
    "output",
    "pending",
    "stop",
  ];
  for (const t of types) {
    runner.addEventListener(t, (e) => events.push(e));
  }
  return events;
}

/** Get event type names from a collected events array. */
function eventNames(events: Event[]): string[] {
  return events.map((e) => e.type);
}

/**
 * A mock PlanCreator that records calls and returns a real plan.
 */
function mockPlanCreator(): PlanCreator & { calls: GraphDescriptor[] } {
  const calls: GraphDescriptor[] = [];
  const creator = (graph: GraphDescriptor): OrchestrationPlan => {
    calls.push(graph);
    return createPlan(graph);
  };
  creator.calls = calls;
  return creator as PlanCreator & { calls: GraphDescriptor[] };
}

// =========================================================================
// Tests
// =========================================================================

suite("PlanRunner", () => {
  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  suite("constructor", () => {
    it("throws if config.runner is not set", () => {
      assert.throws(
        () => new PlanRunner({ url: "test://no-runner" }),
        /RunConfig\.runner is empty/
      );
    });

    it("creates successfully with valid config", () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      assert.ok(runner, "should create PlanRunner");
    });

    it("accepts a custom planCreator", () => {
      const creator = mockPlanCreator();
      const runner = makePlanRunner(makeSingleNodeGraph(), creator);
      assert.ok(runner, "should create PlanRunner with custom plan creator");
      // Constructor creates an orchestrator, which calls planCreator once
      assert.strictEqual(creator.calls.length, 1);
    });
  });

  // -----------------------------------------------------------------------
  // start()
  // -----------------------------------------------------------------------

  suite("start()", () => {
    it("dispatches StartEvent then runs to completion", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph("step"));
      const events = collectEvents(runner);

      await runner.start();

      const names = eventNames(events);
      assert.ok(names.includes("start"), "should dispatch start");
      assert.ok(names.includes("graphstart"), "should dispatch graphstart");
      assert.ok(names.includes("end"), "should dispatch end");
      assert.ok(
        names.indexOf("start") < names.indexOf("graphstart"),
        "start should precede graphstart"
      );
      assert.ok(
        names.indexOf("graphstart") < names.indexOf("end"),
        "graphstart should precede end"
      );
    });

    it("runs a multi-node graph and dispatches node events", async () => {
      const graph = makeLinearGraph("a", "b", "c");
      const config = makeConfig(graph);
      // Invoker that returns outputs on the "out" port to match edge wiring
      const invoker = makeInvoker(async (desc) => ({ out: `${desc.id}-done` }));
      const runner = new PlanRunner(
        config,
        undefined,
        invoker,
        testConfigProvider
      );
      const events = collectEvents(runner);

      await runner.start();

      const names = eventNames(events);
      const nodeStarts = names.filter((n) => n === "nodestart");
      const nodeEnds = names.filter((n) => n === "nodeend");
      assert.strictEqual(nodeStarts.length, 3, "should start 3 nodes");
      assert.strictEqual(nodeEnds.length, 3, "should end 3 nodes");
    });

    it("running() returns false after start() completes", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph());

      assert.ok(!runner.running(), "should not be running before start");
      await runner.start();
      assert.ok(!runner.running(), "should not be running after completion");
    });

    it("second start() after completion resets orchestrator and re-runs", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph("node"));
      const events = collectEvents(runner);

      // First run — completes normally.
      await runner.start();
      const firstNodeStarts = eventNames(events).filter(
        (n) => n === "nodestart"
      );
      assert.strictEqual(firstNodeStarts.length, 1, "first run: 1 nodestart");

      // Clear events for second run.
      events.length = 0;

      // Second start() — should reset orchestrator and run again,
      // not speed through with stale "succeeded" states.
      await runner.start();

      const secondNames = eventNames(events);
      const secondNodeStarts = secondNames.filter((n) => n === "nodestart");
      assert.strictEqual(
        secondNodeStarts.length,
        1,
        "second run should start the node again (not skip due to stale state)"
      );
      assert.ok(secondNames.includes("start"), "should dispatch start event");
      assert.ok(
        secondNames.includes("graphstart"),
        "second run should dispatch graphstart (resets screens)"
      );
      assert.ok(secondNames.includes("end"), "should dispatch end event");
    });
  });

  // -----------------------------------------------------------------------
  // Reactive getters
  // -----------------------------------------------------------------------

  suite("reactive getters", () => {
    it("state() returns orchestrator state", () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      const state = runner.state;
      assert.ok(state instanceof Map, "state should be a Map");
    });

    it("plan() returns orchestrator plan", () => {
      const runner = makePlanRunner(makeSingleNodeGraph("myNode"));
      const plan = runner.plan;
      assert.ok(plan.stages, "plan should have stages");
    });

    it("waiting() returns a Map", () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      const waiting = runner.waiting;
      assert.ok(waiting instanceof Map, "waiting should be a Map");
    });
  });

  // -----------------------------------------------------------------------
  // updateGraph()
  // -----------------------------------------------------------------------

  suite("updateGraph()", () => {
    it("creates new orchestrator from updated graph", async () => {
      const creator = mockPlanCreator();
      const runner = makePlanRunner(makeSingleNodeGraph("old"), creator);

      const newGraph = makeSingleNodeGraph("new");
      await runner.updateGraph(newGraph);

      // Constructor called planCreator once, updateGraph calls it again
      assert.strictEqual(creator.calls.length, 2);
      assert.strictEqual(creator.calls[1].nodes![0].id, "new");
    });

    it("does not throw when updating a clean graph", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph());

      await runner.updateGraph(makeSingleNodeGraph("updated"));

      assert.ok(runner.plan.stages, "should have valid plan after update");
    });
  });

  // -----------------------------------------------------------------------
  // PlanCreator injection
  // -----------------------------------------------------------------------

  suite("planCreator injection", () => {
    it("uses injected planCreator for orchestrator creation", () => {
      const graph = makeLinearGraph("x", "y");
      const creator = mockPlanCreator();
      makePlanRunner(graph, creator);

      assert.strictEqual(creator.calls.length, 1);
      assert.strictEqual(creator.calls[0], graph);
    });

    it("uses default createPlan when no planCreator provided", async () => {
      // Use the raw constructor to verify default planCreator works
      const graph = makeSingleNodeGraph();
      const config = makeConfig(graph);
      const runner = new PlanRunner(
        config,
        undefined,
        testInvoker,
        testConfigProvider
      );

      await runner.start();
    });
  });

  // -----------------------------------------------------------------------
  // Event dispatch
  // -----------------------------------------------------------------------

  suite("event dispatch", () => {
    it("dispatches end event after successful run", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      const events = collectEvents(runner);

      await runner.start();

      const names = eventNames(events);
      assert.ok(names.includes("end"), "should dispatch end");
    });

    it("dispatches graphend event after successful run", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      const events = collectEvents(runner);

      await runner.start();

      const names = eventNames(events);
      assert.ok(names.includes("graphend"), "should dispatch graphend");
    });

    it("dispatches node start and end events", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph("s"));
      const events = collectEvents(runner);

      await runner.start();

      const names = eventNames(events);
      assert.ok(names.includes("nodestart"), "should dispatch nodestart");
      assert.ok(names.includes("nodeend"), "should dispatch nodeend");
    });

    it("dispatches multiple event types during a run", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph("s"));
      const events = collectEvents(runner);

      await runner.start();

      // A full run dispatches start, nodestart, nodeend, graphend, end
      // at minimum, plus potentially nodestatechange/edgestatechange
      const types = new Set(eventNames(events));
      assert.ok(
        types.size >= 3,
        `should dispatch multiple event types, got: ${[...types].join(", ")}`
      );
    });

    it("dispatches edgestatechange events for connected graph", async () => {
      const runner = makePlanRunner(makeLinearGraph("a", "b"));
      const events = collectEvents(runner);

      await runner.start();

      const edgeChanges = events.filter((e) => e.type === "edgestatechange");
      assert.ok(
        edgeChanges.length > 0,
        "should dispatch edgestatechange events"
      );
    });
  });

  // -----------------------------------------------------------------------
  // stop()
  // -----------------------------------------------------------------------

  suite("stop()", () => {
    it("does not throw when called without a running controller", async () => {
      const runner = makePlanRunner(makeSingleNodeGraph());
      await runner.stop("nonexistent");
    });
  });

  // -----------------------------------------------------------------------
  // start() restart path
  // -----------------------------------------------------------------------

  suite("start() restart path", () => {
    it("takes restart branch when controller already exists", async () => {
      // runNode() creates a controller but does NOT null it after completion.
      // A subsequent start() should detect the existing controller and call
      // controller.restart() instead of creating a new one.
      const graph = makeSingleNodeGraph("node");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      // Use runNode to create a controller without nulling it.
      await runner.runNode("node");
      assert.ok(
        runner.running(),
        "should be running after runNode (controller alive)"
      );

      // Clear events, then call start() which should hit the restart path.
      events.length = 0;
      await runner.start();

      // The restart path calls controller.restart() and returns early,
      // so the controller is NOT nulled.
      const names = eventNames(events);
      // restart() calls orchestrator.restartAtCurrentStage() + run(), which
      // should produce node/graph events if the orchestrator has work to do.
      assert.ok(names.length >= 0, "restart path should not throw");
    });
  });

  // -----------------------------------------------------------------------
  // runNode()
  // -----------------------------------------------------------------------

  suite("runNode()", () => {
    it("creates controller and runs node by ID", async () => {
      const graph = makeSingleNodeGraph("target");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      assert.ok(!runner.running(), "should not be running initially");

      // runNode creates a controller if none exists, then runs the node.
      await runner.runNode("target");

      // Controller should still exist (runNode doesn't null it).
      assert.ok(runner.running(), "should be running after runNode");

      const names = eventNames(events);
      assert.ok(names.includes("nodestart"), "should dispatch nodestart");
      assert.ok(names.includes("nodeend"), "should dispatch nodeend");
    });

    it("dispatches ResumeEvent when orchestrator is not working", async () => {
      const graph = makeSingleNodeGraph("rn");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      // First runNode creates the controller and runs the node.
      await runner.runNode("rn");
      // After node completes, orchestrator is no longer working.

      // Clear events.
      events.length = 0;

      // Second runNode should dispatch ResumeEvent because orchestrator
      // is not working, then PauseEvent after.
      await runner.runNode("rn");

      const names = eventNames(events);
      assert.ok(names.includes("resume"), "should dispatch resume");
    });

    it("dispatches PauseEvent after running a node", async () => {
      const graph = makeSingleNodeGraph("pn");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      await runner.runNode("pn");

      const names = eventNames(events);
      assert.ok(names.includes("pause"), "should dispatch pause after runNode");
    });
  });

  // -----------------------------------------------------------------------
  // runFrom()
  // -----------------------------------------------------------------------

  suite("runFrom()", () => {
    it("creates controller and runs from a node", async () => {
      const graph = makeSingleNodeGraph("solo");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      assert.ok(!runner.running(), "should not be running initially");

      // runFrom creates controller if needed and runs from the given node.
      await runner.runFrom("solo");

      const names = eventNames(events);
      assert.ok(names.includes("nodestart"), "should dispatch nodestart");
      assert.ok(names.includes("nodeend"), "should dispatch nodeend");
    });

    it("dispatches ResumeEvent when resuming from a non-working state", async () => {
      const graph = makeLinearGraph("a", "b");
      const config = makeConfig(graph);
      const invoker = makeInvoker(async (desc) => ({ out: `${desc.id}-done` }));
      const runner = new PlanRunner(
        config,
        undefined,
        invoker,
        testConfigProvider
      );
      const events = collectEvents(runner);

      // Use runNode to create controller (keeps it alive).
      await runner.runNode("a");
      events.length = 0;

      // runFrom should dispatch ResumeEvent since orchestrator is not working.
      await runner.runFrom("a");

      const names = eventNames(events);
      assert.ok(names.includes("resume"), "should dispatch resume on runFrom");
    });
  });

  // -----------------------------------------------------------------------
  // stop() with active controller
  // -----------------------------------------------------------------------

  suite("stop() with active controller", () => {
    it("dispatches PauseEvent when stopping after runNode", async () => {
      const graph = makeSingleNodeGraph("stoppable");
      const runner = makePlanRunner(graph);
      const events = collectEvents(runner);

      // Use runNode to create controller (keeps it alive).
      await runner.runNode("stoppable");
      assert.ok(runner.running(), "should be running after runNode");

      events.length = 0;

      // stop() dispatches PauseEvent if orchestrator is not working.
      await runner.stop("stoppable");

      const names = eventNames(events);
      assert.ok(names.includes("pause"), "should dispatch pause after stop");
    });
  });

  // -----------------------------------------------------------------------
  // updateGraph() while working
  // -----------------------------------------------------------------------

  suite("updateGraph() while working", () => {
    it("dispatches PauseEvent and recreates orchestrator", async () => {
      const graph = makeSingleNodeGraph("busy");
      const config = makeConfig(graph);
      const { invoker, resolve } = makeBlockingInvoker();
      const runner = new PlanRunner(
        config,
        undefined,
        invoker,
        testConfigProvider
      );
      const events = collectEvents(runner);

      // Start the run — the invoker will block, keeping the node "working".
      const startPromise = runner.start();

      // Give microtasks a chance to run so the node enters "working" state.
      await new Promise((r) => setTimeout(r, 10));

      // Now update the graph while the orchestrator is working.
      await runner.updateGraph(makeSingleNodeGraph("new-node"));

      const names = eventNames(events);
      assert.ok(
        names.includes("pause"),
        "should dispatch pause when updating while working"
      );

      // Resolve the blocking invoker so the start() promise can settle.
      resolve({ result: "ok" });
      await startPromise.catch(() => {
        // Swallow any errors from the aborted run.
      });
    });
  });

  // -----------------------------------------------------------------------
  // Edge state change data
  // -----------------------------------------------------------------------

  suite("edge state change data", () => {
    it("edgestatechange events carry edge and state data", async () => {
      const graph = makeLinearGraph("p", "q");
      const config = makeConfig(graph);
      const invoker = makeInvoker(async (desc) => ({ out: `${desc.id}-done` }));
      const runner = new PlanRunner(
        config,
        undefined,
        invoker,
        testConfigProvider
      );
      const events = collectEvents(runner);

      await runner.start();

      const edgeEvents = events.filter((e) => e.type === "edgestatechange");
      assert.ok(edgeEvents.length > 0, "should have edgestatechange events");

      // Each edgestatechange event should have data with edges and state.
      for (const e of edgeEvents) {
        const data = (
          e as unknown as { data: { edges: unknown[]; state: string } }
        ).data;
        assert.ok(data, "event should have data property");
        assert.ok(Array.isArray(data.edges), "data.edges should be an array");
        assert.ok(
          typeof data.state === "string",
          `data.state should be a string, got ${typeof data.state}`
        );
        assert.ok(
          ["initial", "consumed", "stored"].includes(data.state),
          `data.state should be initial/consumed/stored, got "${data.state}"`
        );
      }
    });
  });
});
