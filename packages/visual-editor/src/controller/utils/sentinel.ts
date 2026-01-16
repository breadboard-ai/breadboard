/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Formatter from "./logging/formatter.js";
import { getLogger } from "./logging/logger.js";

export const _HYDRATION = Symbol("Pending");

/**
 * This is a singleton object (Proxy) that throws a descriptive error whenever
 * a property is accessed. This ensures developers don't accidentally render
 * or use a value that hasn't finished loading from storage yet.
 *
 * It allows `toString` and `Symbol.toStringTag` so that console logging
 * doesn't crash the browser devtools.
 */
export const PENDING_HYDRATION = new Proxy(
  {},
  {
    /* c8 ignore next 20 */
    get(_target, prop, _receiver) {
      // Allow safe inspection for debugging/logging
      if (prop === Symbol.toStringTag) return "PendingHydration";
      if (prop === Symbol.toPrimitive) return () => "PENDING_HYDRATION";
      if (prop === "toString") return () => "PENDING_HYDRATION";
      if (prop === "valueOf") return () => _HYDRATION;

      // Throw on any actual property access (e.g. .size, .length, .foo)
      const msg = Formatter.error(
        `You are trying to access property "${String(
          prop
        )}" on a @field that is still hydrating. ` +
          `Always check "if (isHydrating(this.field))" before using it.`
      );
      const logger = getLogger();
      logger.log(msg, "Hydration Error", false);

      throw new Error("Access attempted to unhydrated value");
    },
  }
) as symbol;

export type pending = typeof PENDING_HYDRATION;
