/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { callHandler, handlersFromKits } from "../handler.js";
import { KitBuilderOptions } from "./builder.js";
import { BoardRunner } from "../runner.js";
import {
  GraphDescriptor,
  InputValues,
  Kit,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlers,
  NodeIdentifier,
} from "../types.js";
import { inspect } from "../index.js";

export class GraphToKitAdapter {
  graph: GraphDescriptor;
  handlers?: NodeHandlers;
  runner?: BoardRunner;

  private constructor(graph: GraphDescriptor) {
    this.graph = graph;
  }

  populateDescriptor(descriptor: KitBuilderOptions) {
    const { title, description, version } = this.graph;
    return { title, description, version, ...descriptor };
  }

  async #initialize(url: string, kits: Kit[] = []) {
    const runner = await BoardRunner.fromGraphDescriptor(this.graph);
    runner.url = url;
    // NOTE: This means that this board will _not_ use handlers defined upstream
    // in the stack of boards to execute to nodes on this graph, but only the
    // kits defined on this graph.
    //
    // Note however that `invoke` nodes will execute subgraphs with handlers
    // from higher in the stack, so for example a subgraph defined here that
    // uses `fetch` will use the `fetch` handler from the parent graph before
    // using the `fetch` handler from kit defined here.
    //
    // The comment above applies only to nodes acting as node handler. We
    // haven't seen this use-case yet for anything that isn't a Core node, so
    // let's revisit once we have that.
    this.handlers = kits?.reduce((acc, kit) => {
      return { ...acc, ...kit.handlers };
    }, {} as NodeHandlers);
    this.runner = runner;
  }

  handlerForNode(id: NodeIdentifier) {
    if (!this.graph) throw new Error(`Builder was not yet initialized.`);
    const { nodes } = this.graph;
    const node = nodes.find((node) => node.id === id);
    if (!node) throw new Error(`Node ${id} not found in graph.`);

    return {
      describe: async (): Promise<NodeDescriberResult> => {
        const emptyResult: NodeDescriberResult = {
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        };

        if (this.graph.graphs != undefined && id in this.graph.graphs) {
          const subGraph = this.graph.graphs[id] as GraphDescriptor;
          if (subGraph == undefined) return emptyResult;
          return await inspect(subGraph).describe();
        } else if (node.type === "invoke") {
          const { $board } = node.configuration as { $board?: GraphDescriptor };
          if ($board) {
            return await inspect($board).describe();
          }
        }

        return emptyResult;
      },
      invoke: async (inputs: InputValues, context: NodeHandlerContext) => {
        const configuration = node.configuration;
        if (configuration) {
          inputs = { ...configuration, ...inputs };
        }
        const handlers = {
          ...this.handlers,
          ...handlersFromKits(context?.kits || []),
        };
        const handler = handlers?.[node.type];
        if (!handler)
          throw new Error(`No handler found for node "${node.type}".`);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const board = this.runner!;

        const base = board.url ? new URL(board.url) : new URL(import.meta.url);

        return callHandler(handler, inputs, {
          ...context,
          outerGraph: board,
          base,
          // Add this board's kits, so they are available to subgraphs
          kits: [...(context.kits || []), ...board.kits],
        });
      },
    };
  }

  static async create(graph: GraphDescriptor, url: string, kits: Kit[]) {
    const adapter = new GraphToKitAdapter(graph);
    await adapter.#initialize(url, kits);
    return adapter;
  }
}
