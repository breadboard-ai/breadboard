/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitDescriptor, KitTag } from "@breadboard-ai/types";
import {
  ConfigOrGraph,
  GenericKit,
  InputValues,
  Kit,
  KitConstructor,
  NodeFactory,
  NodeHandler,
  NodeHandlers,
} from "../types.js";

export type KitBuilderOptions = KitDescriptor & {
  namespacePrefix?: string;
};

/* eslint-disable  @typescript-eslint/no-explicit-any */
type FunctionsKeysOnly<T> = {
  [P in keyof T]: T[P] extends (...args: any[]) => void ? P : never;
}[keyof T];
type FunctionsOnly<T> = Pick<T, FunctionsKeysOnly<T>>;

export class KitBuilder {
  url: string;
  title?: string;
  description?: string;
  version?: string;
  namespacePrefix?: string;
  tags: KitTag[];

  constructor({
    title,
    description,
    version,
    url,
    namespacePrefix = "",
    tags = [],
  }: KitBuilderOptions) {
    this.url = url;
    this.title = title;
    this.description = description;
    this.version = version;
    this.namespacePrefix = namespacePrefix;
    this.tags = tags;
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
    const { title, description, version, tags } = this;

    const prefixedHandlers = this.#addPrefix(handlers);

    const nodes = Object.keys(handlers);

    return class implements Kit {
      title = title;
      description = description;
      version = version;
      url = url;
      tags = tags;

      get handlers() {
        return prefixedHandlers;
      }

      constructor(nodeFactory: NodeFactory) {
        const proxy = new Proxy(this, {
          get(target, prop: string) {
            if (
              prop === "handlers" ||
              prop === "url" ||
              prop === "title" ||
              prop === "tags"
            ) {
              return target[prop];
            } else if (nodes.includes(prop as NodeNames[number])) {
              return (configOrGraph: ConfigOrGraph = {}) => {
                const config = nodeFactory.getConfigWithLambda(configOrGraph);
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

  static wrap<F extends Record<string, Function>>(
    params: KitBuilderOptions,
    functions: F
  ): KitConstructor<
    GenericKit<{ [x in keyof FunctionsOnly<F>]: NodeHandler }>
  > {
    const createHandler = (
      previous: NodeHandlers,
      current: [string, Function]
    ) => {
      const [name, fn] = current;

      previous[name] = {
        invoke: async (inputs: InputValues) => {
          // JS can have rest args, eg. "...args" as a parameter at the end of a function, but breadboard cannot accept "." so we use "___".

          let argNames: string[] = [];
          if (fn && fn.length > 0) {
            argNames =
              fn
                .toString()
                .match(/\((.+?)\)/)?.[1]
                .split(",") ?? [];

            /*
            If fn.length is greater than 1 and argNames.length = 0, then we likely have a system function that accepts a splat of arguments..

            e.g Math.max([1,2,3,4])

            We need to special case this and pass the arguments as an array and expect `inputs` to have a key of `args` that is an array.
            */

            if (
              fn.length > 1 &&
              argNames.length === 0 &&
              "___args" in inputs &&
              Array.isArray(inputs["___args"])
            ) {
              argNames = ["___args"];
            }
          }

          // Validate the input names.
          for (const argName of argNames) {
            if (argName.trim() in inputs === false) {
              throw new Error(
                `Missing input: ${argName.trim()}. Valid inputs are: ${Object.keys(
                  inputs
                ).join(", ")}`
              );
            }
          }

          const args = argNames
            .filter((argName) => argName.startsWith("___") == false)
            .map((argName: string) => inputs[argName.trim()]);

          const lastArgName = argNames[argNames.length - 1];
          if (lastArgName != undefined && lastArgName.startsWith("___")) {
            // Splat the rest of the arguments.
            args.push(...(<Array<any>>inputs[lastArgName]));
          }

          const results = await fn(...args);

          if (typeof results !== "object" || Array.isArray(results)) {
            // Number, Boolean, Array, String, will output to `result`.
            return { result: results };
          }

          // Objects will destructured into the output.
          return { ...results };
        },
      };
      return previous;
    };

    const handlers = Object.entries(functions).reduce<NodeHandlers>(
      createHandler,
      {}
    );

    const builder = new KitBuilder(params);

    return builder.build(handlers) as KitConstructor<
      GenericKit<{ [x in keyof FunctionsOnly<F>]: NodeHandler }>
    >;
  }
}
