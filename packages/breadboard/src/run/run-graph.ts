/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import {
  bubbleUpInputsIfNeeded,
  bubbleUpOutputsIfNeeded,
  createOutputProvider,
  RequestedInputsManager,
} from "../bubble.js";
import {
  resolveBoardCapabilities,
  resolveBoardCapabilitiesInInputs,
} from "../capability.js";
import { callHandler, handlersFromKits } from "../handler.js";
import { SENTINEL_BASE_URL } from "../loader/loader.js";
import { InputStageResult, OutputStageResult } from "../run.js";
import { timestamp } from "../timestamp.js";
import { TraversalMachine } from "../traversal/machine.js";
import type {
  BreadboardRunResult,
  NodeHandlerContext,
  RunArguments,
} from "../types.js";
import { asyncGen } from "../utils/async-gen.js";

/**
 * Runs a graph in "run" mode. See
 * https://breadboard-ai.github.io/breadboard/docs/reference/runtime-semantics/#run-mode
 * for more details.
 */
export async function* runGraph(
  graph: GraphDescriptor,
  args: RunArguments = {},
  result?: BreadboardRunResult
): AsyncGenerator<BreadboardRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputs, ...context } = args;
  const kits = context.kits ?? [];
  const base = context.base || SENTINEL_BASE_URL;
  const { probe, state } = context;
  const lifecycle = state?.lifecycle();
  yield* asyncGen<BreadboardRunResult>(async (next) => {
    const handlers = handlersFromKits(kits);

    const machine = new TraversalMachine(graph, result?.state);

    const requestedInputs = new RequestedInputsManager(args);

    const invocationPath = context.invocationPath || [];

    lifecycle?.dispatchGraphStart(graph.url!);

    await probe?.report?.({
      type: "graphstart",
      data: { graph, path: invocationPath, timestamp: timestamp() },
    });

    let invocationId = 0;
    const path = () => [...invocationPath, invocationId];

    for await (const result of machine) {
      context?.signal?.throwIfAborted();

      invocationId++;
      const { inputs, descriptor, missingInputs } = result;

      if (result.skip) {
        lifecycle?.dispatchSkip();
        await probe?.report?.({
          type: "skip",
          data: {
            node: descriptor,
            inputs,
            missingInputs,
            path: path(),
            timestamp: timestamp(),
          },
        });
        continue;
      }

      lifecycle?.dispatchNodeStart(result);

      await probe?.report?.({
        type: "nodestart",
        data: {
          node: descriptor,
          inputs,
          path: path(),
          timestamp: timestamp(),
        },
        state: await lifecycle?.state(),
      });

      let outputsPromise: Promise<OutputValues> | undefined = undefined;

      if (descriptor.type === "input") {
        await next(
          new InputStageResult(
            result,
            await lifecycle?.state(),
            invocationId,
            path()
          )
        );
        await bubbleUpInputsIfNeeded(
          graph,
          context,
          descriptor,
          result,
          path(),
          await lifecycle?.state()
        );
        outputsPromise = result.outputsPromise
          ? resolveBoardCapabilities(result.outputsPromise, context, graph.url)
          : undefined;
      } else if (descriptor.type === "output") {
        if (
          !(await bubbleUpOutputsIfNeeded(inputs, descriptor, context, path()))
        ) {
          await next(new OutputStageResult(result, invocationId, path()));
        }
        outputsPromise = result.outputsPromise;
      } else {
        const handler = handlers[descriptor.type];
        if (!handler)
          throw new Error(`No handler for node type "${descriptor.type}"`);

        const newContext: NodeHandlerContext = {
          ...context,
          descriptor,
          board: graph,
          // TODO: Remove this, since it is now the same as `board`.
          outerGraph: graph,
          base,
          kits,
          requestInput: requestedInputs.createHandler(next, result),
          provideOutput: createOutputProvider(next, result, context),
          invocationPath: path(),
          state,
        };

        outputsPromise = callHandler(
          handler,
          resolveBoardCapabilitiesInInputs(inputs, context, graph.url),
          newContext
        ) as Promise<OutputValues>;
      }

      lifecycle?.dispatchNodeEnd();

      await probe?.report?.({
        type: "nodeend",
        data: {
          node: descriptor,
          inputs,
          outputs: (await outputsPromise) as OutputValues,
          path: path(),
          timestamp: timestamp(),
        },
      });

      result.outputsPromise = outputsPromise;
    }

    lifecycle?.dispatchGraphEnd();

    await probe?.report?.({
      type: "graphend",
      data: { path: invocationPath, timestamp: timestamp() },
    });
  });
}
