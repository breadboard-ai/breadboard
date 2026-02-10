/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphToRun,
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";

import { resolveBoardCapabilitiesInInputs } from "../../loader/capability.js";
import { resolveGraph, SENTINEL_BASE_URL } from "../../loader/loader.js";
import { callHandler, getHandler } from "../handler.js";

export class NodeInvoker {
  #graph: GraphToRun;
  #context: NodeHandlerContext;

  constructor(args: RunArguments, graph: GraphToRun) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs, start, stopAfter, ...context } = args;
    this.#graph = graph;
    this.#context = context;
  }

  #updateStepInfo(context: NodeHandlerContext) {
    const fileSystem = context.fileSystem?.createModuleFileSystem({
      graphUrl: this.#graph.graph.url!,
    });
    return {
      ...context,
      fileSystem,
    };
  }

  async invokeNode(
    descriptor: NodeDescriptor,
    inputs: InputValues,
    invocationPath: number[]
  ) {
    const { kits = [], base = SENTINEL_BASE_URL } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const outerGraph = this.#graph.graph;

    const handler = await getHandler(descriptor.type, {
      ...this.#context,
      outerGraph,
    });

    let newContext: NodeHandlerContext = {
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
      invocationPath,
    };

    // only for top-level steps, update env with the current step
    if (invocationPath.length === 1) {
      newContext = this.#updateStepInfo(newContext);
    }

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
