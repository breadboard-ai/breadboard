/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Status type for the flowgen input component.
 * Matches the internal state model of FlowgenEditorInput.
 */
export type FlowgenInputStatus =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown; suggestedIntent?: string };

/**
 * Controller for managing shared flowgen input state across responsive layouts.
 *
 * When the viewport changes between narrow and wide modes, different instances
 * of the FlowgenEditorInput component are rendered. This controller maintains
 * the shared state (input value and status) so that user input is not lost
 * during responsive layout transitions.
 *
 * The state is NOT persisted across page refreshes since it represents
 * transient user input.
 */
export class FlowgenInputController extends RootController {
  /**
   * The current value of the flowgen input textarea.
   */
  @field()
  accessor inputValue: string = "";

  /**
   * The current status of the flowgen input (initial, generating, or error).
   */
  @field({ deep: true })
  accessor state: FlowgenInputStatus = { status: "initial" };

  /**
   * Clears both the input value and resets the state to initial.
   * Called after successful generation or when starting fresh.
   */
  clear(): void {
    this.inputValue = "";
    this.state = { status: "initial" };
  }
}
