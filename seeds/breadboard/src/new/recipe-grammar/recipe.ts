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

export type NodeProxyHandlerFunction<
  I extends InputValues,
  O extends OutputValuesOrUnknown
> = (
  inputs: PromiseLike<I> & I,
  node: AbstractNode<I, ProjectBackToOutputValues<O>>
) => O | PromiseLike<O> | OutputsMaybeAsValues<O>;

/**
 * Creates a node factory for a node type that invokes a handler function. This
 * version infers the types from the function.
 *
 * The handler function can either return a graph (in which case it would be
 * serialized to a graph), or returns the results of a computation, called at
 * runtime and serialized as Javascript.
 *
 * @param fn Handler or graph creation function
 */
export function recipe<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(
  fn: NodeProxyHandlerFunction<I, O>
): NodeFactory<I, Required<O>> & Serializeable;

/**
 * Alternative version to above that infers the type of the passed in Zod type.
 *
 * @param options Object with at least `input`, `output` and `invoke` set
 */
export function recipe<IT extends z.ZodType, OT extends z.ZodType>(options: {
  input: IT;
  output: OT;
  invoke: NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>;
  describe?: NodeDescriberFunction;
  name?: string;
}): NodeFactory<z.infer<IT>, Required<z.infer<OT>>> & Serializeable;

/**
 * Same as above, but takes handler as a second parameter instead of as invoke
 * option. This looks a bit nicer in the code (less indentation).
 *
 * @param options `input` and `output` schemas
 * @param fn Handler function
 */
export function recipe<IT extends z.ZodType, OT extends z.ZodType>(
  options: {
    input: IT;
    output: OT;
    describe?: NodeDescriberFunction;
    name?: string;
  },
  fn?: NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>
): NodeFactory<z.infer<IT>, Required<z.infer<OT>>> & Serializeable;

/**
 * Actual implementation of all the above
 */
export function recipe<IT extends z.ZodType, OT extends z.ZodType>(
  optionsOrFn:
    | {
        input: IT;
        output: OT;
        invoke?: NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>;
        describe?: NodeDescriberFunction;
        name?: string;
      }
    | NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>,
  fn?: NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>
): NodeFactory<z.infer<IT>, Required<z.infer<OT>>> & Serializeable {
  const options = typeof optionsOrFn === "function" ? undefined : optionsOrFn;
  if (!options) {
    fn = optionsOrFn as NodeProxyHandlerFunction<z.infer<IT>, z.infer<OT>>;
  } else {
    if (options.invoke) fn = options.invoke;
    if (!fn) throw new Error("Missing invoke function");
  }

  const handler: NodeHandler<z.infer<IT>, z.infer<OT>> = {
    invoke: fn as NodeHandlerFunction<z.infer<IT>, z.infer<OT>>,
  };

  if (options) {
    handler.describe =
      options.describe ??
      (async () => {
        return {
          inputSchema: zodToSchema(options.input) as Schema,
          outputSchema: zodToSchema(options.output) as Schema,
        };
      });
  }

  const factory: NodeFactory<z.infer<IT>, Required<z.infer<OT>>> &
    Serializeable = addNodeType(options?.name, handler) as NodeFactory<
    z.infer<IT>,
    Required<z.infer<OT>>
  > &
    Serializeable;

  const declaringScope = getCurrentContextScope();
  factory.serialize = async (metadata?) => {
    // TODO: Schema isn't serialized right now
    // (as a function will be turned into a runJavascript node)
    const node = new BuilderNode(handler, declaringScope);
    const [singleNode, graph] = await node.serializeNode();
    // If there is a subgraph that is invoked, just return that.
    if (graph) return { ...metadata, ...graph } as GraphDescriptor;
    // Otherwise return the node, most likely a runJavascript node.
    else return { ...metadata, edges: [], nodes: [singleNode] };
  };

  return factory;
}
