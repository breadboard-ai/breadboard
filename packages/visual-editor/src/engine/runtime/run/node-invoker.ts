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

import { resolveGraph, SENTINEL_BASE_URL } from "../../loader/loader.js";
import { callHandler, getHandler } from "../handler.js";

export { NodeInvokerImpl };

class NodeInvokerImpl implements NodeInvoker {
  async invokeNode(
    args: RunArguments,
    graph: GraphToRun,
    descriptor: NodeDescriptor,
    inputs: InputValues
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs: _inputs, start, stopAfter, ...context } = args;

    const { base = SENTINEL_BASE_URL } = context;
    let outputs: OutputValues | undefined = undefined;

    const handler = await getHandler(descriptor.type, {
      ...context,
    });

    const newContext: NodeHandlerContext = {
      ...context,
      descriptor,
      board: resolveGraph(graph),
      base,
    };

    outputs = (await callHandler(handler, inputs, newContext)) as OutputValues;

    return outputs;
  }
}
