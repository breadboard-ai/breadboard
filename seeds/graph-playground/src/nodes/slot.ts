/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTraversalContext, InputValues, OutputValues } from "../types.js";

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  console.log("This is a slot, it doesn't do anything by itself");
  return {};
};
