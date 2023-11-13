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
  NodeHandler,
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

/* eslint-disable  @typescript-eslint/no-explicit-any */
type FunctionsKeysOnly<T> = ({ [P in keyof T]: T[P] extends (...args: any[]) => void ? P : never })[keyof T];
type FunctionsOnly<T> = Pick<T, FunctionsKeysOnly<T>>;

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

  static wrap<F extends Record<string, Function>>(params: KitBuilderOptions, functions: F): KitConstructor<GenericKit<{ [x in keyof FunctionsOnly<F>]: NodeHandler }>> {
    
    const createHandler = (previous: NodeHandlers, current: [string, Function]) => {
      const [name, fn] = current;

      previous[name] = {
        invoke: async (inputs: InputValues) => {
          const argNames = fn.toString().match(/\((.*?)\)/)?.[1].split(",") ?? [];

          // Validate the input names.
          for (const argName of argNames) {
            if (argName.trim() in inputs === false) { // Maybe we should use hasOwnProperty here?
              throw new Error(`Missing input: ${argName.trim()}. Valid inputs are: ${Object.keys(inputs).join(", ")}`);
            }
          }

          const args = argNames.map((argName: string) => inputs[argName.trim()]);

          const results = await fn(...args);

          if (typeof results !== "object" || Array.isArray(results)) {
            // Number, Boolean, Array, String, will output to `result`.
            return { result: results };
          }

          // Objects will destructured into the output.
          return { ...results };
        }
      };
      return previous;
    }

    const handlers = Object.entries(functions).reduce<NodeHandlers>(createHandler, {});

    const builder = new KitBuilder(params);

    return builder.build(handlers) as KitConstructor<GenericKit<{ [x in keyof FunctionsOnly<F>]: NodeHandler }>>;
  }
}
