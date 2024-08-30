/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { invokeGraph } from "./run/invoke-graph.js";
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

export async function getGraphHandler(
  type: NodeTypeIdentifier,
  base: URL,
  context: NodeHandlerContext
): Promise<NodeHandler | undefined> {
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
  } as NodeHandlerObject;
}
