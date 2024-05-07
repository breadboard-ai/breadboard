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
  return typeof value === "object" && value !== null && "message" in value
    ? (value as BreadboardError)
    : { message: typeof value === "string" ? value : JSON.stringify(value) };
}
