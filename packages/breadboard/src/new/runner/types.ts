/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, NodeMetadata } from "@breadboard-ai/types";
import {
  NodeDescriptor,
  GraphDescriptor,
  GraphInlineMetadata,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeValue as OriginalNodeValue,
  Schema,
} from "../../types.js";

// TODO:BASE: Same as before, but I added NodeFactory as base type, which is a
// way to encapsulate boards, including lambdas (instead of BoardCapability).
// Can keep it a capability, but this feels quite fundamental.

export type NodeValue = OriginalNodeValue | PromiseLike<NodeValue> | unknown;
export type NodeTypeIdentifier = string;

export type GraphCombinedMetadata = GraphInlineMetadata & {
  metadata?: GraphMetadata;
};
export type InputValues = { [key: string]: NodeValue };

export type OutputValues = { [key: string]: NodeValue };
export type OutputValue<T> = Partial<{ [key: string]: T }>;

export type NodeHandlerFunction<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> = (inputs: I, node: AbstractNode<I, O>) => O | PromiseLike<O>;

export type NodeHandler<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> =
  | {
      invoke?: NodeHandlerFunction<I, O>;
      describe?: NodeDescriberFunction;
      graph?: ScopeInterface; // Pinned graph is the node
    }
  | NodeHandlerFunction<I, O>;

export type NodeHandlers = Record<
  NodeTypeIdentifier,
  NodeHandler<InputValues, OutputValues>
>;

export interface Serializeable {
  serialize(
    metadata?: GraphCombinedMetadata
  ): Promise<GraphDescriptor> | GraphDescriptor;
}

export type KeyMap = { [key: string]: string };

// TODO: Add optional.
export interface EdgeInterface<
  FromI extends InputValues = InputValues,
  FromO extends OutputValues = OutputValues,
  ToI extends InputValues = InputValues,
  ToO extends OutputValues = OutputValues,
> {
  from: AbstractNode<FromI, FromO>;
  to: AbstractNode<ToI, ToO>;
  out: string;
  in: string;
  constant?: boolean;
  schema?: Schema;
}

export type OptionalIdConfiguration = {
  $id?: string;
  $metadata?: NodeMetadata;
};

export abstract class AbstractNode<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> implements Serializeable
{
  abstract id: string;
  abstract type: string;
  abstract outgoing: EdgeInterface[];
  abstract incoming: EdgeInterface[];
  abstract configuration: Partial<I>;

  abstract addIncomingEdge(
    from: AbstractNode,
    out: string,
    in_: string,
    constant?: boolean,
    schema?: Schema
  ): void;

  abstract invoke(inputs: I, dynamicScope?: ScopeInterface): Promise<O>;
  abstract describe(
    scope?: ScopeInterface,
    inputs?: InputValues,
    inputSchema?: Schema,
    outputSchema?: Schema
  ): Promise<NodeDescriberResult | undefined>;

  abstract serialize(
    metadata?: GraphCombinedMetadata
  ): Promise<GraphDescriptor>;

  abstract serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]>;
}

export interface StateInterface {
  queueUp(node: AbstractNode): void;
  next(): AbstractNode;
  done(): boolean;

  processResult(node: AbstractNode, result: OutputValues): OutputDistribution;

  missingInputs(node: AbstractNode): string[] | false;
  shiftInputs<I extends InputValues>(node: AbstractNode<I>): I;
  distributeResults(edge: EdgeInterface, inputs: InputValues): string[];
}

export interface OutputDistribution {
  nodes: {
    node: AbstractNode;
    received: string[];
    missing: string[] | false;
  }[];
  unused: string[];
}

export interface InvokeCallbacks {
  // Called at the top of any iteration.
  // Return true to abort execution.
  // Use `state` to continue later.
  stop?: (
    scope: ScopeInterface,
    state: StateInterface
  ) => boolean | Promise<boolean>;

  // Called before a node is invoked.
  // Waits for execution until promise is resolved. (Useful to pause execution)
  // Return outputs values to skip invocation and use those values instead.
  before?: (
    scope: ScopeInterface,
    node: AbstractNode,
    inputs: InputValues
  ) => undefined | Promise<OutputValues | undefined>;

  // Called after a node is invoked.
  // Contains information useful for debugging.
  // Does _not_ wait for promise to resolve before continuing execution.
  after?: (
    scope: ScopeInterface,
    node: AbstractNode,
    inputs: InputValues,
    outputs: OutputValues,
    distribution: OutputDistribution
  ) => void | Promise<void>;

  // Called after a graph is done executing.
  // Only called on the scope that the callback was added to.
  done?: () => void | Promise<void>;
}

export interface ScopeConfig {
  lexicalScope?: ScopeInterface;
  dynamicScope?: ScopeInterface;
}

export interface ScopeInterface {
  parentLexicalScope?: ScopeInterface;
  parentDynamicScope?: ScopeInterface;

  /**
   * Add handlers to this scope. See `getHandler` for resolution order.
   *
   * @param handlers handlers to add
   */
  addHandlers(handlers: NodeHandlers): void;

  /**
   * Finds handler by name
   *
   * Scans up the parent chain if not found in this scope, looking in calling
   * scopes before the declaration context scopes.
   *
   * That is, if a graph is invoked with a specific set of kits, then those kits
   * have precedence over kits declared when building the graphs. And kits
   * declared by invoking graphs downstream have precedence over those declared
   * upstream.
   *
   * @param name Name of the handler to retrieve
   * @returns Handler or undefined
   */
  getHandler<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues,
  >(
    name: string
  ): NodeHandler<I, O> | undefined;

  /**
   * Pins a node to this scope, meaning it will be invoked/serialized for
   * invoke() and serialize() unless those are called with specific nodes.
   *
   * Note that while all nodes are created within a scope, the scope is not by
   * default aware of them. If nodes are created and nothing references them,
   * then they are garbage collected.
   *
   * So there are two ways to reference graphs:
   *  - keep a reference to any node of the graph, then pass it to invoke() or
   *    serialize(). This is especially useful in the root scope.
   *  - create a graph, then pin it to the scope, and from then on refer to that
   *    scope when referring to a graph. This maps the mental model of nested
   *    scopes that define graphs. This also allows refering to a set of
   *    disjoint graphs (in the same scope).
   *
   * @param node node to pin to this scope
   */
  pin<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues,
  >(
    node: AbstractNode<I, O>
  ): void;

  /**
   * Reduces set of pinned pins to one per disjoint graph. Call this after
   * constructing a graph that might have pinned several nodes.
   */
  compactPins(): void;

  /**
   * Returns all pinned nodes in this scope. After calling compactPins(), this
   * will return one node representing each disjoint graph.
   *
   * @returns Array of pinned nodes
   */
  getPinnedNodes(): AbstractNode[];

  /**
   * Invokes a node, or all pinned nodes if none is specified.
   *
   * @param node Node to invoke, or undefined to invoke all pinned nodes
   * @returns Promise that resolves when all nodes have been invoked
   */
  invoke(node?: AbstractNode, state?: StateInterface): Promise<void>;

  /**
   * Helper to invoke a graph and return the values of the first `output` node
   * that is being invoked.
   *
   * @param inputs Inputs to be passed to `input` node
   * @param node Node to invoke, or undefined to invoke all pinned nodes
   *
   * @throws If no output node was called before graph terminates
   */
  invokeOneRound(
    inputs: InputValues,
    node?: AbstractNode,
    state?: StateInterface
  ): Promise<OutputValues>;

  /**
   * Adds callbacks that are being called before and after each node invocation
   * and once execution is done.
   *
   * `abort`, `before` and `after` will be called in invoked subgraphs as well.
   * `done` only for scope that the callback was added to.
   *
   * @param callbacks Callbacks to add to the scope
   */
  addCallbacks(callbacks: InvokeCallbacks): void;

  /**
   * Serializes a node, or all pinned nodes if none is specified.
   *
   * @param metadata Metadata to be added to serialized graph
   * @param node Node to serialize, or undefined to serialize all pinned nodes
   */
  serialize(
    metadata?: GraphCombinedMetadata,
    node?: AbstractNode
  ): Promise<GraphDescriptor>;
}
