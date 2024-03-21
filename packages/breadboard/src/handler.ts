/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  Kit,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
  NodeHandlers,
  OutputValues,
} from "./types.js";

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
