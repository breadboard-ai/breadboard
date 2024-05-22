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
} from "@google-labs/breadboard";
import { BoardRunner, inspect } from "@google-labs/breadboard";
import { getRunner, loadGraphFromPath } from "../utils.js";
import { defineNodeType, unsafeSchema } from "@breadboard-ai/build";

export type InvokeNodeInputs = InputValues & {
  $board?: string | BreadboardCapability | GraphDescriptor;
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

type RunnableBoardWithArgs = {
  board: BoardRunner | undefined;
  args: InputValues;
};

const getRunnableBoard = async (
  context: NodeHandlerContext,
  inputs: InvokeNodeInputs
): Promise<RunnableBoardWithArgs> => {
  const { $board, ...args } = inputs;
  if ($board) {
    const board = await getRunner($board, context);
    return { board, args };
  } else {
    const { path, board, graph, ...args } = inputs as InvokeNodeInputs;

    let runnableBoard;

    if (board) {
      runnableBoard = await BoardRunner.fromBreadboardCapability(board);
    } else if (graph) {
      runnableBoard = await BoardRunner.fromGraphDescriptor(graph);
    } else if (path) {
      runnableBoard = await BoardRunner.fromGraphDescriptor(
        await loadGraphFromPath(path, context)
      );
    }
    return { board: runnableBoard, args };
  }
};

const describe = async (
  inputs?: InvokeNodeInputs,
  context?: NodeDescriberContext
) => {
  if (context?.base) {
    let board: GraphDescriptor | undefined;
    if (inputs) {
      try {
        board = (await getRunnableBoard(context, inputs)).board;
      } catch {
        // eat any exceptions.
        // This is a describer, so it must always return some valid value.
      }
      if (board) {
        const inspectableGraph = inspect(board);
        const { inputSchema, outputSchema } = await inspectableGraph.describe();
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
      title: "board",
      behavior: ["board"],
      description:
        "The board to invoke. Can be a BoardCapability, a graph or a URL",
      // TODO(aomarks) A better type.
      type: "unknown",
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
    const { board, args } = await getRunnableBoard(context, inputs);
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
        }
      : { ...context };

    return await board.runOnce(args, invocationContext);
  },
});
