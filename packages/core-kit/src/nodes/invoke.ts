/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandlerContext,
  BreadboardCapability,
  GraphDescriptor,
  NodeDescriberContext,
  NodeIdentifier,
  GraphToRun,
} from "@google-labs/breadboard";
import {
  getGraphDescriptor,
  inspect,
  invokeGraph,
} from "@google-labs/breadboard";
import { getRunner, loadGraphFromPath } from "../utils.js";
import { defineNodeType, object, unsafeSchema } from "@breadboard-ai/build";

type InvokeNodeInputs = InputValues & {
  $board?: string | BreadboardCapability | GraphDescriptor;
  $start?: NodeIdentifier;
  $stopAfter?: NodeIdentifier;
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

type RunnableBoardWithArgs = {
  board: GraphToRun;
  start?: NodeIdentifier;
  stopAfter?: NodeIdentifier;
  args: InputValues;
};

const getRunnableBoard = async (
  context: NodeHandlerContext,
  inputs: InvokeNodeInputs
): Promise<RunnableBoardWithArgs> => {
  const { $board, $start: start, $stopAfter: stopAfter, ...args } = inputs;
  if ($board) {
    const result = await getRunner($board, context);
    if (!result.success) {
      throw new Error(result.error);
    }
    return { board: result, args };
  } else if (start) {
    if (!context.board) {
      throw new Error(
        "Start is present, but the context didn't provide the current board"
      );
    }
    return { board: { graph: context.board }, start, stopAfter, args };
  } else {
    const { path, board, graph, ...args } = inputs as InvokeNodeInputs;

    let result;

    if (board) {
      result = await getGraphDescriptor(board, context);
    } else if (graph) {
      result = { graph };
    } else if (path) {
      result = await loadGraphFromPath(path, context);
    }
    if (!result?.success) {
      throw new Error(`Unable to get board: ${result?.error}`);
    }
    return { board: result, start, stopAfter, args };
  }
};

const describe = async (
  inputs?: InvokeNodeInputs,
  context?: NodeDescriberContext
) => {
  if (context?.base) {
    let graphToRun: GraphToRun | undefined;
    if (inputs) {
      try {
        graphToRun = (await getRunnableBoard(context, inputs)).board;
      } catch {
        // eat any exceptions.
        // This is a describer, so it must always return some valid value.
      }
      if (graphToRun) {
        const inspectableGraph = inspect(graphToRun.graph, {
          kits: context.kits,
          loader: context.loader,
        });
        const { inputSchema, outputSchema } =
          await inspectableGraph.describe(inputs);
        return {
          inputs: unsafeSchema(inputSchema),
          outputs: unsafeSchema(outputSchema),
        };
      }
      return { inputs: { "*": {} }, outputs: { "*": {} } };
    }
  }
  return { inputs: {}, outputs: {} };
};

export default defineNodeType({
  name: "invoke",
  metadata: {
    title: "Invoke",
    description:
      "Invokes (runOnce) specified board, supplying remaining incoming wires as inputs for that board. Returns the outputs of the board.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-invoke-component",
    },
  },
  inputs: {
    path: {
      title: "path",
      behavior: ["deprecated"],
      description: "The path to the board to invoke.",
      type: "string",
      optional: true,
    },
    $board: {
      title: "Board",
      behavior: ["board", "config"],
      description:
        "The board to invoke. Can be a BoardCapability, a graph or a URL",
      // TODO(aomarks) A better type.
      type: object({}),
      optional: true,
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: async (staticInputs, dynamicInputs, context) => {
    // TODO(aomarks) Cast here because the type system doesn't understand
    // BreadboardCapability or GraphDescriptors yet.
    const inputs = { ...staticInputs, ...dynamicInputs } as InvokeNodeInputs;
    return describe(inputs, context);
  },
  invoke: async (staticInputs, dynamicInputs, context) => {
    // TODO(aomarks) Cast here because the type system doesn't understand
    // BreadboardCapability or GraphDescriptors yet.
    const inputs = { ...staticInputs, ...dynamicInputs } as InvokeNodeInputs;
    const { board, args, start, stopAfter } = await getRunnableBoard(
      context,
      inputs
    );
    if (!board) {
      console.warn("Could not get a runnable board");
      throw new Error("Could not get a runnable board");
    }
    // If the current board has a URL, pass it as new base.
    // Otherwise, use the previous base.
    const base = context.board?.url && new URL(context.board?.url);
    const invocationContext = base
      ? {
          ...context,
          base,
          start,
          stopAfter,
        }
      : { ...context, start, stopAfter };

    return await invokeGraph(board, args, invocationContext);
  },
});
