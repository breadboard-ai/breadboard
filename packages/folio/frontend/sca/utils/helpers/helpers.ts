/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HydratedController } from "../../types.js";
import { PENDING_HYDRATION } from "../sentinel.js";
import { Utils } from "../../utils.js";

const logger = Utils.Logging.getLogger();
const Formatter = Utils.Logging.Formatter;

let ignoreHydrationErrors = false;

/**
 * Checks if a property decorated with @field is still loading from storage.
 */
export function isHydrating<T>(accessor: () => T): boolean {
  const restore = ignoreHydrationErrors;
  ignoreHydrationErrors = true;
  try {
    if (accessor.constructor.name === "AsyncFunction") {
      logger.log(
        Formatter.warning("isHydrating accessors must be synchronous"),
        "Hydration Error"
      );
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
    const msg = Formatter.error(
      `You are trying to access the field "${fieldName}" while it is still hydrating. ` +
        `Always check "if (isHydrating(() => obj.${fieldName}))" before using it.`
    );

    if (!ignoreHydrationErrors) {
      logger.log(msg, "Hydration Error");
    }

    super(`PendingHydrationError on ${fieldName}`);
    this.name = "PendingHydrationError";
  }
}
