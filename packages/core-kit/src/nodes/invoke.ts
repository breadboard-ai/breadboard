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
} from "@google-labs/breadboard";
import { BoardRunner, inspect } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";
import { loadBoardFromPath } from "../load-board.js";

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
    let board;

    if (isBreadboardCapability($board)) {
      board = await BoardRunner.fromBreadboardCapability($board);
    } else if (isGraphDescriptor($board)) {
      board = await BoardRunner.fromGraphDescriptor($board);
    } else if (typeof $board === "string") {
      board = await loadBoardFromPath($board, context);
    } else {
      board = undefined;
    }
    return { board, args };
  } else {
    const { path, board, graph, ...args } = inputs as InvokeNodeInputs;

    let runnableBoard;

    if (board) {
      runnableBoard = await BoardRunner.fromBreadboardCapability(board);
    } else if (graph) {
      runnableBoard = await BoardRunner.fromGraphDescriptor(graph);
    } else if (path) {
      runnableBoard = await loadBoardFromPath(path, context);
    }
    return { board: runnableBoard, args };
  }
};

const isBreadboardCapability = (
  candidate: unknown
): candidate is BreadboardCapability => {
  const board = candidate as BreadboardCapability;
  return (
    board &&
    typeof board === "object" &&
    board.kind === "board" &&
    board.board &&
    isGraphDescriptor(board.board)
  );
};

const isGraphDescriptor = (
  candidate: unknown
): candidate is GraphDescriptor => {
  const graph = candidate as GraphDescriptor;
  return (
    graph && typeof graph === "object" && graph.nodes && graph.edges && true
  );
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
    try {
      board = (await getRunnableBoard(context, inputs || {})).board;
    } catch {
      // eat any exceptions.
      // This is a describer, so it must always return some valid value.
    }
    if (board) {
      const inspectableGraph = inspect(board);
      const { inputSchema, outputSchema } = await inspectableGraph.describe();
      inputBuilder.addProperties(inputSchema?.properties);
      inputBuilder.setAdditionalProperties(inputSchema.additionalProperties);
      inputSchema?.required && inputBuilder.addRequired(inputSchema?.required);
      outputBuilder.addProperties(outputSchema?.properties);
      outputBuilder.setAdditionalProperties(outputSchema.additionalProperties);
    } else {
      outputBuilder.setAdditionalProperties(true);
      inputBuilder.setAdditionalProperties(true);
    }
  }
  const inputSchema = inputBuilder.build();
  const outputSchema = outputBuilder.build();
  return { inputSchema, outputSchema };
};

export default {
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
};
