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
      assert.ok(names.includes("end"), "should dispatch end");
      assert.ok(
        names.indexOf("start") < names.indexOf("end"),
        "start should precede end"
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
});
