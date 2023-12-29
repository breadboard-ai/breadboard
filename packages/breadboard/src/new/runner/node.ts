/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphMetadata,
  NodeDescriptor,
  InputValues as OriginalInputValues,
  Schema,
  NodeDescriberResult,
} from "@google-labs/breadboard";
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
} from "./types.js";

import { Scope } from "./scope.js";

import { IdVendor } from "../../id.js";

const nodeIdVendor = new IdVendor();

// TODO:BASE Extract base class that isn't opinionated about the syntax. Marking
// methods that should be base as "TODO:BASE" below, including complications.
export class BaseNode<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >
  extends AbstractNode<I, O>
  implements Serializeable
{
  id: string;
  type: string;
  outgoing: EdgeInterface[] = [];
  incoming: EdgeInterface[] = [];
  configuration: Partial<I> = {};

  #handler?: NodeHandler<InputValues, OutputValues>;

  #inputs: Partial<I>;
  #constants: Partial<I> = {};
  #incomingControlWires: AbstractNode[] = [];
  #outputs?: O;

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

    const { $id, ...rest } = config;

    this.id = $id ?? nodeIdVendor.vendId(scope, this.type);

    this.configuration = rest as Partial<I>;

    this.#inputs = {};
    this.#constants = {};
  }

  addIncomingEdge(
    from: AbstractNode,
    out: string,
    in_: string,
    constant?: boolean
  ) {
    if ((from as BaseNode).#scope !== this.#scope)
      throw new Error("Can't connect nodes from different scopes");

    const edge: EdgeInterface = {
      to: this as unknown as AbstractNode,
      from: from,
      out,
      in: in_,
    };
    if (constant) edge.constant = true;

    this.incoming.push(edge);
    from.outgoing.push(edge);
  }

  receiveInputs(edge: EdgeInterface, inputs: InputValues) {
    const data =
      edge.out === "*"
        ? inputs
        : edge.out === ""
        ? {}
        : inputs[edge.out] !== undefined
        ? { [edge.in]: inputs[edge.out] }
        : {};
    if (edge.constant) this.#constants = { ...this.#constants, ...data };
    this.#inputs = { ...this.#inputs, ...data };

    if (edge.in === "") this.#incomingControlWires.push(edge.from);

    // return which wires were used
    return Object.keys(data);
  }

  receiveConstants(constants: InputValues) {
    this.#constants = { ...this.#constants, ...constants };
    this.#inputs = { ...this.#inputs, ...constants };
  }

  /**
   * Compute required inputs from edges and compare with present inputs
   *
   * Required inputs are
   *  - for all named incoming edges, the presence of any data, irrespective of
   *    which node they come from
   *  - at least one of the incoming empty or * wires, if present (TODO: Is that
   *    correct?)
   *  - data from at least one node if it already ran (#this.outputs not empty)
   *
   * @returns false if none are missing, otherwise string[] of missing inputs.
   * NOTE: A node with no incoming wires returns an empty array after  first
   * run.
   */
  missingInputs(): string[] | false {
    if (this.incoming.length === 0 && this.#outputs) return [];

    const requiredKeys = new Set(this.incoming.map((edge) => edge.in));

    const presentKeys = new Set([
      ...Object.keys(this.configuration),
      ...Object.keys(this.#inputs),
      ...Object.keys(this.#constants),
    ]);
    if (this.#incomingControlWires.length) presentKeys.add("");

    const missingInputs = [...requiredKeys].filter(
      (key) => !presentKeys.has(key)
    );
    return missingInputs.length ? missingInputs : false;
  }

  getInputs(): I {
    return { ...this.configuration, ...(this.#inputs as I) };
  }

  setOutputs(outputs: O) {
    this.#outputs = outputs;

    // Clear inputs, reset with constants
    this.#inputs = { ...this.#constants };
    this.#incomingControlWires = [];
  }

  #getHandlerDescribe(scope: ScopeInterface) {
    const handler = this.#handler ?? scope.getHandler(this.type);
    return handler && typeof handler !== "function"
      ? handler.describe
      : undefined;
  }

  // In the end, we need to capture the outputs and resolve the promise. But
  // before that there is a bit of refactoring to do to allow returning of
  // graphs, parallel execution, etc.
  //
  // The logic from BuilderNode.invoke should be somehow called from here, for
  // deserialized nodes that require the Builder environment.
  async invoke(dynamicScope?: Scope): Promise<O> {
    const scope = dynamicScope ?? (this.#scope as Scope);

    const handler: NodeHandler | undefined =
      this.#handler ?? scope.getHandler(this.type);

    let result;

    const handlerFn = typeof handler === "function" ? handler : handler?.invoke;

    if (handlerFn) {
      result = (await handlerFn(
        this.getInputs() as I & PromiseLike<I>,
        this
      )) as O;
    } else if (handler && typeof handler !== "function" && handler.graph) {
      // TODO: This isn't quite right, but good enough for now. Instead what
      // this should be in invoking a graph from a lexical scope in a dynamic
      // scope. This requires moving state management into the dyanmic scope.
      const graphs = handler.graph.getPinnedNodes();
      if (graphs.length !== 1) throw new Error("Expected exactly one graph");
      result = (await scope.invokeOnce(this.getInputs(), graphs[0])) as O;
    } else {
      throw new Error(`Can't find handler for ${this.id}`);
    }

    this.setOutputs(result);

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

  async serialize(metadata?: GraphMetadata): Promise<GraphDescriptor> {
    return this.#scope.serialize(metadata, this as unknown as BaseNode);
  }

  async serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]> {
    const node = {
      id: this.id,
      type: this.type,
      configuration: this.configuration as OriginalInputValues,
    };

    return [node];
  }
}
