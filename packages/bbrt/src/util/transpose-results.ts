/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "./result.js";

export function transposeResults<T, E = unknown>(
  results: Array<Result<T, E>>
): Result<T[], E[]> {
  const values = [];
  const errors = [];
  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }
  if (errors.length > 0) {
    return { ok: false, error: errors };
  }
  return { ok: true, value: values };
}
