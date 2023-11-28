/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeProxy, AbstractValue, BuilderNodeInterface } from "./types.js";
import {
  InputValues,
  OutputValues,
  NodeHandler,
  NodeTypeIdentifier,
  NodeValue,
  OutputValue,
  KeyMap,
} from "../runner/types.js";

import { BuilderNode } from "./node.js";
import { BuilderScope } from "./scope.js";

// Because Value is sometimes behind a function Proxy (see above, for NodeImpl's
// methods), we need to use this approach to identify Value instead instanceof.
export const IsValueSymbol = Symbol("IsValue");

export function isValue<T extends NodeValue = NodeValue>(
  obj: unknown
): Value<T> | false {
  return (
    typeof obj === "object" &&
    (obj as unknown as { [key: symbol]: boolean })[IsValueSymbol] &&
    (obj as unknown as Value<T>)
  );
}

export class Value<T extends NodeValue = NodeValue>
  extends AbstractValue
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
    const toNode =
      to instanceof BuilderNode
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

  // TODO: Double check this, as it's acting on output types, not input types.
  in(inputs: BuilderNodeInterface<InputValues, OutputValues> | InputValues) {
    if (inputs instanceof BuilderNode || isValue(inputs)) {
      let invertedMap = Object.fromEntries(
        Object.entries(this.#keymap).map(([fromKey, toKey]) => [toKey, fromKey])
      );
      const asValue = isValue(inputs);
      if (asValue) {
        invertedMap = asValue.#remapKeys(invertedMap);
        this.#node.addInputsFromNode(asValue.#node, invertedMap);
      } else {
        this.#node.addInputsFromNode(
          inputs as BuilderNodeInterface,
          invertedMap
        );
      }
    } else {
      this.#node.addInputsAsValues(inputs as InputValues);
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
