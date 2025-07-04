/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGraphDescriptor } from "@breadboard-ai/loader";
import type {
  GraphLoaderResult,
  NodeHandlerContext,
} from "@breadboard-ai/types";
import { Throttler } from "@breadboard-ai/utils";

export const loadGraphFromPath = async (
  path: string,
  context: NodeHandlerContext
): Promise<GraphLoaderResult> => {
  if (!context.loader) {
    return {
      success: false,
      error: "Loader wasn't provided to load graph from path",
    };
  }
  const loaderResult = await context.loader.load(path, context);
  if (!loaderResult.success) {
    return {
      success: false,
      error: `Unable to load graph from "${path}": ${loaderResult?.error}`,
    };
  }
  return loaderResult;
};

type GetGraphDescriptorThrottler = Throttler<
  [unknown, NodeHandlerContext],
  GraphLoaderResult
>;

const graphDescriptorCache = new Map<unknown, GetGraphDescriptorThrottler>();

export const getRunner = async (
  board: unknown,
  context: NodeHandlerContext
): Promise<GraphLoaderResult> => {
  let throttler;
  if (!graphDescriptorCache.has(board)) {
    throttler = new Throttler(getGraphDescriptor);
    graphDescriptorCache.set(board, throttler);
  } else {
    throttler = graphDescriptorCache.get(board)!;
  }
  return throttler.call({}, board, context);
};
