/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata } from "@breadboard-ai/types";
import {
  BreadboardCapability,
  NodeDescriberFunction,
  GraphInlineMetadata,
  Schema,
  BehaviorSchema,
} from "../../types.js";

import {
  NodeValue as BaseNodeValue,
  OutputValue,
  NodeTypeIdentifier,
  NodeHandler,
  KeyMap,
  AbstractNode,
  Serializeable,
} from "../runner/types.js";

export type GraphCombinedMetadata = GraphInlineMetadata & {
  metadata?: GraphMetadata;
};

export type NodeValue =
  | BaseNodeValue
  | NodeFactory<InputValues, OutputValuesOrUnknown>;
export type InputValues = { [key: string]: NodeValue };
export type OutputValues = { [key: string]: NodeValue };

export type InputsMaybeAsValues<
  T extends InputValues,
  NI extends InputValues = InputValues,
> = Partial<{
  [K in keyof T]: AbstractValue<T[K]> | NodeProxy<NI, OutputValue<T[K]>> | T[K];
}> & {
  [key in string]:
    | AbstractValue<NodeValue>
    | NodeProxy<NI, Partial<InputValues>>
    | NodeValue;
};

export type OutputsMaybeAsValues<
  T extends OutputValuesOrUnknown,
  NI extends InputValues = InputValues,
> = Partial<{
  [K in keyof T]:
    | AbstractValue<T[K]>
    | NodeProxy<NI, OutputValue<T[K]>>
    | T[K]
    | unknown;
}> & {
  [key in string]:
    | AbstractValue<NodeValue>
    | NodeProxy<NI, Partial<InputValues>>
    | NodeValue;
};

export type OutputValuesOrUnknown = { [key: string]: NodeValue | unknown };
export type ProjectBackToOutputValues<O extends OutputValuesOrUnknown> = {
  [K in keyof O]: O[K] extends NodeValue ? O[K] : NodeValue;
};

export type NodeFactory<
  I extends InputValues = InputValues,
  O extends OutputValuesOrUnknown = OutputValuesOrUnknown,
> = (
  config?:
    | AbstractNode<InputValues, I>
    | AbstractValue<NodeValue>
    | InputsMaybeAsValues<I>
) => NodeProxy<I, O>;

export type InputsForHandler<T extends InputValues> = {
  [K in keyof T]: AbstractValue<T[K]> &
    PromiseLike<T[K]> &
    ((config?: BuilderNodeConfig) => NodeProxy);
} & {
  [key in string]: AbstractValue<NodeValue> & PromiseLike<NodeValue>;
} & PromiseLike<T>;

export type InputsForGraphDeclaration<T extends InputValues> = {
  [K in keyof T]: AbstractValue<T[K]> &
    ((config?: BuilderNodeConfig) => NodeProxy);
} & {
  [key in string]: AbstractValue<NodeValue>;
};

export type OutputsForGraphDeclaration<
  T extends OutputValuesOrUnknown,
  NI extends InputValues = InputValues,
> =
  | ({
      [K in keyof T]: AbstractValue<T[K]> | NodeProxy<NI, OutputValue<T[K]>>;
    } & {
      [key in string]:
        | AbstractValue<NodeValue>
        | NodeProxy<NI, Partial<InputValues>>;
    })
  | PromiseLike<OutputsMaybeAsValues<T>> // = returning a node
  | void; // = returning nothing, i.e. expect nodes to be pinned instead

export type NodeProxyHandlerFunction<
  I extends InputValues = InputValues,
  O extends OutputValuesOrUnknown = OutputValuesOrUnknown,
> = (
  inputs: InputsForHandler<I>,
  node: AbstractNode<I, ProjectBackToOutputValues<O>>
) =>
  | O
  | PromiseLike<O>
  | OutputsMaybeAsValues<O>
  | PromiseLike<OutputsMaybeAsValues<O>>;

export type GraphDeclarationFunction<
  I extends InputValues = InputValues,
  O extends OutputValuesOrUnknown = OutputValuesOrUnknown,
> = (
  inputs: InputsForGraphDeclaration<I>,
  base: { [key: string]: NodeFactory<InputValues, OutputValues> }
) => OutputsForGraphDeclaration<O>;

export type Lambda<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> = NodeFactory<I, O> & Serializeable & ClosureNodeInterface;

export interface BoardFactory {
  /**
   * Creates a node factory for a node type that invokes a handler function.
   * This version infers the types from the function.
   *
   * The handler function can either return a graph (in which case it would be
   * serialized to a graph), or returns the results of a computation, called at
   * runtime and serialized as Javascript.
   *
   * @param fn Handler or graph creation function
   */
  <I extends InputValues = InputValues, O extends OutputValues = OutputValues>(
    fn: GraphDeclarationFunction<I, O>
  ): Lambda<I, Required<O>>;

  <I extends InputValues = InputValues, O extends OutputValues = OutputValues>(
    opts: {
      input?: Schema;
      output?: Schema;
      graph?: GraphDeclarationFunction;
      invoke?: NodeProxyHandlerFunction;
      describe?: NodeDescriberFunction;
      name?: string;
    } & GraphCombinedMetadata
  ): Lambda<I, Required<O>>;

  <I extends InputValues = InputValues, O extends OutputValues = OutputValues>(
    opts: {
      input?: Schema;
      output?: Schema;
      graph?: GraphDeclarationFunction;
      invoke?: NodeProxyHandlerFunction;
      describe?: NodeDescriberFunction;
      name?: string;
    } & GraphCombinedMetadata,
    fn: GraphDeclarationFunction<I, O>
  ): Lambda<I, Required<O>>;
}

export type NodeProxyMethods<I extends InputValues, O extends OutputValues> = {
  then<TResult1 = O, TResult2 = never>(
    onfulfilled?: ((value: O) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues,
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

export interface BuilderNodeInterface<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> extends AbstractNode<I, O> {
  addInputsAsValues(values: InputsMaybeAsValues<I>): void;
  addInputsFromNode(
    from: AbstractNode,
    keymap: KeyMap,
    constant?: boolean,
    schema?: Schema
  ): void;

  asProxy(): NodeProxy<I, O>;
  unProxy(): BuilderNodeInterface<I, O>;
}

export type BuilderNodeConfig<I extends InputValues = InputValues> =
  | Partial<InputsMaybeAsValues<I>>
  | AbstractValue<NodeValue>
  | BuilderNodeInterface<InputValues, Partial<I>>
  | { $id?: string };

export type ClosureNodeInterface<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> = Pick<BuilderNodeInterface<I, O>, "unProxy"> &
  Pick<NodeProxyMethods<I, O>, "in"> &
  Pick<AbstractValue<NodeValue>, "invoke"> & {
    getBoardCapabilityAsValue():
      | AbstractValue<BreadboardCapability>
      | Promise<BreadboardCapability>;
  };

export abstract class AbstractValue<T extends NodeValue = NodeValue>
  implements PromiseLike<T | undefined>
{
  abstract then<TResult1 = T | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: T | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;

  abstract asNodeInput(): [
    AbstractNode,
    { [key: string]: string },
    boolean,
    Schema,
  ];

  abstract to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues,
  >(
    to:
      | NodeProxy<OutputValue<T> & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<OutputValue<T> & ToC, ToO>,
    config?: ToC
  ): NodeProxy<OutputValue<T> & ToC, ToO>;

  abstract in(
    inputs:
      | AbstractNode<InputValues, OutputValues>
      | AbstractValue<NodeValue>
      | InputsMaybeAsValues<InputValues>
  ): void;

  abstract as(newKey: string | KeyMap): AbstractValue<T>;

  abstract memoize(): AbstractValue<T>;

  abstract invoke(config?: BuilderNodeConfig): NodeProxy;

  abstract isUnknown(): AbstractValue<unknown>;
  abstract isString(): AbstractValue<string>;
  abstract isNumber(): AbstractValue<number>;
  abstract isBoolean(): AbstractValue<boolean>;
  abstract isArray(): AbstractValue<NodeValue[]>;
  abstract isObject(): AbstractValue<{ [key: string]: NodeValue }>;

  abstract title(title: string): AbstractValue<T>;
  abstract format(format: string): AbstractValue<T>;

  abstract description(description: string): AbstractValue<T>;
  abstract examples(...examples: string[]): AbstractValue<T>;
  abstract default(value: string): AbstractValue<T>;
  abstract optional(): AbstractValue<T>;

  /**
   * Specifies additional behaviors for the value.
   * Use this to better identify the shape of the value.
   * @see [BehaviorSchema]
   * @param tags -- a list of behavior tags to apply to the
   * value. Must be one of the values in `BehaviorSchema`.
   */
  abstract behavior(...tags: BehaviorSchema[]): AbstractValue<T>;
}

/**
 * Intersection between a Node and a Promise for its output:
 *  - Has all the output fields as Value<T> instances.
 *  - Has all the methods of the NodeProxyInterface defined above.
 *  - Including then() which makes it a PromiseLike<O>
 */
export type NodeProxy<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues,
> = {
  [K in keyof O]: AbstractValue<O[K]> & ((...args: unknown[]) => unknown);
} & {
  [key in string]: AbstractValue<NodeValue> & ((...args: unknown[]) => unknown);
} & NodeProxyMethods<I, O>;

export interface ClosureEdge {
  scope: BuilderScopeInterface;
  from: BuilderNodeInterface;
  to: BuilderNodeInterface;
  out: string;
  in: string;
}

export interface BuilderScopeInterface {
  /**
   * Swap global scope with this one, run the function, then restore
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asScopeFor<T extends (...args: any[]) => any>(fn: T): T;

  /**
   * Helpers to detect handlers that construct graphs but don't invoke them.
   */
  serializing(): boolean;

  /**
   * used by board() and node.addIncomingEdges() to auto-wire closures
   */
  addClosureEdge(edge: ClosureEdge): void;
  getClosureEdges(): ClosureEdge[];
}
