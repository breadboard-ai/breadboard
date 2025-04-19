/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { emptyDescriberResult, filterEmptyValues } from "./inspector/utils.js";
import { resolveGraph } from "./loader/loader.js";
import { invokeGraph } from "./run/invoke-graph.js";
import { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
import { invokeDescriber } from "./sandbox/invoke-describer.js";
import {
  GraphDescriptor,
  GraphToRun,
  InputValues,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeHandlerObject,
  NodeTypeIdentifier,
  Schema,
} from "./types.js";
import { MutableGraph } from "./inspector/types.js";

export {
  GraphBasedNodeHandler,
  toNodeHandlerMetadata,
  describerResultToNodeHandlerMetadata,
};

class GraphBasedNodeHandler implements NodeHandlerObject {
  #graph: GraphToRun;
  #type: NodeTypeIdentifier;
  #descriptor: GraphDescriptor;

  constructor(graph: GraphToRun, type: NodeTypeIdentifier) {
    this.#graph = graph;
    this.#type = type;
    this.#descriptor = resolveGraph(graph);
    this.invoke = this.invoke.bind(this);
    this.describe = this.describe.bind(this);
  }

  async invoke(inputs: InputValues, context: NodeHandlerContext) {
    const base = context.board?.url && new URL(context.board?.url);
    const invocationContext = base
      ? {
          ...context,
          base,
        }
      : { ...context };

    return await invokeGraph(this.#graph, inputs, invocationContext);
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
      const adding = graphStore.addByDescriptor(this.#graph.graph);
      if (!adding.success) {
        return emptyDescriberResult();
      }
      mutable = graphStore.get(adding.result)!;
    }
    if (this.#graph.moduleId) {
      const moduleId = this.#graph.moduleId;
      const graph = this.#graph.graph;
      const sandbox = context.graphStore?.sandbox;
      if (!sandbox) {
        console.warn("Sandbox was not supplied to describe node type");
        return emptyDescriberResult();
      }
      const result = await invokeDescriber(
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
