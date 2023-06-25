/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphContext, InputValues } from "../graph.js";

export default async (context: GraphContext, inputs: InputValues) => {
  return await context.requestExternalInput(inputs);
};
