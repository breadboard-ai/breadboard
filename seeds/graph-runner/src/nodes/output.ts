/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTraversalContext, InputValues } from "../types.js";

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  context.provideExternalOutput(inputs);
};
