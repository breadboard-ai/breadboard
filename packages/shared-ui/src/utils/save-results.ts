/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type OutputValues } from "@breadboard-ai/types";
import { type TopGraphRunResult } from "../types/types.js";

export function findFinalOutputValues(
  topGraphResult: TopGraphRunResult
): OutputValues | null {
  const finalEdgeValue = topGraphResult.log.findLast(
    (entry) => entry.type === "edge"
  )?.value;
  if (finalEdgeValue && Object.keys(finalEdgeValue).length > 0) {
    return finalEdgeValue;
  }
  return null;
}
