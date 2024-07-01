/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isObject } from "../generate";

export function sortObject(obj: unknown): object {
  if (Array.isArray(obj)) {
    return obj.sort().map((value) => sortObject(value));
  } else if (isObject(obj)) {
    return Object.keys(obj)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = sortObject(obj[key]);
          return acc;
        },
        {} as Record<string, unknown>
      );
  } else {
    return obj as object;
  }
}
