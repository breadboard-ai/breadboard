/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  OutputValues,
  NodeHandlers,
  NodeFactory,
} from "./types.js";
import {
  Kit,
  KitConstructor,
  InputValues as OriginalInputValues,
  NodeFactory as OriginalNodeFactory,
} from "../types.js";

import { addNodeType } from "./default-scope.js";

// TODO:BASE: This is wraps classic handlers that expected resolved inputs
// into something that accepts promises. We should either change all handlers
// to support promises or add a flag or something to support either mode.
// (Almost all handlers will immediately await, so it's a bit of a pain...)
export function handlersFromKit(kit: Kit): NodeHandlers {
  return Object.fromEntries(
    Object.entries(kit.handlers).map(([name, handler]) => {
      const handlerFunction =
        handler instanceof Function ? handler : handler.invoke;
      return [
        name,
        {
          invoke: async (inputs) => {
            return handlerFunction(
              (await inputs) as OriginalInputValues,
              {}
            ) as Promise<OutputValues>;
          },
        },
      ];
    })
  );
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
