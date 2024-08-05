/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
  return getGraphDescriptor(board, context);
};
