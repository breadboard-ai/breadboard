/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HydratedStore } from "../types.js";
import { pending, PENDING_HYDRATION } from "./sentinel.js";

/**
 * Checks if a property decorated with @field is still loading from storage.
 */
export function isHydrating<T>(value: T | pending): value is pending {
  return value === PENDING_HYDRATION;
}

export function isHydratedStore(v: unknown): v is HydratedStore {
  if (typeof v !== "object") return false;
  if (v === null) return false;
  return "registerSignalHydration" in v;
}
