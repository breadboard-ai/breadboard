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

export type InvokeNodeInputs = InputValues & {
  $board?: string | BreadboardCapability | GraphDescriptor;
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

// This looks like a generic utility function that could be moved to a shared
// location.
export const baseURLFromContext = (context: NodeHandlerContext) => {
  const invokingBoardURL = context.board?.url;
  if (invokingBoardURL) return new URL(invokingBoardURL);
  if (context.outerGraph?.url) return new URL(context.outerGraph.url);
  if (context.base) return context.base;
  // This should probably return SENTINEL_BASE_URL.
  return new URL(import.meta.url);
};

export const loadBoardFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const base = baseURLFromContext(context);
  const url = new URL(path, base);
  const graph = await context.loader?.load(url, context.outerGraph);
  if (!graph) throw new Error(`Unable to load graph from "${url.href}"`);
  return BoardRunner.fromGraphDescriptor(graph);
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
      type: "string", // TODO: Make this a union type
    },
  });
  const outputBuilder = new SchemaBuilder();
  if (context?.base) {
    const { board } = await getRunnableBoard(context, inputs || {});
    if (board) {
      const inspectableGraph = inspect(board);
      const { inputSchema, outputSchema } = await inspectableGraph.describe();
      inputBuilder.addProperties(inputSchema?.properties);
      inputSchema?.required && inputBuilder.addRequired(inputSchema?.required);
      outputBuilder.addProperties(outputSchema?.properties);
    }
  }
  return {
    inputSchema: inputBuilder.build(),
    outputSchema: outputBuilder.build(),
  };
};

export default {
  describe,
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { board, args } = await getRunnableBoard(context, inputs);
    if (!board) throw new Error("No board provided");

    return await board.runOnce(args, context);
  },
};
