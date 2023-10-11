/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  KitReference,
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
import { callHandler } from "./handler.js";

const urlToNpmSpec = (url: string): string => {
  const urlObj = new URL(url);
  if (urlObj.protocol !== "npm:") {
    throw new Error(`URL protocol must be "npm:"`);
  }
  return urlObj.pathname;
};

export class KitLoader {
  #kits: KitReference[];
  #imports: KitImportMap;

  constructor(kits?: KitReference[], imports?: KitImportMap) {
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

export class GraphToKitAdapter {
  graph: GraphDescriptor;
  handlers?: NodeHandlers<NodeHandlerContext>;

  private constructor(graph: GraphDescriptor) {
    this.graph = graph;
  }

  populateDescriptor(descriptor: KitBuilderOptions) {
    const { title, description, version } = this.graph;
    return { title, description, version, ...descriptor };
  }

  async #initialize(url: string) {
    const board = await Board.fromGraphDescriptor(this.graph);
    board.url = url;
    this.handlers = await Board.handlersFromBoard(board);
  }

  handlerForNode(id: NodeIdentifier) {
    if (!this.graph) throw new Error(`Builder was not yet initialized.`);
    const { nodes } = this.graph;
    const node = nodes.find((node) => node.id === id);
    if (!node) throw new Error(`Node ${id} not found in graph.`);

    return {
      invoke: async (inputs: InputValues, context?: NodeHandlerContext) => {
        const configuration = node.configuration;
        if (configuration) {
          inputs = { ...configuration, ...inputs };
        }
        const handler = this.handlers?.[node.type];
        if (!handler) return;

        return callHandler(handler, inputs, context);
      },
    };
  }

  static async create(graph: GraphDescriptor, url: string) {
    const adapter = new GraphToKitAdapter(graph);
    await adapter.#initialize(url);
    return adapter;
  }
}

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

  #addPrefix(handlers: NodeHandlers<NodeHandlerContext>) {
    return Object.keys(handlers).reduce((acc, key) => {
      acc[`${this.namespacePrefix}${key}`] = handlers[key];
      return acc;
    }, {} as NodeHandlers<NodeHandlerContext>);
  }

  build<Handlers extends NodeHandlers<NodeHandlerContext>>(handlers: Handlers) {
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
    } as KitConstructor<GenericKit<Handlers>>;
  }
}
