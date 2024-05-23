/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardRunner,
  BreadboardRunner,
  NodeHandlerContext,
  getGraphDescriptor,
} from "@google-labs/breadboard";

export const loadGraphFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const graph = await context.loader?.load(path, context);
  if (!graph) throw new Error(`Unable to load graph from "${path}"`);
  return graph;
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
