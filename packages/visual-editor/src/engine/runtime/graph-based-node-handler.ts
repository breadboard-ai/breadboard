/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphToRun,
  InputValues,
  MutableGraph,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeHandlerObject,
  NodeTypeIdentifier,
  Schema,
} from "@breadboard-ai/types";
import {
  emptyDescriberResult,
  filterEmptyValues,
  graphUrlLike,
} from "@breadboard-ai/utils";
import { getGraphUrl } from "../loader/loader.js";
import { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
import { invokeDescriber } from "./sandbox/invoke-describer.js";

export {
  describerResultToNodeHandlerMetadata,
  getGraphHandlerFromMutableGraph,
  GraphBasedNodeHandler,
  toNodeHandlerMetadata,
};

class GraphBasedNodeHandler implements NodeHandlerObject {
  #graph: GraphToRun;
  #type: NodeTypeIdentifier;

  constructor(graph: GraphToRun, type: NodeTypeIdentifier) {
    this.#graph = graph;
    this.#type = type;
    this.invoke = this.invoke.bind(this);
    this.describe = this.describe.bind(this);
  }

  async invoke(_inputs: InputValues, _context: NodeHandlerContext) {
    throw new Error(
      `Graph-based component execution is no longer supported for type "${this.#type}"`
    );
  }

  async describe(
    inputs?: InputValues,
    inputSchema?: Schema,
    outputSchema?: Schema,
    context?: NodeDescriberContext
  ) {
    if (!context) {
      return { inputSchema: {}, outputSchema: {} };
    }

    const graphStore = context?.graphStore;
    if (!graphStore) {
      return emptyDescriberResult();
    }
    const url = this.#graph.graph.url;
    let mutable: MutableGraph;
    if (url) {
      // In the most common case, just use the URL of the graph.
      const adding = graphStore.addByURL(url, [], context);
      mutable = adding.mutable;
    } else {
      const adding = graphStore.getByDescriptor(this.#graph.graph);
      if (!adding.success) {
        return emptyDescriberResult();
      }
      mutable = graphStore.get(adding.result)!;
    }
    mutable = await graphStore.getLatest(mutable);
    if (this.#graph.moduleId) {
      const moduleId = this.#graph.moduleId;
      const graph = this.#graph.graph;
      const sandbox = context.graphStore?.sandbox;
      if (!sandbox) {
        console.warn("Sandbox was not supplied to describe node type");
        return emptyDescriberResult();
      }
      const result = await invokeDescriber(
        context,
        moduleId,
        mutable,
        graph,
        inputs || {},
        inputSchema,
        outputSchema,
        new CapabilitiesManagerImpl(context),
        context.asType || false
      );
      if (!result) {
        return emptyDescriberResult();
      }
      return result;
    } else {
      const inspectableGraph = graphStore.inspect(
        mutable.id,
        this.#graph.subGraphId || ""
      );
      if (!inspectableGraph) {
        return emptyDescriberResult();
      }
      const result = await inspectableGraph.describe(inputs, context);
      return result;
    }
  }

  get metadata() {
    return toNodeHandlerMetadata(this.#graph, this.#type, false);
  }
}

function describerResultToNodeHandlerMetadata(
  result: NodeDescriberResult,
  updating: boolean
): NodeHandlerMetadata {
  return filterEmptyValues({
    title: result.title,
    description: result.description,
    url: result.url,
    icon: result.metadata?.icon,
    help: result.metadata?.help,
    updating,
  });
}

function toNodeHandlerMetadata(
  graphToRun: GraphToRun,
  url: NodeTypeIdentifier,
  updating: boolean
): NodeHandlerMetadata | undefined {
  const graph = graphToRun.graph;
  if (graphToRun.moduleId) {
    const module = graph.modules?.[graphToRun.moduleId];
    if (!module) return undefined;
    const {
      title = graphToRun.moduleId,
      description,
      icon,
      help,
    } = module.metadata || {};
    return filterEmptyValues({ title, description, url, icon, help, updating });
  } else if (graphToRun.subGraphId) {
    const descriptor = graph.graphs?.[graphToRun.subGraphId];
    if (!descriptor) return undefined;
    return filterEmptyValues({
      title: descriptor.title,
      description: descriptor.description,
      url,
      icon: descriptor.metadata?.icon,
      help: descriptor.metadata?.help,
      updating,
    });
  } else {
    return filterEmptyValues({
      title: graph.title,
      description: graph.description,
      url: graph.url,
      icon: graph.metadata?.icon,
      help: graph.metadata?.help,
      updating,
    });
  }
}

function contextFromMutableGraph(mutable: MutableGraph): NodeHandlerContext {
  const store = mutable.store;
  return {
    kits: [...store.kits],
    loader: store.loader,
    sandbox: store.sandbox,
    graphStore: store,
    outerGraph: mutable.graph,
  };
}

async function getGraphHandlerFromMutableGraph(
  type: NodeTypeIdentifier,
  mutable: MutableGraph
): Promise<NodeHandlerObject | undefined> {
  const nodeTypeUrl = graphUrlLike(type)
    ? getGraphUrl(type, contextFromMutableGraph(mutable))
    : undefined;
  if (!nodeTypeUrl) {
    return undefined;
  }
  const store = mutable.store;
  const result = store.addByURL(type, [], {
    outerGraph: mutable.graph,
  });
  const latest = await store.getLatest(result.mutable);
  return new GraphBasedNodeHandler(
    {
      graph: latest.graph,
      subGraphId: result.graphId,
      moduleId: result.moduleId,
    },
    type
  );
}
