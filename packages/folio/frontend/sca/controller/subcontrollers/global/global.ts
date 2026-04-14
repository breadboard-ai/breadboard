/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * The Global Controller for Folio.
 */
export class GlobalController extends RootController {
  /**
   * Indicates that the UI is currently undertaking an action and that the user
   * should be prevented from interacting while that takes place.
   */
  @field()
  accessor blockingAction = false;

  /**
   * Error message to display in the current view.
   */
  @field()
  accessor viewError = "";

  constructor() {
    super("Global", "GlobalController");
  }
}
