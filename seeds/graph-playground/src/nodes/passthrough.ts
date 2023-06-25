/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphTraversalContext,
  InputValues,
  OutputValues,
} from "../graph.js";

export default async (_cx: GraphTraversalContext, inputs: InputValues) => {
  return inputs as OutputValues;
};
