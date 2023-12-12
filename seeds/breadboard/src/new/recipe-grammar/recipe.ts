/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

import {
  GraphDescriptor,
  Schema,
  NodeDescriberFunction,
  GraphMetadata,
  BreadboardCapability,
} from "../../types.js";
import {
  InputValues,
  OutputValues,
  RecipeFactory,
  NodeProxyHandlerFunction,
  NodeProxy,
  InputsMaybeAsValues,
  Lambda,
} from "./types.js";
import { NodeHandler, NodeHandlerFunction } from "../runner/types.js";

import { zodToSchema } from "./zod-utils.js";
import { registerNodeType } from "./kits.js";
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
): Lambda => {
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

  const inputSchema =
    options !== undefined && options.input && zodToSchema(options.input);
  const outputSchema =
    options !== undefined && options.output && zodToSchema(options.output);

  if (inputSchema && outputSchema) {
    handler.describe =
      options.describe ??
      (async () => {
        return { inputSchema, outputSchema };
      });
  }

  const lexicalScope = getCurrentContextScope();
  let lambdaNode:
    | BuilderNode<
        { board: BreadboardCapability },
        { board: BreadboardCapability }
      >
    | undefined = undefined;

  // TODO: Fix for closures, probably create a graph with an invoke node and
  // re-register name with that as handler. But first we need to get cross-scope
  // wiring right.
  if (options?.name)
    registerNodeType(options?.name, handler as unknown as NodeHandler);

  // When this factory is called, create node with handler and return as proxy.
  // But if this is a closure, i.e. there are incoming wires to the lambda node
  // (= like a closure, it reads from other nodes in its parent lexical scope),
  // then invoke said lambda by reading the board capability it creates.
  const factory = ((config?: InputsMaybeAsValues<InputValues>) => {
    if (!lambdaNode || lambdaNode.incoming.length === 0)
      return new BuilderNode(
        handler,
        getCurrentContextScope(),
        config
      ).asProxy();
    else
      return new BuilderNode("invoke", getCurrentContextScope(), {
        ...config,
        $recipe: lambdaNode.asProxy().board,
      });
  }) as Lambda;

  // Serializable:

  // (Will be called and then overwritten by `createLambda` below
  // once this turns into a closure)
  factory.serialize = async (metadata?: GraphMetadata) => {
    const node = new BuilderNode(handler, lexicalScope);
    const [singleNode, graph] = await node.serializeNode();

    // If there is a subgraph that is invoked, just return that.
    if (graph) {
      if (singleNode.type !== "invoke")
        throw new Error("Unexpected node with graph");
      return { ...metadata, ...graph } as GraphDescriptor;
    }

    // Otherwise build a graph around the node.
    else
      return {
        ...metadata,
        edges: [
          { from: `${singleNode.id}-input`, to: singleNode.id, out: "*" },
          { from: singleNode.id, to: `${singleNode.id}-output`, out: "*" },
        ],
        nodes: [
          {
            id: `${singleNode.id}-input`,
            type: "input",
            configuration: inputSchema ? { schema: inputSchema } : {},
          },
          singleNode,
          {
            id: `${singleNode.id}-output`,
            type: "output",
            configuration: outputSchema ? { schema: outputSchema } : {},
          },
        ],
      };
  };

  // ClosureNodeInterface:

  // Creates a lambda node if this lambda is used as a closure, i.e. it accesses
  // wires from nodes in it's lexical scope, or it's passed as a value, i.e. a
  // BoardCapability needs to be created. Those wires will be wired to this
  // node, which then passes the values to the lambda when invoked. For now it
  // does that by adding those values to the `args` field in the serialized
  // graph. And it outputs a `BoardCapability` that can be invoked. In the
  // future we'll replace the latter with first class support of factories.
  function getLambdaNode() {
    if (lambdaNode) return lambdaNode;

    const serialized = factory.serialize();

    // HACK: Since node creation is synchronous, we put a promise for the board
    // capability here. BuilderNode.serializeNode() awaits that then.
    lambdaNode = new BuilderNode("lambda", lexicalScope, {
      board: (async () => ({
        kind: "board",
        board: { kits: [], ...(await serialized) },
        // kits: because Runner.fromBoardCapability checks for that.
      }))() as unknown as BreadboardCapability,
    });

    // Replace the serialize function with one that returns a graph with that
    // lambda node and an invoke node, not the original graph.
    factory.serialize = async (metadata?: GraphMetadata) => {
      // If there are no incoming wires to the lambda node, it's not a closure
      // and we can just return the original board.
      if (lambdaNode?.incoming.length === 0) return await serialized;

      const invoke = new BuilderNode("invoke", getCurrentContextScope(), {
        $recipe: lambdaNode?.asProxy().board,
      });

      return invoke.serialize(metadata);
    };

    return lambdaNode;
  }

  // Return wire from lambdaNode that will generate a BoardCapability
  factory.getBoardCapabilityAsValue = () => getLambdaNode().asProxy().board;

  // Access to factory as if it was a node means accessing the closure node.
  // This makes otherNode.to(factory) work.
  factory.unProxy = () => getLambdaNode().unProxy() as unknown as BuilderNode;

  // Allow factory.in(...incoming wires...).
  //
  // Note: factory.to() is not supported as there are no outgoing wires. To
  // access to `board` output, wire the factory directly. In the future we'll
  // get rid of BoardCapability and treat node factories as first class entities.
  //
  factory.in = (inputs: Parameters<Lambda["in"]>[0]) =>
    getLambdaNode().in(inputs) as NodeProxy;

  return factory;
};

export function isLambda(factory: unknown): factory is Lambda {
  return typeof (factory as Lambda).getBoardCapabilityAsValue === "function";
}
