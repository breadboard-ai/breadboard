/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
  BoardFactory,
  NodeProxyHandlerFunction,
  InputsForGraphDeclaration,
  GraphDeclarationFunction,
  NodeProxy,
  NodeFactory,
  InputsMaybeAsValues,
  Lambda,
  ClosureEdge,
} from "./types.js";
import { NodeHandler, NodeHandlerFunction } from "../runner/types.js";

import { registerNodeType } from "./kits.js";
import { getCurrentContextScope } from "./default-scope.js";
import { BuilderNode } from "./node.js";
import { BuilderScope } from "./scope.js";

/**
 * Implementation of the overloaded board function.
 */
export const board: BoardFactory = (
  optionsOrFn:
    | ({
        input?: Schema;
        output?: Schema;
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

  return lambdaFactory(options);
};

/**
 * Explicit implementations of the overloaded variants, also splitting
 * graph generation and code boards.
 */
export const code = <
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
>(
  fn: (inputs: I) => O | PromiseLike<O>
): Lambda<I, Required<O>> => {
  return lambdaFactory({
    invoke: fn as unknown as NodeProxyHandlerFunction,
  }) as Lambda<I, Required<O>>;
};

/**
 * Actual implementation of all the above
 */
function lambdaFactory(
  options: {
    input?: Schema;
    output?: Schema;
    graph?: GraphDeclarationFunction;
    invoke?: NodeProxyHandlerFunction;
    describe?: NodeDescriberFunction;
    name?: string;
  } & GraphMetadata
): Lambda {
  if (!options.invoke && !options.graph)
    throw new Error("Missing invoke or graph definition function");

  const lexicalScope = getCurrentContextScope();
  const closureEdgesToWire: ClosureEdge[] = [];

  // Extract board metadata from config. Used in serialize().
  const { url, title, description, version } = options ?? {};
  const configMetadata: GraphMetadata = {
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
  };

  const inputSchema = options.input;
  const outputSchema = options.output;

  const handler: NodeHandler = {};

  if (options.describe) handler.describe = options.describe;
  else if (inputSchema && outputSchema)
    handler.describe = async () => ({ inputSchema, outputSchema });

  if (options.invoke) handler.invoke = options.invoke as NodeHandlerFunction;

  if (options.graph) {
    const scope = new BuilderScope({ lexicalScope, serialize: true });

    scope.asScopeFor(() => {
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

      const createAndPinNode = (
        type: string,
        config: InputsMaybeAsValues<InputValues>
      ) => {
        const node = new BuilderNode(type, scope, config);
        scope.pin(node);
        return node.asProxy();
      };

      // Create base kit that auto-pins to the scope.
      const base = {
        input: createAndPinNode.bind(null, "input") as NodeFactory,
        output: createAndPinNode.bind(null, "output") as NodeFactory,
      };

      const result = options.graph?.(
        inputNode.asProxy() as InputsForGraphDeclaration<InputValues>,
        base
      );

      // Nothing returned means that the function must have pinned nodes itself
      // using the `base` kit supplied above.
      if (result === undefined) return;

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

      // Pin the resulting graph. Note: This might not contain either of the
      // input or output nodes created above, if e.g. a new input node was
      // created and an output node was returned.
      scope.pin(actualOutput);
    })();

    // Add closure wires from parent scopes, if any
    if (scope.getClosureEdges().length > 0) {
      // This input node will receive all closure wires into the new graph.
      const closureInput = new BuilderNode("input", scope, {
        $id: "closure-input",
      });
      scope.pin(closureInput);

      for (const edge of scope.getClosureEdges()) {
        // Connect closure input to destination node
        const { to, out, in: in_ } = edge;
        const wire = `$l-${out}-${to.id}`;
        to.addIncomingEdge(closureInput, wire, in_, true);

        // Wire upwards. This has to wait until the end of this function because
        // we first need the lambda node, and that in turn needs to serialize
        // this graph first.
        closureEdgesToWire.push({ ...edge, to: closureInput, in: wire });
      }
    }

    scope.compactPins();
    const numGraphs = scope.getPinnedNodes().length;

    if (numGraphs !== 1)
      if (numGraphs === 0)
        throw new Error(
          "If not returning a graph, use `base.input` and `base.output`."
        );
      else
        throw new Error(
          `Expected exactly one graph, but got ${numGraphs}. Are ${scope
            .getPinnedNodes()
            .map((node) => node.id)
            .join(", ")} maybe disjoint?`
        );

    handler.graph = scope;
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
    if (
      !lambdaNode ||
      (lambdaNode.incoming.length === 0 && closureEdgesToWire.length == 0)
    )
      return new BuilderNode(
        handler,
        getCurrentContextScope(),
        config
      ).asProxy();
    else
      return new BuilderNode("invoke", getCurrentContextScope(), {
        ...config,
        $board: lambdaNode.asProxy().board,
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
      if (lambdaNode?.incoming.length === 0 && closureEdgesToWire.length === 0)
        return await serialized;

      const invoke = new BuilderNode("invoke", getCurrentContextScope(), {
        $board: lambdaNode?.asProxy().board,
      });

      return invoke.serialize({ ...configMetadata, ...metadata });
    };

    return lambdaNode;
  }

  // Return wire from lambdaNode that will generate a BoardCapability
  factory.getBoardCapabilityAsValue = () =>
    lambdaNode !== undefined &&
    (lambdaNode.incoming.length > 0 || closureEdgesToWire.length > 0)
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

  for (const { scope: fromScope, from, out, in: in_ } of closureEdgesToWire) {
    // If we reached the source scope, connect source node to lambda
    if (fromScope === lexicalScope)
      getLambdaNode().addIncomingEdge(from, out, in_, true);
    // Otherwise add closure edge to the lambda node's scope
    else
      lexicalScope.addClosureEdge({
        scope: fromScope,
        from,
        to: getLambdaNode(),
        out,
        in: in_,
      });
  }

  return factory;
}

export function isLambda(factory: unknown): factory is Lambda {
  return (
    typeof factory === "function" &&
    typeof (factory as Lambda).getBoardCapabilityAsValue === "function"
  );
}
