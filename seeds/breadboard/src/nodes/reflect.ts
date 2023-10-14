/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/graph-runner";
import type { NodeHandlerContext } from "../types.js";

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export default async (
  _inputs: InputValues,
  context?: NodeHandlerContext
): Promise<OutputValues> => {
  if (!context) throw new Error("No context provided to reflect node");
  const graph = deepCopy(context.board);
  return { graph };
};
