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
  InputsForGraphDeclaration,
  GraphDeclarationFunction,
  NodeProxy,
  InputsMaybeAsValues,
  Lambda,
} from "./types.js";
import { NodeHandler, NodeHandlerFunction } from "../runner/types.js";

import { zodToSchema } from "./zod-utils.js";
import { registerNodeType } from "./kits.js";
import { getCurrentContextScope } from "./default-scope.js";
import { BuilderNode } from "./node.js";
import { BuilderScope } from "./scope.js";

/**
 * Implementation of the overloaded recipe function.
 */
export const recipe: RecipeFactory = (
  optionsOrFn:
    | ({
        input?: z.ZodType;
        output?: z.ZodType;
        graph?: GraphDeclarationFunction;
        invoke?: NodeProxyHandlerFunction;
        describe?: NodeDescriberFunction;
        name?: string;
      } & GraphMetadata)
    | GraphDeclarationFunction,
  maybeFn?: GraphDeclarationFunction
) => {
  const options = typeof optionsOrFn === "object" ? optionsOrFn : {};
  options.graph ??= typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;

  return recipeImpl(options);
};

/**
 * Explicit implementations of the overloaded variants, also splitting
 * graph generation and code recipes.
 */
export const recipeAsGraph = <
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(
  fn: GraphDeclarationFunction<I, O>
): Lambda<I, Required<O>> => {
  return recipeImpl({
    graph: fn as GraphDeclarationFunction,
  }) as Lambda<I, Required<O>>;
};

export const recipeAsCode = <
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(
  fn: (inputs: I) => O | PromiseLike<O>
): Lambda<I, Required<O>> => {
  return recipeImpl({
    invoke: fn as unknown as NodeProxyHandlerFunction,
  }) as Lambda<I, Required<O>>;
};

export const recipeAsGraphWithZod = <
  IT extends z.ZodType,
  OT extends z.ZodType
>(
  options: {
    input: IT;
    output: OT;
    describe?: NodeDescriberFunction;
    name?: string;
  } & GraphMetadata,
  fn: GraphDeclarationFunction<z.infer<IT>, z.infer<OT>>
): Lambda<z.infer<IT>, Required<z.infer<OT>>> => {
  return recipeImpl({
    ...options,
    graph: fn as GraphDeclarationFunction,
  }) as Lambda<z.infer<IT>, Required<z.infer<OT>>>;
};

export const recipeAsCodeWithZod = <IT extends z.ZodType, OT extends z.ZodType>(
  options: {
    input: IT;
    output: OT;
    invoke: (inputs: z.infer<IT>) => z.infer<OT> | PromiseLike<z.infer<OT>>;
    describe?: NodeDescriberFunction;
    name?: string;
  } & GraphMetadata
): Lambda<z.infer<IT>, Required<z.infer<OT>>> => {
  return recipeImpl(options) as Lambda<z.infer<IT>, Required<z.infer<OT>>>;
};

/**
 * Actual implementation of all the above
 */
function recipeImpl(
  options: {
    input?: z.ZodType | Schema;
    output?: z.ZodType | Schema;
    graph?: GraphDeclarationFunction;
    invoke?: NodeProxyHandlerFunction;
    describe?: NodeDescriberFunction;
    name?: string;
  } & GraphMetadata
): Lambda {
  if (!options.invoke && !options.graph)
    throw new Error("Missing invoke or graph definition function");

  const lexicalScope = getCurrentContextScope();

  // Extract recipe metadata from config. Used in serialize().
  const { url, title, description, version } = options ?? {};
  const configMetadata: GraphMetadata = {
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
  };

  const inputSchema = options.input && zodToSchema(options.input);
  const outputSchema = options.output && zodToSchema(options.output);

  const handler: NodeHandler = {};

  if (options.describe) handler.describe = options.describe;
  else if (inputSchema && outputSchema)
    handler.describe = async () => ({ inputSchema, outputSchema });

  if (options.invoke) handler.invoke = options.invoke as NodeHandlerFunction;

  if (options.graph) {
    const scope = new BuilderScope({ lexicalScope, serialize: true });

    handler.graph = scope.asScopeFor(() => {
      const inputNode = new BuilderNode(
        "input",
        scope,
        inputSchema ? { schema: inputSchema } : {}
      );
      const outputNode = new BuilderNode(
        "output",
        scope,
        outputSchema ? { schema: outputSchema } : {}
      );

      const result = options.graph?.(
        inputNode.asProxy() as InputsForGraphDeclaration<InputValues>
      );

      if (result instanceof Promise)
        throw new Error("Graph generation function can't be async");

      let actualOutput = outputNode as BuilderNode;

      if (result instanceof BuilderNode) {
        // If the handler returned an output node, serialize it directly,
        // otherwise connect the returned node's outputs to the output node.
        const node = result.unProxy();
        if (node.type === "output") actualOutput = node;
        else outputNode.addInputsFromNode(node);
      } else if (typeof result === "object") {
        // Otherwise wire up all keys of the returned object to the output.
        outputNode.addInputsAsValues(
          result as InputsMaybeAsValues<OutputValues>
        );
      } else {
        throw new Error(
          `Unexpected return ${typeof result} value from graph declaration`
        );
      }

      return actualOutput;
    })();
  }

  let lambdaNode:
    | BuilderNode<
        { board: BreadboardCapability },
        { board: BreadboardCapability }
      >
    | undefined = undefined;

  // TODO: Fix for closures, probably create a graph with an invoke node and
  // re-register name with that as handler. But first we need to get cross-scope
  // wiring right.
  if (options.name)
    registerNodeType(options.name, handler as unknown as NodeHandler);

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
      return { ...configMetadata, ...metadata, ...graph } as GraphDescriptor;
    }
    // Otherwise build a graph around the node:
    else
      return {
        ...configMetadata,
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

      return invoke.serialize({ ...configMetadata, ...metadata });
    };

    return lambdaNode;
  }

  // Return wire from lambdaNode that will generate a BoardCapability
  factory.getBoardCapabilityAsValue = () =>
    lambdaNode !== undefined && lambdaNode.incoming.length > 0
      ? lambdaNode.asProxy().board
      : ((async () => ({
          kind: "board",
          board: { kits: [], ...(await factory.serialize()) },
        }))() as Promise<BreadboardCapability>);

  // Access to factory as if it was a node means accessing the closure node.
  // This makes otherNode.to(factory) work.
  factory.unProxy = () => getLambdaNode().unProxy() as unknown as BuilderNode;

  // Allow factory.in(...incoming wires...).
  //
  // Note: factory.to() is not supported as there are no outgoing wires. To
  // access to `board` output, wire the factory directly. In the future we'll
  // get rid of BoardCapability and treat node factories as first class entities.
  //
  factory.in = (inputs: Parameters<Lambda["in"]>[0]) => {
    getLambdaNode().in(inputs);
    return factory as unknown as NodeProxy;
  };

  return factory;
}

export function isLambda(factory: unknown): factory is Lambda {
  return (
    typeof factory === "function" &&
    typeof (factory as Lambda).getBoardCapabilityAsValue === "function"
  );
}
