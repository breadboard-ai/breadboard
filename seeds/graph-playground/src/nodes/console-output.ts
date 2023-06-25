/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphContext, InputValues } from "../graph.js";

export default async (inputs?: InputValues, context?: GraphContext) => {
  if (!inputs) throw new Error("To provide output, we need `inputs`");
  if (!context) throw new Error("To provide output, we need `context`");
  context.provideExternalOutput(inputs);
  return {};
};
