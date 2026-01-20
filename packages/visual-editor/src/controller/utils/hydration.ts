/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Formatter from "./logging/formatter.js";
import { getLogger } from "./logging/logger.js";
import { HydratedController } from "../types.js";
import { PENDING_HYDRATION } from "./sentinel.js";

/**
 * Checks if a property decorated with @field is still loading from storage.
 *
 * There are a few ways this could go. In the first instance we will try and
 * call the accessor that we were provided. If this is the main usage then
 * trying to call the @field getter when the value is hydrating will trigger a
 * PendingHydrationError to be thrown.
 *
 * On the other hand it may be that we are access the underlying signal value
 * directly, as per the RootController checking for the subclass's hydration
 * status. In this case we will need to check whether the value of the signal
 * matches the PENDING_HYDRATION symbol.
 *
 * Finally, it could just be that the value has hydrated and therefore the
 * accessor runs without Error and the value is not the hydration symbol.
 */
export function isHydrating<T>(accessor: () => T): boolean {
  try {
    const value = accessor();
    return value === PENDING_HYDRATION;
  } catch (err) {
    if (err instanceof PendingHydrationError) {
      return true;
    }

    throw err;
  }
}

export function isHydratedController(v: unknown): v is HydratedController {
  if (typeof v !== "object") return false;
  if (v === null) return false;
  return "registerSignalHydration" in v;
}

export class PendingHydrationError extends Error {
  constructor(fieldName: string) {
    const msg = Formatter.error(
      `You are trying to access the field "${fieldName}" while it is still hydrating. ` +
        `Always check "if (isHydrating(() => obj.${fieldName}))" before using it.`
    );

    // Log immediately so it's visible even if the error is swallowed somewhere
    const logger = getLogger();
    logger.log(msg, "Hydration Error", false);

    super(`PendingHydrationError on ${fieldName}`);
    this.name = "PendingHydrationError";
  }
}
