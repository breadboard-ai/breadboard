/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  NodeHandlerContext,
  BreadboardCapability,
  GraphDescriptor,
  Schema,
  NodeDescriberContext,
  NodeHandlerObject,
} from "@google-labs/breadboard";
import { BoardRunner, inspect } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";
import { getRunner, loadGraphFromPath } from "../utils.js";

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
  inputs?: InputValues,
  _in?: Schema,
  _out?: Schema,
  context?: NodeDescriberContext
) => {
  const inputBuilder = new SchemaBuilder().addProperties({
    path: {
      title: "path",
      behavior: ["deprecated"],
      description: "The path to the board to invoke.",
      type: "string",
    },
    $board: {
      title: "board",
      behavior: ["board"],
      description:
        "The board to invoke. Can be a BoardCapability, a graph or a URL",
      type: "object",
    },
  });
  const outputBuilder = new SchemaBuilder();
  if (context?.base) {
    let board: GraphDescriptor | undefined;
    outputBuilder.setAdditionalProperties(true);
    inputBuilder.setAdditionalProperties(true);
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
        inputBuilder.addProperties(inputSchema?.properties);
        inputBuilder.setAdditionalProperties(inputSchema.additionalProperties);
        inputSchema?.required &&
          inputBuilder.addRequired(inputSchema?.required);
        outputBuilder.addProperties(outputSchema?.properties);
        outputBuilder.setAdditionalProperties(
          outputSchema.additionalProperties
        );
      }
    }
  }
  const inputSchema = inputBuilder.build();
  const outputSchema = outputBuilder.build();
  return { inputSchema, outputSchema };
};

export default {
  metadata: {
    title: "Invoke",
    description:
      "Invokes (runOnce) specified board, supplying remaining incoming wires as inputs for that board. Returns the outputs of the board.",
  },
  describe,
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
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
} satisfies NodeHandlerObject;
