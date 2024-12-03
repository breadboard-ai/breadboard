/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveGraph } from "./loader/loader.js";
import { invokeGraph } from "./run/invoke-graph.js";
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
import { hash } from "./utils/hash.js";
import { Throttler } from "./utils/throttler.js";

export { GraphBasedNodeHandler, toNodeHandlerMetadata };

type NodeDescriberThrottler = Throttler<
  [InputValues | undefined, GraphDescriptor, NodeDescriberContext],
  NodeDescriberResult
>;

type DescribeThrottlerWithHash = {
  throttler: NodeDescriberThrottler;
  hash: number;
};

const DESCRIBE_THROTTLE_DELAY = 5000;
const DESCRIBE_RESULT_CACHE = new Map<
  NodeTypeIdentifier,
  DescribeThrottlerWithHash
>();

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
    _inputSchema?: Schema,
    _outputSchema?: Schema,
    context?: NodeDescriberContext
  ) {
    if (!context) {
      return { inputSchema: {}, outputSchema: {} };
    }
    const inputsHash = hash(inputs);
    let describeThrottler = DESCRIBE_RESULT_CACHE.get(this.#type);
    if (!describeThrottler || describeThrottler.hash !== inputsHash) {
      describeThrottler = {
        throttler: new Throttler(describeGraph, DESCRIBE_THROTTLE_DELAY),
        hash: inputsHash,
      };

      DESCRIBE_RESULT_CACHE.set(this.#type, describeThrottler);
    }
    return describeThrottler.throttler.call(
      {},
      inputs,
      this.#descriptor,
      context
    );
  }

  get metadata() {
    return toNodeHandlerMetadata(this.#descriptor);
  }
}

function toNodeHandlerMetadata(graph: GraphDescriptor): NodeHandlerMetadata {
  return filterEmptyValues({
    title: graph.title,
    description: graph.description,
    url: graph.url,
    icon: graph.metadata?.icon,
    help: graph.metadata?.help,
  });
}

async function describeGraph(
  inputs: InputValues | undefined,
  graph: GraphDescriptor,
  context: NodeDescriberContext
) {
  const graphStore = context?.graphStore;
  if (!graphStore) {
    return emptyDescriberResult();
  }
  const adding = graphStore.addByDescriptor(graph);
  if (!adding.success) {
    return emptyDescriberResult();
  }
  const inspectableGraph = graphStore.inspect(adding.result, "");
  if (!inspectableGraph) {
    return emptyDescriberResult();
  }
  const result = await inspectableGraph.describe(inputs);
  return result;
}

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => !!value)
  ) as T;
}

function emptyDescriberResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}
