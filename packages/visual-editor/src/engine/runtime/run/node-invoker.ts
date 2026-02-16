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

import type { NodeInvoker } from "../../types.js";
import { resolveBoardCapabilitiesInInputs } from "../../loader/capability.js";
import { resolveGraph, SENTINEL_BASE_URL } from "../../loader/loader.js";
import { callHandler, getHandler } from "../handler.js";

export { NodeInvokerImpl };

class NodeInvokerImpl implements NodeInvoker {
  async invokeNode(
    args: RunArguments,
    graph: GraphToRun,
    descriptor: NodeDescriptor,
    inputs: InputValues,
    invocationPath: number[]
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs: _inputs, start, stopAfter, ...context } = args;

    const { base = SENTINEL_BASE_URL } = context;
    let outputs: OutputValues | undefined = undefined;

    const outerGraph = graph.graph;

    const handler = await getHandler(descriptor.type, {
      ...context,
      outerGraph,
    });

    const newContext: NodeHandlerContext = {
      ...context,
      descriptor,
      board: resolveGraph(graph),
      // This is important: outerGraph is the value of the parent graph
      // if graph is a subgraph.
      // Or it equals to "board" if this is not a subgraph
      // TODO: Make this more elegant.
      outerGraph,
      base,
      invocationPath,
    };

    outputs = (await callHandler(
      handler,
      resolveBoardCapabilitiesInInputs(inputs, context, graph.graph.url),
      newContext
    )) as OutputValues;

    return outputs;
  }
}
