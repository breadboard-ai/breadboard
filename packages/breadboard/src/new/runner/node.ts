/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeDescriptor,
  InputValues as OriginalInputValues,
  Schema,
  NodeDescriberResult,
} from "../../types.js";
import {
  InputValues,
  OutputValues,
  NodeHandler,
  NodeTypeIdentifier,
  Serializeable,
  AbstractNode,
  EdgeInterface,
  OptionalIdConfiguration,
  ScopeInterface,
  GraphCombinedMetadata,
} from "./types.js";

import { Scope } from "./scope.js";

import { IdVendor } from "../../id.js";
import { NodeMetadata } from "@breadboard-ai/types";

const nodeIdVendor = new IdVendor();

// TODO:BASE Extract base class that isn't opinionated about the syntax. Marking
// methods that should be base as "TODO:BASE" below, including complications.
export class BaseNode<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues,
  >
  extends AbstractNode<I, O>
  implements Serializeable
{
  id: string;
  type: string;
  outgoing: EdgeInterface[] = [];
  incoming: EdgeInterface[] = [];
  configuration: Partial<I> = {};
  metadata?: NodeMetadata;

  #handler?: NodeHandler<InputValues, OutputValues>;

  #scope: ScopeInterface;

  constructor(
    handler: NodeTypeIdentifier | NodeHandler<I, O>,
    scope: ScopeInterface,
    config: Partial<I> & OptionalIdConfiguration = {}
  ) {
    super();

    this.#scope = scope;

    if (typeof handler === "string") {
      this.type = handler;
    } else {
      this.type = "fn";
      this.#handler = handler as unknown as NodeHandler<
        InputValues,
        OutputValues
      >;
    }

    const { $id, $metadata, ...rest } = config;

    this.id = $id ?? nodeIdVendor.vendId(scope, this.type);
    if ($metadata) this.metadata = $metadata;

    this.configuration = rest as Partial<I>;
  }

  addIncomingEdge(
    from: AbstractNode,
    out: string,
    in_: string,
    constant?: boolean,
    schema?: Schema
  ) {
    if ((from as BaseNode).#scope !== this.#scope)
      throw new Error("Can't connect nodes from different scopes");

    const edge: EdgeInterface = {
      to: this as unknown as AbstractNode,
      from: from,
      out,
      in: in_,
      schema,
    };
    if (constant) edge.constant = true;

    this.incoming.push(edge);
    from.outgoing.push(edge);
  }

  #getHandlerDescribe(scope: ScopeInterface) {
    const handler = this.#handler ?? scope.getHandler(this.type);
    return handler && "describe" in handler && handler.describe
      ? handler.describe
      : undefined;
  }

  // In the end, we need to capture the outputs and resolve the promise. But
  // before that there is a bit of refactoring to do to allow returning of
  // graphs, parallel execution, etc.
  //
  // The logic from BuilderNode.invoke should be somehow called from here, for
  // deserialized nodes that require the Builder environment.
  async invoke(inputs: I, dynamicScope?: Scope): Promise<O> {
    const scope = dynamicScope ?? (this.#scope as Scope);

    const handler: NodeHandler | undefined =
      this.#handler ?? scope.getHandler(this.type);

    let result;

    const handlerFn =
      handler && "invoke" in handler && handler.invoke
        ? handler.invoke
        : typeof handler === "function"
          ? handler
          : undefined;

    if (handlerFn) {
      result = (await handlerFn(inputs, this)) as O;
    } else if (handler && typeof handler !== "function" && handler.graph) {
      // TODO: This isn't quite right, but good enough for now. Instead what
      // this should be in invoking a graph from a lexical scope in a dynamic
      // scope. This requires moving state management into the dyanmic scope.
      const graphs = handler.graph.getPinnedNodes();
      if (graphs.length !== 1) throw new Error("Expected exactly one graph");
      result = (await scope.invokeOneRound(inputs, graphs[0])) as O;
    } else {
      throw new Error(`Can't find handler for ${this.id}`);
    }

    return result;
  }

  async describe(
    scope: ScopeInterface = this.#scope,
    inputs?: InputValues,
    inputSchema?: Schema,
    outputSchema?: Schema
  ): Promise<NodeDescriberResult | undefined> {
    const describe = this.#getHandlerDescribe(scope);
    return describe
      ? await describe(inputs as OriginalInputValues, inputSchema, outputSchema)
      : undefined;
  }

  async serialize(metadata?: GraphCombinedMetadata): Promise<GraphDescriptor> {
    return this.#scope.serialize(metadata, this as unknown as BaseNode);
  }

  async serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]> {
    const node: NodeDescriptor = {
      id: this.id,
      type: this.type,
      configuration: this.configuration as OriginalInputValues,
    };

    if (this.metadata) node.metadata = this.metadata;

    return [node];
  }
}
