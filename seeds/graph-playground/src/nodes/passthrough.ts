/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "../graph.js";

// This whole node is a hack, because I think I have the whole "etnry" edge
// thing wrong.

export default async (inputs?: InputValues) => {
  return inputs as OutputValues;
};
