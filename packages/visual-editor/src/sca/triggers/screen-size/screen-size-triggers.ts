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

  const { controller } = bind;

  const narrowQuery = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT}px)`);
  const mediumQuery = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT}px)`);

  const updateSize = () => {
    if (narrowQuery.matches) {
      controller.global.screenSize.size = "narrow";
    } else if (mediumQuery.matches) {
      controller.global.screenSize.size = "medium";
    } else {
      controller.global.screenSize.size = "wide";
    }
  };

  // Set initial value synchronously
  updateSize();

  // Register event bridges for proper cleanup
  bind.registerEventBridge("Screen Size Narrow Query", narrowQuery, "change", updateSize);
  bind.registerEventBridge("Screen Size Medium Query", mediumQuery, "change", updateSize);
}
