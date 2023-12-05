/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

import { GraphDescriptor, Schema, NodeDescriberFunction } from "../../types.js";
import {
  InputValues,
  OutputValues,
  OutputValuesOrUnknown,
  ProjectBackToOutputValues,
  NodeFactory,
  OutputsMaybeAsValues,
  RecipeFactory,
  NodeProxyHandlerFunction,
} from "./types.js";
import {
  AbstractNode,
  NodeHandler,
  NodeHandlerFunction,
  Serializeable,
} from "../runner/types.js";

import { zodToSchema } from "./zod-utils.js";
import { addNodeType } from "./kits.js";
import { getCurrentContextScope } from "./default-scope.js";
import { BuilderNode } from "./node.js";

/**
 * Actual implementation of all the above
 */
export const recipe: RecipeFactory = (
  optionsOrFn:
    | {
        input: z.ZodType | Schema;
        output: z.ZodType | Schema;
        invoke?: NodeProxyHandlerFunction;
        describe?: NodeDescriberFunction;
        name?: string;
      }
    | NodeProxyHandlerFunction,
  fn?: NodeProxyHandlerFunction
): NodeFactory & Serializeable => {
  const options = typeof optionsOrFn === "function" ? undefined : optionsOrFn;
  if (!options) {
    fn = optionsOrFn as NodeProxyHandlerFunction;
  } else {
    if (options.invoke) fn = options.invoke;
    if (!fn) throw new Error("Missing invoke function");
  }

  const handler: NodeHandler = {
    invoke: fn as NodeHandlerFunction<InputValues, OutputValues>,
  };

  if (options) {
    const inputSchema = zodToSchema(options.input);
    const outputSchema = zodToSchema(options.output);
    handler.describe =
      options.describe ??
      (async () => {
        return { inputSchema, outputSchema };
      });
  }

  const factory = addNodeType(options?.name, handler) as NodeFactory &
    Serializeable;

  const lexicalScope = getCurrentContextScope();
  factory.serialize = async (metadata?) => {
    // TODO: Schema isn't serialized right now
    // (as a function will be turned into a runJavascript node)
    const node = new BuilderNode(handler, lexicalScope);
    const [singleNode, graph] = await node.serializeNode();
    // If there is a subgraph that is invoked, just return that.
    if (graph) return { ...metadata, ...graph } as GraphDescriptor;
    // Otherwise return the node, most likely a runJavascript node.
    else return { ...metadata, edges: [], nodes: [singleNode] };
  };

  return factory;
};
