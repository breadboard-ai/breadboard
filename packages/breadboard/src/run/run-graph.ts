/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OutputValues, TraversalResult } from "@breadboard-ai/types";
import { bubbleUpInputsIfNeeded, bubbleUpOutputsIfNeeded } from "../bubble.js";
import { resolveBoardCapabilities } from "../capability.js";
import { InputStageResult, OutputStageResult } from "../run.js";
import { cloneState } from "../serialization.js";
import { timestamp } from "../timestamp.js";
import { TraversalMachine } from "../traversal/machine.js";
import type {
  BreadboardRunResult,
  GraphToRun,
  RunArguments,
} from "../types.js";
import { asyncGen } from "../utils/async-gen.js";
import { NodeInvoker } from "./node-invoker.js";
import {
  isImperativeGraph,
  toDeclarativeGraph,
} from "./run-imperative-graph.js";
import { resolveGraph } from "../loader/loader.js";

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
  const { probe, state, invocationPath = [] } = context;

  let graph = resolveGraph(graphToRun);

  if (isImperativeGraph(graph)) {
    graph = toDeclarativeGraph(graph);
    graphToRun = { graph };
  }

  const lifecycle = state?.lifecycle();
  yield* asyncGen<BreadboardRunResult>(async (next) => {
    const nodeInvoker = new NodeInvoker(args, graphToRun, next);

    lifecycle?.dispatchGraphStart(graph.url!, invocationPath);

    let invocationId = 0;

    let prepareToStopAtStartNode = false;

    const reanimation = state?.reanimation();
    if (reanimation) {
      const frame = reanimation.enter(invocationPath);
      const mode = frame.mode();
      switch (mode) {
        case "replay": {
          // This can only happen when `runGraph` is called by `invokeGraph`,
          // which means that all we need to do is provide the output and
          // return.
          const { result, invocationId: id, path } = frame.replay();
          await next(new OutputStageResult(result, id, path));
          // The nodeend and graphend will be dispatched by `invokeGraph`.
          return;
        }
        case "resume": {
          const { result, invocationPath } = frame.resume();

          resumeFrom = result;
          // Adjust invocationId to match the point from which we are resuming.
          invocationId = invocationPath[invocationPath.length - 1];

          await lifecycle?.dispatchNodeStart(result, invocationPath);

          let outputs: OutputValues | undefined = undefined;

          const type = result.descriptor.type;
          const descriptor = result.descriptor;
          const outputHasValues = Object.keys(result.outputs || {}).length > 0;
          if (type === "input") {
            if (outputHasValues) {
              outputs = result.outputs;
            } else {
              await next(
                new InputStageResult(
                  result,
                  lifecycle?.state(),
                  invocationId,
                  invocationPath
                )
              );
              await bubbleUpInputsIfNeeded(
                graph,
                context,
                descriptor,
                result,
                invocationPath,
                lifecycle?.state()
              );
              outputs = result.outputs
                ? await resolveBoardCapabilities(
                    result.outputs,
                    context,
                    graph.url
                  )
                : undefined;
            }
          } else if (descriptor.type === "output") {
            if (outputHasValues) {
              outputs = result.outputs;
            } else {
              if (
                !(await bubbleUpOutputsIfNeeded(
                  result.inputs,
                  descriptor,
                  context,
                  invocationPath
                ))
              ) {
                await next(
                  new OutputStageResult(result, invocationId, invocationPath)
                );
              }
              outputs = result.outputs;
            }
          } else {
            outputs = await nodeInvoker.invokeNode(result, invocationPath);
            result.outputs = outputs;
            resumeFrom = result;
          }

          lifecycle?.dispatchNodeEnd(outputs, invocationPath);

          await probe?.report?.({
            type: "nodeend",
            data: {
              node: result.descriptor,
              inputs: result.inputs,
              outputs: outputs as OutputValues,
              path: invocationPath,
              timestamp: timestamp(),
              newOpportunities: structuredClone(result.newOpportunities),
            },
          });

          if (stopAfter === result.descriptor.id) {
            prepareToStopAtStartNode = true;
          }
        }
      }
    }

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

    let remainingOutputs: TraversalResult | null = null;

    for await (const result of machine) {
      context?.signal?.throwIfAborted();

      invocationId++;
      const { inputs, descriptor, missingInputs } = result;

      lifecycle?.dispatchEdge(result.current);
      await probe?.report?.({
        type: "edge",
        data: {
          edge: result.current,
          to: path(),
          from: lifecycle?.pathFor(result.current.from),
          timestamp: timestamp(),
          value: inputs,
        },
      });

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
        result: cloneState(result),
      });

      if (prepareToStopAtStartNode) {
        return;
      }

      let outputs: OutputValues | undefined = undefined;

      if (descriptor.type === "input") {
        await next(
          new InputStageResult(result, lifecycle?.state(), invocationId, path())
        );
        await bubbleUpInputsIfNeeded(
          graph,
          context,
          descriptor,
          result,
          path(),
          lifecycle?.state()
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
        remainingOutputs = result;
      }

      lifecycle?.dispatchNodeEnd(outputs, path());

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
      await next(
        new OutputStageResult(
          {
            ...remainingOutputs,
            inputs: remainingOutputs.outputs || {},
          },
          invocationId,
          path()
        )
      );
    }

    lifecycle?.dispatchGraphEnd();

    await probe?.report?.({
      type: "graphend",
      data: { path: invocationPath, timestamp: timestamp() },
    });
  });
}
