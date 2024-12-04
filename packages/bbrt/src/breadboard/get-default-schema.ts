/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createLoader,
  inspect,
  type GraphDescriptor,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";

/**
 * Get the schema of a board without any inputs.
 */
export function getDefaultSchema(
  bgl: GraphDescriptor
): Promise<Result<NodeDescriberResult>> {
  return resultify(
    inspect(bgl, {
      kits: [],
      loader: createLoader(),
    }).describe({})
  );
}
