/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../graph.js";

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  return await context.requestExternalInput(inputs);
};
