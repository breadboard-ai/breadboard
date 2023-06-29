/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTraversalContext, InputValues, OutputValues } from "../types.js";

const store = new Map<string, unknown>();

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  Object.entries(inputs).forEach(([key, value]) => store.set(key, value));
  return Object.fromEntries(store.entries()) as OutputValues;
};
