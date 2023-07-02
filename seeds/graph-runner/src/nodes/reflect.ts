/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTraversalContext, InputValues } from "../types.js";

export default async (context: GraphTraversalContext, _inputs: InputValues) => {
  const graph = await context.getCurrentGraph();
  return { graph };
};
