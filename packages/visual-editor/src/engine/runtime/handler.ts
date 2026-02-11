/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
  NodeTypeIdentifier,
  OutputValues,
} from "@breadboard-ai/types";
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

/**
 * The single entry point for getting a handler for a node type.
 * The handler is matched against the A2_COMPONENT_MAP for static dispatch.
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
  // Static dispatch for A2 components
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

  throw new Error(`No handler for node type "${type}"`);
}
