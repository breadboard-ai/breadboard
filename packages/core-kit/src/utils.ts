/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeHandlerContext,
  Throttler,
  getGraphDescriptor,
} from "@google-labs/breadboard";

export const loadGraphFromPath = async (
  path: string,
  context: NodeHandlerContext
) => {
  const loaderResult = await context.loader?.load(path, context);
  if (!loaderResult?.success)
    throw new Error(`Unable to load graph from "${path}"`);
  return loaderResult.graph;
};

type GetGraphDescriptorThrottler = Throttler<
  [unknown, NodeHandlerContext],
  GraphDescriptor | undefined
>;

const graphDescriptorCache = new Map<unknown, GetGraphDescriptorThrottler>();

export const getRunner = async (
  board: unknown,
  context: NodeHandlerContext
) => {
  let throttler;
  if (!graphDescriptorCache.has(board)) {
    throttler = new Throttler(getGraphDescriptor);
    graphDescriptorCache.set(board, throttler);
  } else {
    throttler = graphDescriptorCache.get(board)!;
  }
  return throttler.call({}, board, context);
};
