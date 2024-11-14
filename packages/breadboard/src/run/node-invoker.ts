/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createOutputProvider, RequestedInputsManager } from "../bubble.js";
import { resolveBoardCapabilitiesInInputs } from "../capability.js";
import { callHandler, getHandler } from "../handler.js";
import { SENTINEL_BASE_URL } from "../loader/loader.js";
import { RunResult } from "../run.js";
import type { NodeHandlerContext, RunArguments } from "../types.js";
import type {
  GraphDescriptor,
  InputValues,
  NodeIdentifier,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";

type ResultSupplier = (result: RunResult) => Promise<void>;

export class NodeInvoker {
  #requestedInputs: RequestedInputsManager;
  #resultSupplier: ResultSupplier;
  #graph: GraphDescriptor;
  #context: NodeHandlerContext;
  #initialInputs?: InputValues;
  #start?: NodeIdentifier;

  constructor(
    args: RunArguments,
    graph: GraphDescriptor,
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
    const { inputs, descriptor } = result;
    if (!this.#start) return inputs;
    if (this.#start !== descriptor.id) return inputs;
    return { ...inputs, ...this.#initialInputs };
  }

  async invokeNode(result: TraversalResult, invocationPath: number[]) {
    const { descriptor } = result;
    const inputs = this.#adjustInputs(result);
    const { kits = [], base = SENTINEL_BASE_URL, state } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const handler = await getHandler(descriptor.type, this.#context);

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
