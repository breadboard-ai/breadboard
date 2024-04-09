/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardRunner,
  BreadboardCapability,
  GraphDescriptor,
  NodeHandlerContext,
} from "@google-labs/breadboard";

export const loadBoardFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const graph = await context.loader?.load(path, context);
  if (!graph) throw new Error(`Unable to load graph from "${path}"`);
  return BoardRunner.fromGraphDescriptor(graph);
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

export const getRunner = async (
  board: unknown,
  context: NodeHandlerContext
) => {
  if (!board) return undefined;

  if (typeof board === "string") {
    return await loadBoardFromPath(board, context);
  } else if (isBreadboardCapability(board)) {
    return await BoardRunner.fromBreadboardCapability(board);
  } else if (isGraphDescriptor(board)) {
    return await BoardRunner.fromGraphDescriptor(board);
  }
  return undefined;
};
