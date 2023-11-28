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
import { getCurrentContextScope } from "./default-scope.js";
import { handlersFromKit } from "../runner/kits.js";

// TODO:BASE: This does two things
//   (1) register a handler with the scope
//   (2) create a factory function for the node type
// BASE should only be the first part, the second part should be in the syntax
export function addNodeType<I extends InputValues, O extends OutputValues>(
  name: string | undefined,
  handler: NodeHandler<I, O>
): NodeFactory<I, O> {
  if (name)
    getCurrentContextScope().addHandlers({
      [name]: handler as unknown as NodeHandler,
    });
  return ((config?: InputsMaybeAsValues<I>) => {
    return new BuilderNode(
      name ?? handler,
      getCurrentContextScope(),
      config
    ).asProxy();
  }) as unknown as NodeFactory<I, O>;
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
