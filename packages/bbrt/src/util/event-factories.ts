/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TurnChunkError } from "../state/turn-chunk.js";
import { coercePresentableError } from "./presentable-error.js";

export function makeErrorEvent(e: unknown): TurnChunkError {
  return {
    kind: "error",
    timestamp: Date.now(),
    error: coercePresentableError(e),
  };
}
