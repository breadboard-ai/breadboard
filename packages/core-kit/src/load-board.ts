/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner, NodeHandlerContext } from "@google-labs/breadboard";

export const loadBoardFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const graph = await context.loader?.load(path, context);
  if (!graph) throw new Error(`Unable to load graph from "${path}"`);
  return BoardRunner.fromGraphDescriptor(graph);
};
