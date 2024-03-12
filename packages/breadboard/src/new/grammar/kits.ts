/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputsMaybeAsValues, NodeFactory } from "./types.js";
import { InputValues, OutputValues, NodeHandler } from "../runner/types.js";
import {
  Kit,
  KitConstructor,
  NodeFactory as OriginalNodeFactory,
} from "../../types.js";

import { BuilderNode } from "./node.js";
import { handlersFromKit } from "../runner/kits.js";
import { getCurrentContextScope } from "./scope.js";

export function addNodeType<I extends InputValues, O extends OutputValues>(
  name: string | undefined,
  handler: NodeHandler<I, O>
): NodeFactory<I, O> {
  if (name) registerNodeType(name, handler as unknown as NodeHandler);
  return ((config?: InputsMaybeAsValues<I>) => {
    return new BuilderNode(
      name ?? handler,
      getCurrentContextScope(),
      config
    ).asProxy();
  }) as unknown as NodeFactory<I, O>;
}

export function registerNodeType(name: string, handler: NodeHandler) {
  getCurrentContextScope().addHandlers({ [name]: handler });
}

// Extracts handlers from kits and creates node factories for them.
export function addKit<T extends Kit>(
  ctr: KitConstructor<T>,
  namespacePrefix = ""
): { [key: string]: NodeFactory<InputValues, OutputValues> } {
  const kit = new ctr({} as unknown as OriginalNodeFactory);
  const handlers = handlersFromKit(kit);
  const removeNamespacePrefix = namespacePrefix
    ? (name: string) => {
        return name.startsWith(namespacePrefix)
          ? name.slice(namespacePrefix.length)
          : name;
      }
    : (name: string) => name;
  return Object.fromEntries(
    Object.entries(handlers).map(([name, handler]) => [
      removeNamespacePrefix(name),
      addNodeType(name, handler),
    ])
  );
}
