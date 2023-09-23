/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
  KitConstructor,
} from "@google-labs/breadboard";
import { NodeHandlers } from "@google-labs/graph-runner";

export type GenericKit<T extends string | symbol | number> = Kit & {
  [key in T]: <In = unknown, Out = unknown>(
    config?: OptionalIdConfiguration
  ) => BreadboardNode<In, Out>;
};

export const makeKit = <T extends string | symbol | number>(
  handlers: NodeHandlers,
  kitNodes: readonly T[],
  url: string,
  prefix: string
) => {
  return class implements Kit {
    url = url;

    #handlers: NodeHandlers;

    get handlers() {
      return this.#handlers;
    }

    constructor(nodeFactory: NodeFactory) {
      this.#handlers = handlers;
      return new Proxy(this, {
        get(target, prop: string) {
          if (prop === "handlers" || prop === "url") {
            return target[prop];
          } else if (kitNodes.includes(prop as T)) {
            return (config: OptionalIdConfiguration = {}) => {
              const { $id, ...rest } = config;
              return nodeFactory.create(`${prefix}${prop}`, { ...rest }, $id);
            };
          }
        },
      });
    }
  } as unknown as KitConstructor<GenericKit<T>>;
};
