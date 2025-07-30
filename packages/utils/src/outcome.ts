/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";

export { ok, err };

function ok<T>(o: Outcome<Awaited<T>>): o is Awaited<T> {
  return !(o && typeof o === "object" && "$error" in o);
}

function err($error: string, metadata?: Record<string, string>) {
  return { $error, ...(metadata && { metadata }) };
}
