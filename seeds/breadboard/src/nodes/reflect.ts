/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, InputValues, OutputValues } from "../types.js";
import type { NodeHandlerContext } from "../types.js";

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export default async (
  _inputs: InputValues,
  context: NodeHandlerContext
): Promise<OutputValues> => {
  const graph = deepCopy(context.board);
  return { graph };
};
