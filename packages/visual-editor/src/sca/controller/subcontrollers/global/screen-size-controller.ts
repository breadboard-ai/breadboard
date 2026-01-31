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
 * This controller holds the viewport size category ("narrow", "medium", or "wide").
 * The actual media query listeners are managed by the screen-size trigger,
 * which updates this controller's `size` signal when breakpoints are crossed.
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
   * Updated by the screen-size trigger when viewport width crosses breakpoints.
   */
  @field()
  accessor size: ScreenSize = "wide";
}

