/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import { bubbleUpInputsIfNeeded, bubbleUpOutputsIfNeeded } from "../bubble.js";
import { resolveBoardCapabilities } from "../capability.js";
import { InputStageResult, OutputStageResult } from "../run.js";
import { timestamp } from "../timestamp.js";
import { TraversalMachine } from "../traversal/machine.js";
import type {
  BreadboardRunResult,
  RunArguments,
  TraversalResult,
} from "../types.js";
import { asyncGen } from "../utils/async-gen.js";
import { NodeInvoker } from "./node-invoker.js";

/**
 * Runs a graph in "run" mode. See
 * https://breadboard-ai.github.io/breadboard/docs/reference/runtime-semantics/#run-mode
 * for more details.
 */
export async function* runGraph(
  graph: GraphDescriptor,
  args: RunArguments = {},
  resumeFrom?: TraversalResult
): AsyncGenerator<BreadboardRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputs, ...context } = args;
  const { probe, state, invocationPath = [] } = context;

  const lifecycle = state?.lifecycle();
  yield* asyncGen<BreadboardRunResult>(async (next) => {
    const nodeInvoker = new NodeInvoker(args, graph, next);

    lifecycle?.dispatchGraphStart(graph.url!, invocationPath);

    const reanimation = state?.reanimation();
    if (reanimation) {
      const frame = reanimation.enter(invocationPath);
      const mode = frame.mode();
      switch (mode) {
        case "replay": {
          // This can only happen when `runGraph` is called by `invokeGraph`,
          // which means that all we need to do is provide the output and
          // return.
          const { result, invocationId, path } = frame.replay();
          await next(new OutputStageResult(result, invocationId, path));
          // The nodeend and graphend will be dispatched by `invokeGraph`.
          return;
        }
        case "resume": {
          const { result, invocationPath } = frame.resume();
          resumeFrom = result;
          await lifecycle?.dispatchNodeStart(result, invocationPath);

          let outputs: OutputValues | undefined = undefined;

          const type = result.descriptor.type;
          if (!(type === "input" || type === "output")) {
            outputs = await nodeInvoker.invokeNode(result, invocationPath);
            result.outputsPromise = Promise.resolve(outputs);
            result.pendingOutputs = new Map();
            resumeFrom = result;
          }

          lifecycle?.dispatchNodeEnd(outputs, invocationPath);
        }
      }
    }

    let invocationId = 0;
    const path = () => [...invocationPath, invocationId];

    const machine = new TraversalMachine(graph, resumeFrom);
    await probe?.report?.({
      type: "graphstart",
      data: { graph, path: invocationPath, timestamp: timestamp() },
    });

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

      await lifecycle?.dispatchNodeStart(result, path());

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
          lifecycle?.state()
        );
        outputsPromise = result.outputsPromise
          ? Promise.resolve(
              resolveBoardCapabilities(
                Promise.resolve(await result.outputsPromise),
                context,
                graph.url
              )
            )
          : undefined;
      } else if (descriptor.type === "output") {
        if (
          !(await bubbleUpOutputsIfNeeded(inputs, descriptor, context, path()))
        ) {
          await next(new OutputStageResult(result, invocationId, path()));
        }
        outputsPromise = result.outputsPromise
          ? Promise.resolve(result.outputsPromise)
          : undefined;
      } else {
        outputsPromise = Promise.resolve(
          await nodeInvoker.invokeNode(result, path())
        );
      }

      lifecycle?.dispatchNodeEnd(await outputsPromise, path());

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
