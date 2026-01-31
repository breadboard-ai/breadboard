/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeTrigger } from "../binder.js";
import {
  NARROW_BREAKPOINT,
  MEDIUM_BREAKPOINT,
} from "../../controller/subcontrollers/global/screen-size-controller.js";

export const bind = makeTrigger();

/**
 * Trigger that updates the ScreenSizeController when the browser's viewport
 * crosses breakpoint thresholds.
 *
 * This replaces the media query listeners that were previously in the
 * `ScreenSizeController` constructor.
 */
export function registerMediaQueryTrigger() {
  // Guard for SSR/test environments where window or matchMedia is not available
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return;
  }

  const narrowQuery = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
  const mediumQuery = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT}px)`);

  const updateSize = () => {
    if (narrowQuery.matches) {
      bind.controller.global.screenSize.size = "narrow";
    } else if (mediumQuery.matches) {
      bind.controller.global.screenSize.size = "medium";
    } else {
      bind.controller.global.screenSize.size = "wide";
    }
  };

  // Set initial value synchronously
  updateSize();

  // Listen for viewport changes
  narrowQuery.addEventListener("change", updateSize);
  mediumQuery.addEventListener("change", updateSize);

  // Register for bookkeeping (allows bind.list() and bind.clean())
  bind.register("Screen Size Media Query Trigger", updateSize);
}
