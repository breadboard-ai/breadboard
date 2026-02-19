/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared test helpers for runtime harness tests.
 *
 * Provides factory functions for creating mock graphs, configs,
 * event sinks, invokers, and config providers used across
 * RunStateController and PlanRunner test suites.
 */

import type {
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  RunConfig,
  InputValues,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";
import type {
  NodeInvoker,
  RunEventSink,
  ConfigProvider,
} from "../src/engine/types.js";

export {
  makeNode,
  makeLinearGraph,
  makeSingleNodeGraph,
  makeConfig,
  makeEventSink,
  makeInvoker,
  makeBlockingInvoker,
  makeConfigProvider,
  noopCallbacks,
  eventsByType,
};

/** A minimal node descriptor for testing. */
function makeNode(id: string, type = "test"): NodeDescriptor {
  return { id, type };
}

/**
 * Build a trivial graph with N sequential nodes: A → B → C → ...
 * This produces a valid `GraphDescriptor` that `createPlan` can consume.
 */
function makeLinearGraph(...nodeIds: string[]): GraphDescriptor {
  const nodes = nodeIds.map((id) => makeNode(id));
  const edges = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push({ from: nodeIds[i], to: nodeIds[i + 1], out: "out", in: "in" });
  }
  return { nodes, edges, url: "test://graph" } as GraphDescriptor;
}

/** Build a graph with a single node */
function makeSingleNodeGraph(id = "only"): GraphDescriptor {
  return {
    nodes: [makeNode(id)],
    edges: [],
    url: "test://single",
  } as GraphDescriptor;
}

/** Build a mock RunConfig. Most fields are optional. */
function makeConfig(graph: GraphDescriptor): RunConfig {
  return {
    url: graph.url || "test://graph",
    runner: graph,
  } as RunConfig;
}

/** Create a mock RunEventSink that records dispatched events. */
function makeEventSink(): RunEventSink & {
  events: Event[];
  paused: boolean;
} {
  const sink = {
    events: [] as Event[],
    paused: false,
    dispatch(event: Event) {
      sink.events.push(event);
    },
    pause() {
      sink.paused = true;
    },
  };
  return sink;
}

/** Create a mock NodeInvoker. */
function makeInvoker(
  outputsFn?: (
    descriptor: NodeDescriptor,
    inputs: InputValues
  ) => Promise<OutputValues>
): NodeInvoker {
  const defaultFn = async () => ({ result: "ok" });
  return {
    invokeNode: async (
      _args: RunArguments,
      descriptor: NodeDescriptor,
      inputs: InputValues
    ) => {
      return (outputsFn || defaultFn)(descriptor, inputs);
    },
  };
}

/**
 * Create a blocking invoker whose promise can be externally resolved.
 * Useful for testing behavior while nodes are still "working".
 *
 * Returns the invoker plus `resolve` / `reject` functions to control it.
 */
function makeBlockingInvoker(): {
  invoker: NodeInvoker;
  resolve: (outputs?: OutputValues) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (outputs?: OutputValues) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<OutputValues | undefined>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    invoker: {
      invokeNode: async () => {
        const outputs = await promise;
        return outputs ?? { result: "ok" };
      },
    },
    resolve,
    reject,
  };
}

/** Create a mock ConfigProvider that returns node configuration. */
function makeConfigProvider(
  configs?: Record<string, Record<string, unknown>>
): ConfigProvider {
  return (id: string) => {
    return (configs?.[id] ?? {}) as NodeConfiguration;
  };
}

/** Get the no-op orchestrator callbacks */
function noopCallbacks() {
  return {
    stateChangedbyOrchestrator: () => {},
    stateChanged: () => {},
  };
}

/** Filter events by constructor name */
function eventsByType(events: Event[], typeName: string): Event[] {
  return events.filter((e) => e.constructor.name === typeName);
}
