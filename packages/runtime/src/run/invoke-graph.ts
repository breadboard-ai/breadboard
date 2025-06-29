/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { timestamp } from "../timestamp.js";
import type { GraphToRun, RunArguments } from "@breadboard-ai/types";
import type {
  InputValues,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import { runGraph } from "./run-graph.js";

/**
 * Runs a graph in "run as component" mode. See
 * https://breadboard-ai.github.io/breadboard/docs/reference/runtime-semantics/#run-as-component-mode
 * for more details.
 */
export async function invokeGraph(
  graphToRun: GraphToRun,
  inputs: InputValues,
  context: RunArguments = {},
  resumeFrom?: TraversalResult
): Promise<OutputValues> {
  const graph = graphToRun.graph;
  const args = { ...inputs, ...graph.args };
  const { probe } = context;

  try {
    let outputs: OutputValues = {};

    const path = context.invocationPath || [];
    const lifecycle = context.state?.lifecycle();

    for await (const result of runGraph(
      graphToRun,
      { ...context, inputs },
      resumeFrom
    )) {
      if (result.type === "input") {
        // Pass the inputs to the board. If there are inputs bound to the
        // board (e.g. from a lambda node that had incoming wires), they will
        // overwrite supplied inputs.
        result.inputs = args;
      } else if (result.type === "output") {
        outputs = result.outputs;
        // Exit once we receive the first output.
        await probe?.report?.({
          type: "nodeend",
          data: {
            node: result.node,
            inputs: result.inputs,
            outputs,
            path: [...path, result.invocationId],
            timestamp: timestamp(),
            newOpportunities: result.state.newOpportunities,
          },
        });
        lifecycle?.dispatchNodeEnd(outputs, [...path, result.invocationId]);

        lifecycle?.dispatchGraphEnd();

        await probe?.report?.({
          type: "graphend",
          data: { path, timestamp: timestamp() },
        });
        break;
      } else {
        outputs = result.outputs;
      }
    }
    return outputs;
  } catch (e) {
    // Unwrap unhandled error (handled errors are just outputs of the board!)
    if ((e as Error).cause)
      return { $error: (e as Error).cause } as OutputValues;
    else throw e;
  }
}
