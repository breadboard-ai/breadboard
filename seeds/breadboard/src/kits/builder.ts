/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConfigOrLambda,
  GenericKit,
  InputValues,
  Kit,
  KitConstructor,
  NodeFactory,
  NodeHandlers,
  OutputValues,
} from "../types.js";

export type KitBuilderOptions = {
  url: string;
  title?: string;
  description?: string;
  version?: string;
  namespacePrefix?: string;
};

export class KitBuilder {
  url: string;
  title?: string;
  description?: string;
  version?: string;
  namespacePrefix?: string;

  constructor({
    title,
    description,
    version,
    url,
    namespacePrefix = "",
  }: KitBuilderOptions) {
    this.url = url;
    this.title = title;
    this.description = description;
    this.version = version;
    this.namespacePrefix = namespacePrefix;
  }

  #addPrefix(handlers: NodeHandlers) {
    return Object.keys(handlers).reduce((acc, key) => {
      acc[`${this.namespacePrefix}${key}`] = handlers[key];
      return acc;
    }, {} as NodeHandlers);
  }

  build<Handlers extends NodeHandlers>(handlers: Handlers) {
    type NodeNames = [x: Extract<keyof Handlers, string>];

    if (!this.url) throw new Error(`Builder was not yet initialized.`);
    const url = this.url;
    const prefix = this.namespacePrefix;
    const { title, description, version } = this;

    const prefixedHandlers = this.#addPrefix(handlers);

    const nodes = Object.keys(handlers);

    return class implements Kit {
      title = title;
      description = description;
      version = version;
      url = url;

      get handlers() {
        return prefixedHandlers;
      }

      constructor(nodeFactory: NodeFactory) {
        const proxy = new Proxy(this, {
          get(target, prop: string) {
            if (prop === "handlers" || prop === "url") {
              return target[prop];
            } else if (nodes.includes(prop as NodeNames[number])) {
              return (
                configOrLambda: ConfigOrLambda<InputValues, OutputValues> = {}
              ) => {
                const config = nodeFactory.getConfigWithLambda(configOrLambda);
                const { $id, ...rest } = config;
                return nodeFactory.create(
                  proxy as unknown as Kit,
                  `${prefix}${prop}`,
                  { ...rest },
                  $id
                );
              };
            }
          },
        });
        return proxy;
      }
    } as KitConstructor<GenericKit<Handlers>>;
  }
}
