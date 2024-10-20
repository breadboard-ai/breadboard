/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inspect } from "./inspector/index.js";
import { SENTINEL_BASE_URL } from "./loader/loader.js";
import { invokeGraph } from "./run/invoke-graph.js";
import type {
  GraphDescriptor,
  InputValues,
  Kit,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
  NodeHandlerObject,
  NodeHandlers,
  NodeTypeIdentifier,
  OutputValues,
} from "./types.js";
import { graphUrlLike } from "./utils/graph-url-like.js";
import { hash } from "./utils/hash.js";
import { Throttler } from "./utils/throttler.js";

const getHandlerFunction = (handler: NodeHandler): NodeHandlerFunction => {
  if ("invoke" in handler && handler.invoke) return handler.invoke;
  if (handler instanceof Function) return handler;
  throw new Error("Invalid handler");
};

export const callHandler = async (
  handler: NodeHandler,
  inputs: InputValues,
  context: NodeHandlerContext
): Promise<OutputValues | void> => {
  // if (handler instanceof Function) return handler(inputs, context);
  // if (handler.invoke) return handler.invoke(inputs, context);
  const handlerFunction = getHandlerFunction(handler);
  return new Promise((resolve) => {
    handlerFunction(inputs, context)
      .then(resolve)
      .catch((error) => {
        resolve({ $error: { error } });
      });
  });
};

export const handlersFromKits = (kits: Kit[]): NodeHandlers => {
  return kits.reduce((handlers, kit) => {
    // If multiple kits have the same handler, the kit earlier in the list
    // gets precedence, including upstream kits getting precedence over kits
    // defined in the graph.
    //
    // TODO: This means kits are fallback, consider non-fallback as well.
    return { ...kit.handlers, ...handlers };
  }, {} as NodeHandlers);
};

/**
 * The single entry point for getting a handler for a node type.
 * The handler can be one of the two types:
 * - A graph-based handler, where the `type` is actually a
 *   URL-like string that points to a graph.
 * - A kit-based handler, where the `type` is a string that
 *   corresponds to a node type in a kit.
 *
 * The function throws an error if no handler is found for the
 * given node type.
 *
 * @param type    -- The node type to get a handler for.
 * @param context -- The context in which the handler is
 *                   being requested.
 * @returns       -- The handler for the node type.
 */
export async function getHandler(
  type: NodeTypeIdentifier,
  context: NodeHandlerContext
): Promise<NodeHandler> {
  if (graphUrlLike(type)) {
    const graphHandler = await getGraphHandler(type, context);
    if (graphHandler) {
      return graphHandler;
    }
  }
  const handlers = handlersFromKits(context.kits ?? []);
  const kitHandler = handlers[type];
  if (kitHandler) {
    return kitHandler;
  }
  throw new Error(`No handler for node type "${type}"`);
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

type GraphHandlerThrottler = Throttler<
  [NodeTypeIdentifier, NodeHandlerContext],
  NodeHandlerObject | undefined
>;

type NodeDescriberThrottler = Throttler<
  [InputValues | undefined, GraphDescriptor, NodeDescriberContext],
  NodeDescriberResult
>;

const HANDLER_THROTTLE_DELAY = 10000;
const DESCRIBE_THROTTLE_DELAY = 5000;

const GRAPH_HANDLER_CACHE = new Map<
  NodeTypeIdentifier,
  GraphHandlerThrottler
>();

type DescribeThrottlerWithHash = {
  throttler: NodeDescriberThrottler;
  hash: number;
};

const DESCRIBE_RESULT_CACHE = new Map<
  NodeTypeIdentifier,
  DescribeThrottlerWithHash
>();

export async function getGraphHandler(
  type: NodeTypeIdentifier,
  context: NodeHandlerContext
): Promise<NodeHandlerObject | undefined> {
  let throttler;
  if (!GRAPH_HANDLER_CACHE.has(type)) {
    throttler = new Throttler(getGraphHandlerInternal, HANDLER_THROTTLE_DELAY);
    GRAPH_HANDLER_CACHE.set(type, throttler);
  } else {
    throttler = GRAPH_HANDLER_CACHE.get(type)!;
  }
  return throttler.call({}, type, context);
}

async function getGraphHandlerInternal(
  type: NodeTypeIdentifier,
  context: NodeHandlerContext
): Promise<NodeHandlerObject | undefined> {
  const { base = SENTINEL_BASE_URL } = context;
  const nodeTypeUrl = graphUrlLike(type) ? new URL(type, base) : undefined;
  if (!nodeTypeUrl) {
    return undefined;
  }
  const { loader } = context;
  if (!loader) {
    throw new Error(`Cannot load graph for type "${type}" without a loader.`);
  }
  const graph = await loader.load(type, context);
  if (!graph) {
    throw new Error(`Cannot load graph for type "${type}"`);
  }
  return {
    invoke: async (inputs, context) => {
      const base = context.board?.url && new URL(context.board?.url);
      const invocationContext = base
        ? {
            ...context,
            base,
          }
        : { ...context };

      return await invokeGraph(graph, inputs, invocationContext);
    },
    describe: async (inputs, _inputSchema, _outputSchema, context) => {
      if (!context) {
        return { inputSchema: {}, outputSchema: {} };
      }
      const inputsHash = hash(inputs);
      let describeThrottler = DESCRIBE_RESULT_CACHE.get(type);
      if (!describeThrottler || describeThrottler.hash !== inputsHash) {
        describeThrottler = {
          throttler: new Throttler(describeGraph, DESCRIBE_THROTTLE_DELAY),
          hash: inputsHash,
        };

        DESCRIBE_RESULT_CACHE.set(type, describeThrottler);
      }
      return describeThrottler.throttler.call({}, inputs, graph, context);
    },
    metadata: filterEmptyValues({
      title: graph.title,
      description: graph.description,
      url: graph.url,
      icon: graph.metadata?.icon,
      help: graph.metadata?.help,
    }),
  } as NodeHandlerObject;
}

async function describeGraph(
  inputs: InputValues | undefined,
  graph: GraphDescriptor,
  context: NodeDescriberContext
) {
  const inspectableGraph = inspect(graph, context);
  const result = await inspectableGraph.describe(inputs);
  return result;
}
