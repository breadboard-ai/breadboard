/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { anyOf } from "../type-system/any-of.js";
import { object } from "../type-system/object.js";
import type { ConvertBreadboardType } from "../type-system/type.js";

export const breadboardErrorType = anyOf(
  object({ message: "string" }),
  object({ kind: "string", error: object({ message: "string" }) })
);

export type BreadboardError = ConvertBreadboardType<typeof breadboardErrorType>;

export function normalizeBreadboardError(value: unknown): BreadboardError {
  if (value !== null && typeof value === "object") {
    if ("kind" in value && value.kind === "error") {
      return value as BreadboardError;
    }
    if ("message" in value) {
      return { kind: "error", error: value } as BreadboardError;
    }
  }
  const message = typeof value === "string" ? value : JSON.stringify(value);
  return { kind: "error", error: { message } };
}
