/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditableGraph,
  EditableGraphOptions,
  GraphDescriptor,
  GraphIdentifier,
  GraphStoreArgs,
  MutableGraph,
  MutableGraphStore,
  NodeDescriptor,
  NodeDescribeSnapshot,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import { Graph as GraphEditor } from "../src/engine/editor/graph.js";
import { Graph as InspectableGraphImpl } from "../src/engine/inspector/graph/graph.js";
import { Node } from "../src/engine/inspector/graph/node.js";

export { HeadlessGraphEditor };

const genericSnapshot: NodeDescribeSnapshot = {
  current: {
    inputSchema: { type: "object" },
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object" },
          title: "Context out",
          behavior: ["main-port"],
        },
      },
    },
  },
  latest: Promise.resolve({
    inputSchema: { type: "object" },
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object" },
          title: "Context out",
          behavior: ["main-port"],
        },
      },
    },
  }),
  updating: false,
};

function makeTestGraphStoreArgs(
  options: EditableGraphOptions = {}
): GraphStoreArgs {
  return {
    sandbox: options.sandbox || {},
    loader: options.loader || {
      load() {
        throw new Error("Do not load graphs in headless mode");
      },
    },
    flags: {
      env: () => {
        throw new Error("Do not use flags in headless mode");
      },
      overrides: () => {
        throw new Error("Do not use flags in headless mode");
      },
      flags: () => {
        throw new Error("Do not use flags in headless mode");
      },
      override() {
        throw new Error("Do not use flags in headless mode");
      },
      clearOverride() {
        throw new Error("Do not use flags in headless mode");
      },
    } satisfies RuntimeFlagManager,
  };
}

function makeTestGraphStore(
  _args: GraphStoreArgs
): MutableGraphStore {
  let mutableGraph: MutableGraph | undefined;
  const store = {
    set(graph: MutableGraph): void {
      mutableGraph = graph;
    },
    get(): MutableGraph | undefined {
      return mutableGraph;
    },
  };
  return store;
}

function createMutableGraph(
  graph: GraphDescriptor,
  store: MutableGraphStore,
  deps: GraphStoreArgs
): MutableGraph {
  function graphNodes(graphId: GraphIdentifier): NodeDescriptor[] {
    if (!graphId) return mutable.graph.nodes;
    return mutable.graph.graphs?.[graphId]?.nodes || [];
  }

  function buildNodeAccessor() {
    return {
      get: (id: string, graphId: string) => {
        const descriptor = graphNodes(graphId).find((n) => n.id === id);
        return descriptor
          ? new Node(descriptor, mutable as MutableGraph, graphId)
          : undefined;
      },
      nodes: (graphId: string) =>
        graphNodes(graphId).map(
          (n) => new Node(n, mutable as MutableGraph, graphId)
        ),
      byType: (type: string, graphId: string) =>
        graphNodes(graphId)
          .filter((n) => n.type === type)
          .map((n) => new Node(n, mutable as MutableGraph, graphId)),
    };
  }

  const mutable = {
    graph,
    id: crypto.randomUUID(),
    deps,
    store,
    graphs: null! as MutableGraph["graphs"],
    nodes: null! as MutableGraph["nodes"],

    describeNode(): NodeDescribeSnapshot {
      return genericSnapshot;
    },

    update(graph: GraphDescriptor, _visualOnly: boolean): void {
      mutable.graph = graph;
    },

    rebuild(graph: GraphDescriptor): void {
      mutable.graph = graph;
      mutable.graphs = {
        get: (id: GraphIdentifier) => new InspectableGraphImpl(id, mutable as MutableGraph),
        graphs: () =>
          Object.fromEntries(
            Object.keys(mutable.graph.graphs || {}).map((id) => [
              id,
              new InspectableGraphImpl(id, mutable as MutableGraph),
            ])
          ),
      };
      mutable.nodes = buildNodeAccessor();
    },
  };

  mutable.rebuild(graph);
  return mutable as MutableGraph;
}

class HeadlessGraphEditor {
  static create(
    graph: GraphDescriptor,
    options: EditableGraphOptions = {}
  ): EditableGraph {
    const args = makeTestGraphStoreArgs(options);
    const store = makeTestGraphStore(args);
    const mutable = createMutableGraph(graph, store, args);
    return new GraphEditor(mutable, options);
  }
}
