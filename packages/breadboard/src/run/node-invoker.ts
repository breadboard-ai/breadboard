/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createOutputProvider, RequestedInputsManager } from "../bubble.js";
import { resolveBoardCapabilitiesInInputs } from "../capability.js";
import { callHandler, handlersFromKits } from "../handler.js";
import { SENTINEL_BASE_URL } from "../loader/loader.js";
import { RunResult } from "../run.js";
import type {
  GraphDescriptor,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlers,
  NodeTypeIdentifier,
  OutputValues,
  RunArguments,
  TraversalResult,
} from "../types.js";
import { invokeGraph } from "./invoke-graph.js";

type ResultSupplier = (result: RunResult) => Promise<void>;

const asURL = (value: string, base: URL): URL | undefined => {
  try {
    return new URL(value, base);
  } catch (err) {
    return undefined;
  }
};

export class NodeInvoker {
  #requestedInputs: RequestedInputsManager;
  #resultSupplier: ResultSupplier;
  #graph: GraphDescriptor;
  #context: NodeHandlerContext;
  #handlers: NodeHandlers;

  constructor(
    args: RunArguments,
    graph: GraphDescriptor,
    next: (result: RunResult) => Promise<void>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs, ...context } = args;
    this.#requestedInputs = new RequestedInputsManager(args);
    this.#resultSupplier = next;
    this.#graph = graph;
    this.#context = context;
    this.#handlers = handlersFromKits(context.kits ?? []);
  }

  async #getHandler(type: NodeTypeIdentifier, base: URL): Promise<NodeHandler> {
    const nodeTypeUrl = asURL(type, base);
    if (nodeTypeUrl) {
      // This is a URL, pointing to a board that represents the node type.
      // We need to load the board and return the handler.
      const { loader } = this.#context;
      if (!loader) {
        throw new Error(`Cannot load node type "${type}" without a loader.`);
      }
      const graph = await loader.load(type, this.#context);
      if (!graph) {
        throw new Error(`Cannot load node type for type "${type}"`);
      }
      return async (inputs, context) => {
        const base = context.board?.url && new URL(context.board?.url);
        const invocationContext = base
          ? {
              ...context,
              base,
            }
          : { ...context };

        return await invokeGraph(graph, inputs, invocationContext);
      };
    } else {
      // This is an ordinary node type, we can look up the handler directly.
      const handler = this.#handlers[type];
      if (!handler) {
        throw new Error(`No handler for node type "${type}"`);
      }
      return handler;
    }
  }

  async invokeNode(result: TraversalResult, invocationPath: number[]) {
    const { inputs, descriptor } = result;
    const { kits = [], base = SENTINEL_BASE_URL, state } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const handler = await this.#getHandler(descriptor.type, base);

    const newContext: NodeHandlerContext = {
      ...this.#context,
      descriptor,
      board: this.#graph,
      // TODO: Remove this, since it is now the same as `board`.
      outerGraph: this.#graph,
      base,
      kits,
      requestInput: this.#requestedInputs.createHandler(
        this.#resultSupplier,
        result
      ),
      provideOutput: createOutputProvider(
        this.#resultSupplier,
        result,
        this.#context
      ),
      invocationPath,
      state,
    };

    outputs = (await callHandler(
      handler,
      resolveBoardCapabilitiesInInputs(inputs, this.#context, this.#graph.url),
      newContext
    )) as OutputValues;

    return outputs;
  }
}
