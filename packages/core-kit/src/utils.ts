/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardRunner,
  BreadboardCapability,
  BreadboardRunner,
  GraphDescriptor,
  NodeHandlerContext,
} from "@google-labs/breadboard";

export const loadGraphFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const graph = await context.loader?.load(path, context);
  if (!graph) throw new Error(`Unable to load graph from "${path}"`);
  return graph;
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

export const getGraphDescriptor = async (
  board: unknown,
  context: NodeHandlerContext
): Promise<GraphDescriptor | undefined> => {
  if (!board) return undefined;

  if (typeof board === "string") {
    const graph = await context.loader?.load(board, context);
    if (!graph) throw new Error(`Unable to load graph from "${board}"`);
    return graph;
  } else if (isBreadboardCapability(board)) {
    return board.board;
  } else if (isGraphDescriptor(board)) {
    return board;
  }
  return undefined;
};

export const getRunner = async (
  board: unknown,
  context: NodeHandlerContext
) => {
  const graph = await getGraphDescriptor(board, context);
  if (!graph) return undefined;
  const maybeRunnable = graph as BreadboardRunner | Record<string, unknown>;
  if (maybeRunnable.runOnce) {
    return maybeRunnable as BoardRunner;
  }
  return await BoardRunner.fromGraphDescriptor(graph);
};
