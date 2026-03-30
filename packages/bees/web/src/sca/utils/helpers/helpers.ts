/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HydratedController } from "../../types.js";
import { PENDING_HYDRATION } from "../sentinel.js";

let ignoreHydrationErrors = false;

export function isHydrating<T>(accessor: () => T): boolean {
  const restore = ignoreHydrationErrors;
  ignoreHydrationErrors = true;
  try {
    if (accessor.constructor.name === "AsyncFunction") {
      throw new Error("isHydrating accessors must be synchronous");
    }
    const value = accessor();
    return value === PENDING_HYDRATION;
  } catch (err) {
    if (err instanceof PendingHydrationError) {
      return true;
    }
    throw err;
  } finally {
    ignoreHydrationErrors = restore;
  }
}

export function isHydratedController(
  value: unknown
): value is HydratedController {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  return "registerSignalHydration" in value;
}

export class PendingHydrationError extends Error {
  constructor(fieldName: string) {
    super(`PendingHydrationError on ${fieldName}`);
    this.name = "PendingHydrationError";
  }
}
