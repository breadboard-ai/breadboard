/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "@breadboard-ai/types";

export function formatError(error: unknown): string {
  if (typeof error === "string") {
    return error.trim();
  }

  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  const asError = error as ErrorObject;
  if (typeof asError.error === "string") {
    return asError.error.trim();
  }

  let output = "";
  let current = asError;
  while (typeof current === "object" && current) {
    if ("message" in current) {
      output += `${current.message}\n`;
    }
    current = current.error as ErrorObject;
  }

  return output.trim();
}
