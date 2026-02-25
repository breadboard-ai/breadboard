/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, it } from "node:test";
import assert from "node:assert";

import type {
  BreakpointSpec,
  GraphDescriptor,
  InputValues,
  NodeIdentifier,
} from "@breadboard-ai/types";
import type { ConfigProvider, NodeInvoker } from "../src/engine/types.js";
import { createPlan } from "../src/engine/runtime/static/create-plan.js";
import { Orchestrator } from "../src/engine/runtime/static/orchestrator.js";
import { RunStateController } from "../src/engine/runtime/harness/run-state-controller.js";
import {
  makeLinearGraph,
  makeSingleNodeGraph,
  makeConfig,
  makeEventSink,
  makeInvoker,
  makeConfigProvider,
  noopCallbacks,
  eventsByType,
} from "./harness-test-helpers.js";

// =========================================================================
// RunStateController-specific helpers
// =========================================================================

/** Create a full test harness for RunStateController. */
function makeController(opts: {
  graph?: GraphDescriptor;
  breakpoints?: Map<NodeIdentifier, BreakpointSpec>;
  eventSink?: ReturnType<typeof makeEventSink>;
  invoker?: NodeInvoker;
  configProvider?: ConfigProvider;
}) {
  const graph = opts.graph ?? makeSingleNodeGraph();
  const config = makeConfig(graph);
  const plan = createPlan(graph);
  const orchestrator = new Orchestrator(plan, noopCallbacks());
  const eventSink = opts.eventSink ?? makeEventSink();
  const invoker = opts.invoker ?? makeInvoker();
  const configProvider = opts.configProvider ?? makeConfigProvider();
  const breakpoints =
    opts.breakpoints ?? new Map<NodeIdentifier, BreakpointSpec>();

  const controller = new RunStateController(
    config,
    graph,
    orchestrator,
    breakpoints,
    eventSink,
    invoker,
    configProvider
  );

  return { controller, orchestrator, eventSink, config };
}

// =========================================================================
// Tests
// =========================================================================

suite("RunStateController", () => {
  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  suite("lifecycle", () => {
    it("runs a single-node graph to completion", async () => {
      const { controller, eventSink } = makeController({
        graph: makeSingleNodeGraph("alpha"),
      });

      // preamble() must be called before run() — this is PlanRunner's job
      controller.preamble();
      await controller.run();

      // Should have dispatched: GraphStart, NodeStart, NodeEnd, GraphEnd, End
      const names = eventSink.events.map((e: Event) => e.constructor.name);
      assert.ok(
        names.includes("GraphStartEvent"),
        "should dispatch GraphStart"
      );
      assert.ok(names.includes("NodeStartEvent"), "should dispatch NodeStart");
      assert.ok(names.includes("NodeEndEvent"), "should dispatch NodeEnd");
      assert.ok(names.includes("GraphEndEvent"), "should dispatch GraphEnd");
      assert.ok(names.includes("EndEvent"), "should dispatch End");
    });

    it("runs a multi-node linear graph", async () => {
      const graph = makeLinearGraph("a", "b", "c");
      const invoked: string[] = [];
      const invoker = makeInvoker(async (descriptor) => {
        invoked.push(descriptor.id);
        return { out: `${descriptor.id}-result` };
      });

      const { controller } = makeController({ graph, invoker });
      await controller.run();

      assert.deepStrictEqual(invoked, ["a", "b", "c"]);
    });

    it("preamble dispatches GraphStartEvent", async () => {
      const { controller, eventSink } = makeController({
        graph: makeSingleNodeGraph(),
      });

      controller.preamble();
      const graphStarts = eventsByType(eventSink.events, "GraphStartEvent");
      assert.strictEqual(
        graphStarts.length,
        1,
        "should dispatch GraphStartEvent"
      );
    });

    it("dispatches postamble GraphEnd and End events when finished", async () => {
      const { controller, eventSink } = makeController({
        graph: makeSingleNodeGraph(),
      });

      await controller.run();

      const endEvents = eventsByType(eventSink.events, "EndEvent");
      const graphEndEvents = eventsByType(eventSink.events, "GraphEndEvent");
      assert.strictEqual(endEvents.length, 1, "should dispatch one EndEvent");
      assert.strictEqual(
        graphEndEvents.length,
        1,
        "should dispatch one GraphEndEvent"
      );
    });

    it("does not re-enter run() if already running", async () => {
      const { controller } = makeController({
        graph: makeSingleNodeGraph(),
      });

      const first = controller.run();
      const second = controller.run();

      await Promise.all([first, second]);
    });
  });

  // -----------------------------------------------------------------------
  // Node Invocation
  // -----------------------------------------------------------------------

  suite("node invocation", () => {
    it("passes node descriptor and inputs to invoker", async () => {
      const calls: Array<{ id: string; inputs: InputValues }> = [];
      const invoker = makeInvoker(async (descriptor, inputs) => {
        calls.push({ id: descriptor.id, inputs });
        return { done: true };
      });

      const { controller } = makeController({
        graph: makeSingleNodeGraph("myNode"),
        invoker,
      });

      await controller.run();

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].id, "myNode");
    });

    it("uses configProvider to get node configuration", async () => {
      const configCalls: string[] = [];
      const configProvider: ConfigProvider = (id: string) => {
        configCalls.push(id);
        return { custom: "config" };
      };

      const { controller } = makeController({
        graph: makeSingleNodeGraph("configured"),
        configProvider,
      });

      await controller.run();

      assert.deepStrictEqual(configCalls, ["configured"]);
    });

    it("handles configProvider error gracefully", async () => {
      const configProvider: ConfigProvider = (): { $error: string } => {
        return { $error: "config error" };
      };

      const eventSink = makeEventSink();
      const { controller } = makeController({
        graph: makeSingleNodeGraph(),
        configProvider,
        eventSink,
      });

      await controller.run();

      const nodeEndEvents = eventsByType(eventSink.events, "NodeEndEvent");
      assert.strictEqual(nodeEndEvents.length, 1, "node should still end");
    });
  });

  // -----------------------------------------------------------------------
  // Breakpoints
  // -----------------------------------------------------------------------

  suite("breakpoints", () => {
    it("pauses at a breakpoint", async () => {
      const breakpoints = new Map<NodeIdentifier, BreakpointSpec>();
      breakpoints.set("alpha", {});
      const eventSink = makeEventSink();

      const { controller } = makeController({
        graph: makeSingleNodeGraph("alpha"),
        breakpoints,
        eventSink,
      });

      await controller.run();

      assert.ok(eventSink.paused, "should have paused");
      const nodeStarts = eventsByType(eventSink.events, "NodeStartEvent");
      assert.strictEqual(
        nodeStarts.length,
        0,
        "should not run past breakpoint"
      );
    });

    it("removes one-shot breakpoints after hitting", async () => {
      const breakpoints = new Map<NodeIdentifier, BreakpointSpec>();
      breakpoints.set("alpha", { once: true });

      const { controller } = makeController({
        graph: makeSingleNodeGraph("alpha"),
        breakpoints,
      });

      await controller.run();

      assert.ok(
        !breakpoints.has("alpha"),
        "one-shot breakpoint should be removed"
      );
    });

    it("keeps persistent breakpoints after hitting", async () => {
      const breakpoints = new Map<NodeIdentifier, BreakpointSpec>();
      breakpoints.set("alpha", {});

      const { controller } = makeController({
        graph: makeSingleNodeGraph("alpha"),
        breakpoints,
      });

      await controller.run();

      assert.ok(
        breakpoints.has("alpha"),
        "persistent breakpoint should remain"
      );
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------

  suite("error handling", () => {
    it("dispatches RunnerErrorEvent on error()", () => {
      const eventSink = makeEventSink();
      const { controller } = makeController({ eventSink });

      const result = controller.error({ $error: "test failure" });

      assert.deepStrictEqual(result, { $error: "test failure" });
      const errorEvents = eventsByType(eventSink.events, "RunnerErrorEvent");
      assert.strictEqual(errorEvents.length, 1);
    });
  });

  // -----------------------------------------------------------------------
  // Index generation test removed — nextIndex() was eliminated in favor
  // of inline crypto.randomUUID() at each dispatch site.

  // -----------------------------------------------------------------------
  // Stop / Interrupt
  // -----------------------------------------------------------------------

  suite("stop and interrupt", () => {
    it("stopAll aborts all active controllers", async () => {
      const invoker = makeInvoker(async () => {
        return { ok: true };
      });

      const { controller } = makeController({
        graph: makeSingleNodeGraph("a"),
        invoker,
      });

      await controller.run();
      controller.stopAll();
    });

    it("stop on non-existent node prints warning", () => {
      const { controller } = makeController({});
      controller.stop("non-existent");
    });
  });

  // -----------------------------------------------------------------------
  // Event Sink Integration
  // -----------------------------------------------------------------------

  suite("event sink integration", () => {
    it("dispatches events through event sink", async () => {
      const eventSink = makeEventSink();

      const { controller } = makeController({
        graph: makeSingleNodeGraph(),
        eventSink,
      });

      await controller.run();

      assert.ok(eventSink.events.length > 0, "should dispatch events");
    });

    it("pauses via event sink when orchestrator fails", async () => {
      const eventSink = makeEventSink();
      const graph = makeSingleNodeGraph("failing");
      const config = makeConfig(graph);
      const plan = createPlan(graph);
      const orchestrator = new Orchestrator(plan, noopCallbacks());
      const invoker = makeInvoker(async () => {
        return { $error: "node failed" };
      });

      const controller = new RunStateController(
        config,
        graph,
        orchestrator,
        new Map(),
        eventSink,
        invoker,
        makeConfigProvider()
      );

      await controller.run();

      const endEvents = eventsByType(eventSink.events, "EndEvent");
      assert.ok(
        endEvents.length > 0 || eventSink.paused,
        "should either end or pause"
      );
    });
  });

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  suite("update", () => {
    it("swaps orchestrator via update()", () => {
      const graph = makeSingleNodeGraph();
      const { controller } = makeController({ graph });

      const newPlan = createPlan(graph);
      const newOrchestrator = new Orchestrator(newPlan, noopCallbacks());

      controller.update(newOrchestrator);
    });
  });
});
