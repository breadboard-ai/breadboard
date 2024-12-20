/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphBasedNodeHandler } from "./graph-based-node-handler.js";
import { contextFromMutableGraph } from "./inspector/graph-store.js";
import { MutableGraph } from "./inspector/types.js";
import { getGraphUrl } from "./loader/loader.js";
import type {
  InputValues,
  Kit,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
  NodeHandlerObject,
  NodeHandlers,
  NodeTypeIdentifier,
  OutputValues,
} from "./types.js";
import { graphUrlLike } from "./utils/graph-url-like.js";

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

export async function getGraphHandlerFromMutableGraph(
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
  }).mutable;
  return new GraphBasedNodeHandler({ graph: result.graph }, type);
}

export async function getGraphHandler(
  type: NodeTypeIdentifier,
  context: NodeHandlerContext
): Promise<NodeHandlerObject | undefined> {
  const nodeTypeUrl = graphUrlLike(type)
    ? getGraphUrl(type, context)
    : undefined;
  if (!nodeTypeUrl) {
    return undefined;
  }
  const { graphStore } = context;
  if (!graphStore) {
    throw new Error(
      `Cannot load graph for type "${type}" without a graph store.`
    );
  }

  const loadResult = await graphStore.load(type, context);
  if (!loadResult.success) {
    throw new Error(
      `Loading graph for type "${type}" failed: ${loadResult.error}`
    );
  }
  return new GraphBasedNodeHandler(loadResult, type);
}
