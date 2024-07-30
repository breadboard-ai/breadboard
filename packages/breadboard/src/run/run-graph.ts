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
  const { probe, state } = context;

  const lifecycle = state?.lifecycle();
  yield* asyncGen<BreadboardRunResult>(async (next) => {
    const nodeInvoker = new NodeInvoker(args, graph, next);

    const reanimation = state?.reanimation();
    if (reanimation) {
      const frame = reanimation.enter();
      const mode = frame.mode();
      console.log("🌻 reanimation", mode);
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
          console.log("🌻 resuming", result, invocationPath);
          const type = result.descriptor.type;
          if (type !== "input" && type !== "output") {
            const outputs = await nodeInvoker.invokeNode(
              result,
              invocationPath
            );
            result.outputsPromise = Promise.resolve(outputs);
            result.pendingOutputs = new Map();
            resumeFrom = result;
          }
        }
      }
    }

    console.log("🧠 runGraph", graph, resumeFrom);

    const machine = new TraversalMachine(graph, resumeFrom);

    const invocationPath = context.invocationPath || [];
    let invocationId = 0;
    const path = () => [...invocationPath, invocationId];

    lifecycle?.dispatchGraphStart(graph.url!);

    await probe?.report?.({
      type: "graphstart",
      data: { graph, path: invocationPath, timestamp: timestamp() },
    });

    console.log("🌻 runGraph machine", machine);

    for await (const result of machine) {
      console.log(
        "🌻 machine iteration",
        result,
        result.skip,
        "depth",
        path().length
      );
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

      lifecycle?.dispatchNodeStart(result, path());

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
        outputsPromise = nodeInvoker.invokeNode(result, path());
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
