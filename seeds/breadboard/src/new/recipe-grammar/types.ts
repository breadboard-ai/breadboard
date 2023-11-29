/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeValue as BaseNodeValue,
  OutputValue,
  NodeTypeIdentifier,
  NodeHandler,
  KeyMap,
  AbstractNode,
} from "../runner/types.js";

export type NodeValue = BaseNodeValue | NodeFactory<InputValues, OutputValues>;
export type InputValues = { [key: string]: NodeValue };
export type OutputValues = { [key: string]: NodeValue };

// TODO:BASE: This is pure syntactic sugar and should _not_ be moved
export type InputsMaybeAsValues<
  T extends InputValues,
  NI extends InputValues = InputValues
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

export type NodeFactory<I extends InputValues, O extends OutputValues> = (
  config?:
    | AbstractNode<InputValues, I>
    | AbstractValue<NodeValue>
    | InputsMaybeAsValues<I>
) => NodeProxy<I, O>;

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
  createTrapResult<I extends InputValues, O extends OutputValues>(
    node: AbstractNode<I, O>
  ): O;
  didTrapResultTrigger(): boolean;
}
