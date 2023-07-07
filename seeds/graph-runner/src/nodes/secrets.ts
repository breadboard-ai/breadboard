/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A kind of input node that provides secret values, such as API keys.
 * Currently, it simply reads them from environment.
 */

import type {
  GraphTraversalContext,
  InputValues,
  OutputValues,
} from "../types.js";

export default async (_cx: GraphTraversalContext, _inputs: InputValues) => {
  return process.env as OutputValues;
};
