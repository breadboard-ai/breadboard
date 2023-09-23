/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitDescriptor, NodeHandlers } from "@google-labs/graph-runner";
import {
  GenericKit,
  Kit,
  KitConstructor,
  NodeFactory,
  OptionalIdConfiguration,
} from "./types.js";

const urlToNpmSpec = (url: string): string => {
  const urlObj = new URL(url);
  if (urlObj.protocol !== "npm:") {
    throw new Error(`URL protocol must be "npm:"`);
  }
  return urlObj.pathname;
};

export class KitLoader {
  #kits: KitDescriptor[];
  constructor(kits?: KitDescriptor[]) {
    this.#kits = kits ?? [];
  }

  async load(): Promise<KitConstructor<Kit>[]> {
    return (
      await Promise.all(
        this.#kits.map(async (kit) => {
          // TODO: Support `using` property.
          const { url } = kit;
          // TODO: Support protocols other than `npm:`.
          if (url === ".") return null;
          const spec = urlToNpmSpec(url);
          const { default: module } = await import(/* @vite-ignore */ spec);
          // TODO: Check to see if this import is actually a Kit class.
          return module;
        })
      )
    ).filter(Boolean);
  }
}

export const makeKit = <T extends readonly string[]>(
  handlers: NodeHandlers,
  nodes: T,
  url: string,
  prefix: string
) => {
  return class implements Kit {
    url = url;

    get handlers() {
      return handlers;
    }

    constructor(nodeFactory: NodeFactory) {
      return new Proxy(this, {
        get(target, prop: string) {
          if (prop === "handlers" || prop === "url") {
            return target[prop];
          } else if (nodes.includes(prop as T[number])) {
            return (config: OptionalIdConfiguration = {}) => {
              const { $id, ...rest } = config;
              return nodeFactory.create(`${prefix}${prop}`, { ...rest }, $id);
            };
          }
        },
      });
    }
  } as KitConstructor<GenericKit<T>>;
};
