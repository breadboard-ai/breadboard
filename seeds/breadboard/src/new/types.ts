/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeDescriptor,
  GraphDescriptor,
  GraphMetadata,
  NodeDescriberFunction,
} from "../types.js";

// TODO:BASE: Same as before, but I added NodeFactory as base type, which is a
// way to encapsulate boards, including lambdas (instead of BoardCapability).
// Can keep it a capability, but this feels quite fundamental.

export type NodeValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodeValue[]
  | PromiseLike<NodeValue>
  | { [key: string]: NodeValue }
  | NodeFactory<InputValues, OutputValues>;
export type NodeTypeIdentifier = string;

export type InputValues = { [key: string]: NodeValue };

export type OutputValues = { [key: string]: NodeValue };
export type OutputValue<T> = Partial<{ [key: string]: T }>;

// TODO:BASE: This is pure syntactic sugar and should _not_ be moved
export type InputsMaybeAsValues<
  T extends InputValues,
  NI extends InputValues = InputValues
> = Partial<{
  [K in keyof T]: AbstractValue<T[K]> | NodeProxy<NI, OutputValue<T[K]>> | T[K];
}> & {
  [key in string]:
    | AbstractValue<NodeValue>
    | NodeProxy<NI, Partial<InputValues>>
    | NodeValue;
};

// TODO:BASE: Allowing inputs to be promises. In syntactic sugar this should
// actually be a NodeProxy on an input node (which looks like a promise).
export type NodeHandlerFunction<
  I extends InputValues,
  O extends OutputValues
> = (
  inputs: PromiseLike<I> & InputsMaybeAsValues<I>,
  node: AbstractNode<I, O>
) => InputsMaybeAsValues<O> | PromiseLike<O>;

// TODO:BASE: New: Allow handlers to accepts inputs as a promise.
// See also hack in handlersFromKit().
export type NodeHandler<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> =
  | {
      invoke: NodeHandlerFunction<I, O>;
      describe?: NodeDescriberFunction;
    }
  | NodeHandlerFunction<I, O>;

export type NodeHandlers = Record<
  NodeTypeIdentifier,
  NodeHandler<InputValues, OutputValues>
>;

export type NodeFactory<I extends InputValues, O extends OutputValues> = (
  config?:
    | AbstractNode<InputValues, I>
    | AbstractValue<NodeValue>
    | InputsMaybeAsValues<I>
) => NodeProxy<I, O>;

export interface Serializeable {
  serialize(
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> | GraphDescriptor;
}

export type KeyMap = { [key: string]: string };

export type NodeProxyMethods<I extends InputValues, O extends OutputValues> = {
  then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<O & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<O & ToC, ToO>,
    config?: ToC
  ): NodeProxy<O & ToC, ToO>;
  in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | AbstractValue<NodeValue>
  ): NodeProxy<I, O>;
  as(keymap: KeyMap): AbstractValue;
};

// TODO:BASE This is almost `Edge`, except that it's references to nodes and not
// node ids. Also optional is missing.
export interface EdgeInterface<
  FromI extends InputValues = InputValues,
  FromO extends OutputValues = OutputValues,
  ToI extends InputValues = InputValues,
  ToO extends OutputValues = OutputValues
> {
  from: AbstractNode<FromI, FromO>;
  to: AbstractNode<ToI, ToO>;
  out: string;
  in: string;
  constant?: boolean;
}
export type OptionalIdConfiguration = { $id?: string };

export abstract class AbstractNode<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> implements Serializeable
{
  abstract id: string;
  abstract type: string;
  abstract outgoing: EdgeInterface[];
  abstract incoming: EdgeInterface[];
  abstract configuration: Partial<I>;

  abstract receiveInputs(edge: EdgeInterface, inputs: InputValues): string[];
  abstract missingInputs(): string[] | false;

  abstract getInputs(): InputsMaybeAsValues<I>;

  abstract invoke(invokingScope?: ScopeInterface): Promise<O>;

  abstract serialize(metadata?: GraphMetadata): Promise<GraphDescriptor>;

  abstract serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]>;

  /*
  abstract then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;

  abstract to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<O & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<O & ToC, ToO>,
    config?: ToC
  ): NodeProxy<O & ToC, ToO>;

  abstract in(
    inputs:
      | NodeProxy<InputValues, Partial<I>>
      | InputsMaybeAsValues<I>
      | AbstractValue
  ): NodeProxy<I, O>;

  abstract as(keymap: KeyMap): AbstractValue;*/
}

export interface BuilderNodeInterface<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> extends AbstractNode<I, O> {
  addInputsAsValues(values: InputsMaybeAsValues<I>): void;
  addInputsFromNode(
    from: AbstractNode,
    keymap: KeyMap,
    constant?: boolean
  ): void;

  asProxy(): NodeProxy<I, O>;
  unProxy(): BuilderNodeInterface<I, O>;
}

export abstract class AbstractValue<T extends NodeValue = NodeValue>
  implements PromiseLike<T | undefined>
{
  abstract then<TResult1 = T | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: T | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;

  abstract asNodeInput(): [AbstractNode, { [key: string]: string }, boolean];

  abstract to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<OutputValue<T> & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<OutputValue<T> & ToC, ToO>,
    config?: ToC
  ): NodeProxy<OutputValue<T> & ToC, ToO>;

  // TODO: Double check this, as it's acting on output types, not input types.
  abstract in(
    inputs: AbstractNode<InputValues, OutputValues> | InputValues
  ): void;

  abstract as(newKey: string | KeyMap): AbstractValue<T>;

  abstract memoize(): AbstractValue<T>;
}

/**
 * Intersection between a Node and a Promise for its output:
 *  - Has all the output fields as Value<T> instances.
 *  - Has all the methods of the NodeProxyInterface defined above.
 *  - Including then() which makes it a PromiseLike<O>
 */
export type NodeProxy<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> = {
  [K in keyof O]: AbstractValue<O[K]> & ((...args: unknown[]) => unknown);
} & {
  [key in string]: AbstractValue<NodeValue> & ((...args: unknown[]) => unknown);
} & NodeProxyMethods<I, O>;

export interface OutputDistribution {
  nodes: {
    node: AbstractNode;
    received: string[];
    missing: string[] | false;
  }[];
  unused: string[];
}

export interface InvokeCallbacks {
  before?: (
    node: AbstractNode,
    inputs: InputValues
  ) => undefined | Promise<OutputValues | undefined>;
  after?: (
    node: AbstractNode,
    inputs: InputValues,
    outputs: OutputValues,
    distribution: OutputDistribution
  ) => void | Promise<void>;
  done?: () => void | Promise<void>;
}

export interface ScopeInterface {
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
    O extends OutputValues = OutputValues
  >(
    name: string
  ): NodeHandler<I, O> | undefined;

  serialize(
    node: AbstractNode,
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor>;
}

export interface DeclaringScopeInterface {
  /**
   * Swap global scope with this one, run the function, then restore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asScopeFor<T extends (...args: any[]) => any>(fn: T): T;

  createTrapResult<I extends InputValues, O extends OutputValues>(
    node: AbstractNode<I, O>
  ): O;
  didTrapResultTrigger(): boolean;
  invoke(node: AbstractNode, callbacks?: InvokeCallbacks[]): void;

  serializing(): boolean;
}
