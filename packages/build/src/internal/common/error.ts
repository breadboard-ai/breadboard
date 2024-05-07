/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { object } from "../type-system/object.js";
import type { ConvertBreadboardType } from "../type-system/type.js";

export const breadboardErrorType = object({ message: "string" });

export type BreadboardError = ConvertBreadboardType<typeof breadboardErrorType>;

export function normalizeBreadboardError(value: unknown): BreadboardError {
  if (typeof value === "object" && value !== null && "message" in value) {
    console.log("$error", value, 0);
    return value as BreadboardError;
  }
  console.log("$error", value, 1);
  return { message: typeof value === "string" ? value : JSON.stringify(value) };
}
