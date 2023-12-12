/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeValue,
  InputValues,
  InputsMaybeAsValues,
  OutputValues,
  NodeProxy,
  BuilderNodeInterface,
  BuilderNodeConfig,
  AbstractValue,
} from "./types.js";
import {
  OutputValue,
  NodeHandler,
  NodeTypeIdentifier,
  KeyMap,
} from "../runner/types.js";

import { BuilderNode, isBuilderNodeProxy } from "./node.js";
import { BuilderScope } from "./scope.js";

// Because Value is sometimes behind a function Proxy (see NodeImpl's methods),
// we need to use this approach to identify Value instead instanceof.
export const IsValueSymbol = Symbol("IsValue");

export function isValue<T extends NodeValue = NodeValue>(
  obj: unknown
): obj is Value<T> {
  return (
    (typeof obj === "object" || typeof obj === "function") &&
    (obj as unknown as { [key: symbol]: boolean })[IsValueSymbol] !== undefined
  );
}

export class Value<T extends NodeValue = NodeValue>
  extends AbstractValue<T>
  implements PromiseLike<T | undefined>
{
  #node: BuilderNode<InputValues, OutputValue<T>>;
  #scope: BuilderScope;
  #keymap: KeyMap;
  #constant: boolean;

  constructor(
    node: BuilderNode<InputValues, OutputValue<T>>,
    scope: BuilderScope,
    keymap: string | KeyMap,
    constant = false
  ) {
    super();
    this.#node = node;
    this.#scope = scope;
    this.#keymap = typeof keymap === "string" ? { [keymap]: keymap } : keymap;
    (this as unknown as { [key: symbol]: Value<T> })[IsValueSymbol] = this;
    this.#constant = constant;
  }

  then<TResult1 = T | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: T | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (Object.keys(this.#keymap).length !== 1)
      throw Error("Can't `await` for multiple values");
    return this.#node.then(
      (o) =>
        o &&
        onfulfilled &&
        this.#scope.asScopeFor(onfulfilled)(o[Object.keys(this.#keymap)[0]]),
      onrejected && this.#scope.asScopeFor(onrejected)
    ) as PromiseLike<TResult1 | TResult2>;
  }

  asNodeInput(): [
    BuilderNodeInterface<InputValues, OutputValue<T>>,
    { [key: string]: string },
    boolean
  ] {
    return [this.#node.unProxy(), this.#keymap, this.#constant];
  }

  to<
    ToO extends OutputValues = OutputValues,
    ToC extends InputValues = InputValues
  >(
    to:
      | NodeProxy<OutputValue<T> & ToC, ToO>
      | NodeTypeIdentifier
      | NodeHandler<OutputValue<T> & ToC, ToO>,
    config?: ToC
  ): NodeProxy<OutputValue<T> & ToC, ToO> {
    const toNode = isBuilderNodeProxy(to)
      ? to.unProxy()
      : new BuilderNode(
          to as NodeTypeIdentifier | NodeHandler<OutputValue<T> & ToC, ToO>,
          this.#scope,
          config as OutputValue<T> & ToC
        );

    toNode.addInputsFromNode(
      this.#node as unknown as BuilderNodeInterface,
      this.#keymap,
      this.#constant
    );

    return (
      toNode as BuilderNodeInterface<OutputValue<T> & ToC, ToO>
    ).asProxy();
  }

  // This doesn't do any type checking on the inputs.
  //
  // TODO: See whether that's somehow possible. The main problem is that
  // node.<field> is typed for the outputs. We could add a new InputValue type
  // and generate those from node.in().field so that the final syntax could be
  // `toNode.toField.in(fromNode.in().fromField)`.
  //
  // That is, today .in() on a value returns void and in the future it would
  // return that new InputValue type, typed with the right input value from the
  // original node. To accomplish this, we'll have to keep passing the
  // node input values type through the chain of values and .as() statements.
  in(
    inputs:
      | BuilderNodeInterface<InputValues, OutputValues>
      | AbstractValue<NodeValue>
      | InputsMaybeAsValues<InputValues>
  ) {
    let invertedMap = Object.fromEntries(
      Object.entries(this.#keymap).map(([fromKey, toKey]) => [toKey, fromKey])
    );

    if (isValue(inputs)) {
      invertedMap = inputs.#remapKeys(invertedMap);
      this.#node.addInputsFromNode(inputs.#node, invertedMap);
    } else if (isBuilderNodeProxy(inputs)) {
      this.#node.addInputsFromNode(inputs.unProxy(), invertedMap);
    } else {
      this.#node.addInputsAsValues(inputs as InputsMaybeAsValues<InputValues>);
    }
  }

  as(newKey: string | KeyMap): Value<T> {
    let newMap: KeyMap;
    if (typeof newKey === "string") {
      if (Object.keys(this.#keymap).length !== 1)
        throw new Error("Can't rename multiple values with a single string");
      newMap = { [Object.keys(this.#keymap)[0]]: newKey };
    } else {
      newMap = this.#remapKeys(newKey);
    }

    return new Value(this.#node, this.#scope, newMap, this.#constant);
  }

  memoize() {
    return new Value(this.#node, this.#scope, this.#keymap, true);
  }

  // Create a node for the lambda that is being sent as this value. At this
  // point we can't verify that this actually is a BoardCapability, so we just
  // do it and let the runtime throw an error if this wasn't one.
  invoke(config?: BuilderNodeConfig): NodeProxy {
    return new BuilderNode("invoke", this.#scope, {
      ...config,
      board: this,
    }).asProxy();
  }

  #remapKeys(newKeys: KeyMap) {
    const newMap = { ...this.#keymap };
    Object.entries(newKeys).forEach(([fromKey, toKey]) => {
      if (this.#keymap[toKey]) {
        newMap[fromKey] = this.#keymap[toKey];
        delete this.#keymap[toKey];
      } else {
        newMap[fromKey] = toKey;
      }
    });
    return newMap;
  }
}
