/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Screen size category based on viewport width breakpoints.
 */
export type ScreenSize = "narrow" | "medium" | "wide";

/**
 * Breakpoint constants for responsive design.
 * - narrow: viewport width ≤ NARROW_BREAKPOINT
 * - medium: viewport width ≤ MEDIUM_BREAKPOINT (and > NARROW_BREAKPOINT)
 * - wide: viewport width > MEDIUM_BREAKPOINT
 */
export const NARROW_BREAKPOINT = 620;
export const MEDIUM_BREAKPOINT = 830;

/**
 * Controller for managing responsive screen size state.
 *
 * This controller tracks the viewport width and categorizes it into
 * "narrow", "medium", or "wide" buckets. Components can react to the
 * `size` signal to adapt their rendering for different screen sizes.
 *
 * The controller automatically initializes media query listeners and
 * updates the `size` field when the viewport crosses breakpoint thresholds.
 *
 * @example
 * ```typescript
 * // In a component with scaContext
 * const screenSize = this.sca.controller.global.screenSize.size;
 * if (screenSize === "narrow") {
 *   // Render mobile-optimized UI
 * }
 * ```
 */
export class ScreenSizeController extends RootController {
  /**
   * The current screen size category.
   * Updates reactively when viewport width crosses breakpoints.
   */
  @field()
  accessor size: ScreenSize = "wide";

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
    this.#initMediaListeners();
  }

  #initMediaListeners() {
    // Guard for SSR/test environments where window or matchMedia is not available
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const narrowQuery = window.matchMedia(
      `(max-width: ${NARROW_BREAKPOINT}px)`
    );
    const mediumQuery = window.matchMedia(
      `(max-width: ${MEDIUM_BREAKPOINT}px)`
    );

    const updateSize = () => {
      if (narrowQuery.matches) {
        this.size = "narrow";
      } else if (mediumQuery.matches) {
        this.size = "medium";
      } else {
        this.size = "wide";
      }
    };

    // Set initial value
    updateSize();

    // Listen for viewport changes
    narrowQuery.addEventListener("change", updateSize);
    mediumQuery.addEventListener("change", updateSize);
  }
}
