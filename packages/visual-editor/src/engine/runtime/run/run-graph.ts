/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardRunResult,
  GraphToRun,
  OutputValues,
  RunArguments,
  TraversalResult,
} from "@breadboard-ai/types";
import {
  asyncGen,
  isImperativeGraph,
  timestamp,
  toDeclarativeGraph,
} from "@breadboard-ai/utils";
import { bubbleUpInputsIfNeeded, bubbleUpOutputsIfNeeded } from "../bubble.js";
import { InputStageResult, OutputStageResult } from "../run.js";
import { TraversalMachine } from "../traversal/machine.js";
import { NodeInvoker } from "./node-invoker.js";
import { resolveGraphUrls } from "../../loader/resolve-graph-urls.js";
import { resolveGraph } from "../../loader/loader.js";
import { resolveBoardCapabilities } from "../../loader/capability.js";

/**
 * Runs a graph in "run" mode. See
 * https://breadboard-ai.github.io/breadboard/docs/reference/runtime-semantics/#run-mode
 * for more details.
 */
export async function* runGraph(
  graphToRun: GraphToRun,
  args: RunArguments = {},
  resumeFrom?: TraversalResult
): AsyncGenerator<BreadboardRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputs: initialInputs, start, stopAfter, ...context } = args;
  const { probe, invocationPath = [] } = context;

  graphToRun = resolveGraphUrls(graphToRun);

  let graph = resolveGraph(graphToRun);

  if (isImperativeGraph(graph)) {
    graph = toDeclarativeGraph(graph);
    graphToRun = { graph };
  }

  yield* asyncGen<BreadboardRunResult>(async (next) => {
    const nodeInvoker = new NodeInvoker(args, graphToRun, next);

    let invocationId = 0;

    let prepareToStopAtStartNode = false;

    const path = () => [...invocationPath, invocationId];

    const machine = new TraversalMachine(graph, resumeFrom, start);
    if (!resumeFrom) {
      await probe?.report?.({
        type: "graphstart",
        data: {
          graph: graphToRun.graph,
          graphId: graphToRun.subGraphId || "",
          path: invocationPath,
          timestamp: timestamp(),
        },
      });
    }

    let remainingOutputs: { result: TraversalResult; path: number[] } | null =
      null;

    for await (const result of machine) {
      context?.signal?.throwIfAborted();

      invocationId++;
      const { inputs, descriptor, missingInputs } = result;

      await probe?.report?.({
        type: "edge",
        data: {
          edge: result.current,
          to: path(),
          timestamp: timestamp(),
          value: inputs,
        },
      });

      if (result.skip) {
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

      await probe?.report?.({
        type: "nodestart",
        data: {
          node: descriptor,
          inputs,
          path: path(),
          timestamp: timestamp(),
        },
      });

      if (prepareToStopAtStartNode) {
        return;
      }

      let outputs: OutputValues | undefined = undefined;

      if (descriptor.type === "input") {
        await next(new InputStageResult(result, invocationId, path()));
        await bubbleUpInputsIfNeeded(
          graph,
          context,
          descriptor,
          result,
          path()
        );
        outputs = result.outputs
          ? await resolveBoardCapabilities(result.outputs, context, graph.url)
          : undefined;
      } else if (descriptor.type === "output") {
        if (
          !(await bubbleUpOutputsIfNeeded(inputs, descriptor, context, path()))
        ) {
          await next(new OutputStageResult(result, invocationId, path()));
        }
        outputs = result.outputs;
        remainingOutputs = null;
      } else {
        outputs = await nodeInvoker.invokeNode(result, path());
        remainingOutputs = { result, path: path() };
      }

      await probe?.report?.({
        type: "nodeend",
        data: {
          node: descriptor,
          inputs,
          outputs: outputs as OutputValues,
          path: path(),
          timestamp: timestamp(),
          newOpportunities: result.newOpportunities,
        },
      });

      result.outputs = outputs;

      if (stopAfter == descriptor.id) {
        prepareToStopAtStartNode = true;
      }
    }

    if (remainingOutputs) {
      const oldInvocationId = remainingOutputs.path.at(-1) || -1;
      await next(
        new OutputStageResult(
          {
            ...remainingOutputs.result,
            inputs: remainingOutputs.result.outputs || {},
          },
          oldInvocationId,
          remainingOutputs.path
        )
      );
    }

    await probe?.report?.({
      type: "graphend",
      data: { path: invocationPath, timestamp: timestamp() },
    });
  });
}
