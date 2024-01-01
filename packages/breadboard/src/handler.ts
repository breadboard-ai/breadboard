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
  NodeHandlers,
} from "./types.js";

export const callHandler = async (
  handler: NodeHandler,
  inputs: InputValues,
  context: NodeHandlerContext
) => {
  if (handler instanceof Function) return handler(inputs, context);
  if (handler.invoke) return handler.invoke(inputs, context);
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
