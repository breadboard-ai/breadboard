/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphBasedNodeHandler } from "./graph-based-node-handler.js";
import { SENTINEL_BASE_URL } from "./loader/loader.js";
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

export async function getGraphHandler(
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
  const loadResult = await loader.load(type, context);
  if (!loadResult.success) {
    throw new Error(
      `Cannot load graph for type "${type}": ${loadResult.error}`
    );
  }

  return new GraphBasedNodeHandler(loadResult, type);
}
