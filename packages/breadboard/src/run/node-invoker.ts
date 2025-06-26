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
  JsonSerializable,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import { ParameterManager } from "./parameter-manager.js";
import { FileSystemEntry } from "../data/types.js";

type ResultSupplier = (result: RunResult) => Promise<void>;

export class NodeInvoker {
  #requestedInputs: RequestedInputsManager;
  #resultSupplier: ResultSupplier;
  #graph: GraphToRun;
  #context: NodeHandlerContext;
  #initialInputs?: InputValues;
  #params: ParameterManager;

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
    this.#initialInputs = inputs;
    this.#params = new ParameterManager(graph.graph, inputs);
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

  #updateEnvDescriptor(
    result: TraversalResult,
    context: NodeHandlerContext
  ): FileSystemEntry[] {
    const currentEnv = context.fileSystem?.env() || [];

    return [
      ...currentEnv,
      {
        path: `/env/descriptor`,
        data: [{ parts: [{ json: result.descriptor as JsonSerializable }] }],
      },
    ];
  }

  #updateStepInfo(result: TraversalResult, context: NodeHandlerContext) {
    const fileSystem = context.fileSystem?.createModuleFileSystem({
      graphUrl: this.#graph.graph.url!,
      env: this.#updateEnvDescriptor(result, context),
    });
    return {
      ...context,
      fileSystem,
    };
  }

  async invokeNode(result: TraversalResult, invocationPath: number[]) {
    const { descriptor } = result;
    const inputs = this.#adjustInputs(result);

    const requestInput = this.#requestedInputs.createHandler(
      this.#resultSupplier,
      result
    );

    const { kits = [], base = SENTINEL_BASE_URL, state } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const outerGraph = this.#graph.graph;

    const handler = await getHandler(descriptor.type, {
      ...this.#context,
      outerGraph,
    });

    // Request parameters, if needed.
    let newContext = await this.#params.requestParameters(
      {
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
        requestInput,
        provideOutput: createOutputProvider(
          this.#resultSupplier,
          result,
          this.#context
        ),
        invocationPath,
        state,
      },
      invocationPath,
      result
    );

    // only for top-level steps, update env with the current step
    if (invocationPath.length === 1) {
      newContext = this.#updateStepInfo(result, newContext);
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
