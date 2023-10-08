/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  KitDescriptor,
  NodeHandlers,
  NodeIdentifier,
} from "@google-labs/graph-runner";
import {
  GenericKit,
  Kit,
  KitConstructor,
  KitImportMap,
  NodeFactory,
  NodeHandlerContext,
  OptionalIdConfiguration,
} from "./types.js";
import { Board } from "./board.js";

const urlToNpmSpec = (url: string): string => {
  const urlObj = new URL(url);
  if (urlObj.protocol !== "npm:") {
    throw new Error(`URL protocol must be "npm:"`);
  }
  return urlObj.pathname;
};

export class KitLoader {
  #kits: KitDescriptor[];
  #imports: KitImportMap;

  constructor(kits?: KitDescriptor[], imports?: KitImportMap) {
    this.#kits = kits ?? [];
    this.#imports = imports ?? {};
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

          const importedKit = this.#imports[spec];
          if (importedKit) return importedKit;

          const { default: module } = await import(/* @vite-ignore */ spec);
          // TODO: Check to see if this import is actually a Kit class.
          return module;
        })
      )
    ).filter(Boolean);
  }
}

export type KitBuilderOptions = {
  graph: GraphDescriptor;
  baseUrl: string;
  packageUrl: string;
  namespacePrefix: string;
};

export class KitBuilder {
  graph?: GraphDescriptor;
  baseUrl?: string;
  packageUrl?: string;
  namespacePrefix?: string;
  handlers?: NodeHandlers<NodeHandlerContext>;

  async initialize({
    graph,
    baseUrl,
    packageUrl,
    namespacePrefix = "",
  }: KitBuilderOptions) {
    this.graph = graph;
    this.baseUrl = baseUrl;
    this.packageUrl = packageUrl;
    this.namespacePrefix = namespacePrefix;

    const board = await Board.fromGraphDescriptor(this.graph);
    board.url = this.baseUrl;
    this.handlers = await Board.handlersFromBoard(board);
  }

  #addPrefix(handlers: NodeHandlers<NodeHandlerContext>) {
    return Object.keys(handlers).reduce((acc, key) => {
      acc[`${this.namespacePrefix}${key}`] = handlers[key];
      return acc;
    }, {} as NodeHandlers<NodeHandlerContext>);
  }

  handlerForNode(id: NodeIdentifier) {
    if (!this.graph) throw new Error(`Builder was not yet initialized.`);
    const { nodes } = this.graph;
    const node = nodes.find((node) => node.id === id);
    if (!node) throw new Error(`Node ${id} not found in graph.`);

    return async (inputs: InputValues, context: NodeHandlerContext) => {
      const configuration = node.configuration;
      if (configuration) {
        inputs = { ...configuration, ...inputs };
      }
      return this.handlers?.[node.type](inputs, context);
    };
  }

  build<Handlers extends NodeHandlers<NodeHandlerContext>>(handlers: Handlers) {
    type NodeNames = [x: Extract<keyof Handlers, string>];

    if (!this.packageUrl) throw new Error(`Builder was not yet initialized.`);
    const url = this.packageUrl;
    const prefix = this.namespacePrefix;

    const prefixedHandlers = this.#addPrefix(handlers);

    const nodes = Object.keys(handlers);

    return class implements Kit {
      url = url;

      get handlers() {
        return prefixedHandlers;
      }

      constructor(nodeFactory: NodeFactory) {
        return new Proxy(this, {
          get(target, prop: string) {
            if (prop === "handlers" || prop === "url") {
              return target[prop];
            } else if (nodes.includes(prop as NodeNames[number])) {
              return (config: OptionalIdConfiguration = {}) => {
                const { $id, ...rest } = config;
                return nodeFactory.create(
                  this as unknown as Kit,
                  `${prefix}${prop}`,
                  { ...rest },
                  $id
                );
              };
            }
          },
        });
      }
    } as KitConstructor<GenericKit<NodeNames>>;
  }
}
