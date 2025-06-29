/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphIdentifier, SingleEditResult } from "@breadboard-ai/types";

export { error, errorNoInspect };

function errorNoInspect(graphId: GraphIdentifier) {
  return error(`Unable to inspect graph with the id of "${graphId}"`);
}

function error(message: string): SingleEditResult {
  return {
    success: false,
    error: message,
  };
}
