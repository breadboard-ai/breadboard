/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createOutputProvider, RequestedInputsManager } from "../bubble.js";
import { resolveBoardCapabilitiesInInputs } from "../capability.js";
import { callHandler, getHandler } from "../handler.js";
import { resolveGraph, SENTINEL_BASE_URL } from "../loader/loader.js";
import { RunResult } from "../run.js";
import type { GraphToRun, NodeHandlerContext, RunArguments } from "../types.js";
import type {
  InputValues,
  NodeIdentifier,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";

type ResultSupplier = (result: RunResult) => Promise<void>;

export class NodeInvoker {
  #requestedInputs: RequestedInputsManager;
  #resultSupplier: ResultSupplier;
  #graph: GraphToRun;
  #context: NodeHandlerContext;
  #initialInputs?: InputValues;
  #start?: NodeIdentifier;

  constructor(
    args: RunArguments,
    graph: GraphToRun,
    next: (result: RunResult) => Promise<void>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs, start, stopAfter, ...context } = args;
    this.#requestedInputs = new RequestedInputsManager(args);
    this.#resultSupplier = next;
    this.#graph = graph;
    this.#context = context;
    this.#start = start;
    this.#initialInputs = inputs;
  }

  #adjustInputs(result: TraversalResult) {
    const { inputs, current, descriptor } = result;
    if (descriptor.type === "secrets") {
      // Somewhat gross hack: don't supply extra inputs to secret, since
      // it has no inputs.
      // Also, this messes with the proxy server quite a bit, and we are
      // better off not doing this.
      return inputs;
    }
    if (current.from === "$entry") {
      return { ...inputs, ...this.#initialInputs };
    }
    return inputs;
  }

  async invokeNode(result: TraversalResult, invocationPath: number[]) {
    const { descriptor } = result;
    const inputs = this.#adjustInputs(result);
    const { kits = [], base = SENTINEL_BASE_URL, state } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const outerGraph = this.#graph.graph;

    const handler = await getHandler(descriptor.type, {
      ...this.#context,
      outerGraph,
    });

    const newContext: NodeHandlerContext = {
      ...this.#context,
      descriptor,
      board: resolveGraph(this.#graph),
      // This is important: outerGraph is the value of the parent graph
      // if this.#graph is a subgraph.
      // Or it equals to "board" it this is not a subgraph
      // TODO: Make this more elegant.
      outerGraph,
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
      resolveBoardCapabilitiesInInputs(
        inputs,
        this.#context,
        this.#graph.graph.url
      ),
      newContext
    )) as OutputValues;

    return outputs;
  }
}
