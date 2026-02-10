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
  NodeTypeIdentifier,
  OutputValues,
} from "@breadboard-ai/types";
import { graphUrlLike } from "@breadboard-ai/utils";
import { GraphBasedNodeHandler } from "./graph-based-node-handler.js";
import { A2_COMPONENT_MAP } from "../../a2/a2-registry.js";
import {
  A2ModuleFactory,
  createCallableCapabilities,
} from "../../a2/runnable-module-factory.js";
import { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";

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
 * - An A2 component handler, where the `type` is matched
 *   against the A2_COMPONENT_MAP for static dispatch.
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
  // Static dispatch for A2 components - bypasses graph-based handlers
  const component = A2_COMPONENT_MAP.get(type);
  if (component && context.sandbox) {
    const factory = context.sandbox as A2ModuleFactory;
    const capsManager = new CapabilitiesManagerImpl(context);
    const caps = createCallableCapabilities(capsManager.createSpec());
    return {
      invoke: async (inputs, invokeContext) =>
        component.invoke(inputs, caps, factory.createModuleArgs(invokeContext)),
      describe: async (inputs, inputSchema, outputSchema, describerContext) =>
        component.describe(
          {
            inputs: inputs ?? {},
            inputSchema,
            outputSchema,
            asType: describerContext?.asType,
          },
          caps,
          factory.createModuleArgs(describerContext ?? context)
        ),
    };
  }

  const handlers = handlersFromKits(context.kits ?? []);
  const kitHandler = handlers[type];
  if (kitHandler) {
    return kitHandler;
  }
  // Fallback for URL-like types (graph-based components)
  // used by the inspector for describe/metadata.
  // Note: invoke() will throw since graph-based execution is removed.
  if (graphUrlLike(type) && context.graphStore) {
    const loadResult = await context.graphStore.load(type, context);
    if (loadResult.success) {
      return new GraphBasedNodeHandler(loadResult, type);
    }
  }
  throw new Error(`No handler for node type "${type}"`);
}
