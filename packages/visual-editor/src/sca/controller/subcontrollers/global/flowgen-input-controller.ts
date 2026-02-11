/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import type { LiteModeIntentExample } from "../../../../ui/state/types.js";

/**
 * Status type for the flowgen input component.
 * Matches the internal state model of FlowgenEditorInput.
 */
export type FlowgenInputStatus =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown; suggestedIntent?: string };

/**
 * Example intents shown on the lite mode home screen.
 */
export const FLOWGEN_EXAMPLES: LiteModeIntentExample[] = [
  {
    intent:
      "Help me prepare for a quiz on a given topic by creating sample questions with hints as an interactive quiz",
  },
  {
    intent:
      "Take a photo of the leftovers in the fridge and generate different recipes with photos of the final dish",
  },
  {
    intent:
      "Analyze a meeting transcript and draft an email of the key takeaways and action items",
  },
  {
    intent:
      "An app that takes a given resume and a job description the candidate is interested in, then provides a critique of the resume",
  },
];

/**
 * Controller for managing shared flowgen input state across responsive layouts.
 *
 * When the viewport changes between narrow and wide modes, different instances
 * of the FlowgenEditorInput component are rendered. This controller maintains
 * the shared state (input value and status) so that user input is not lost
 * during responsive layout transitions.
 *
 * Also manages lite-mode generation state including planner progress.
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
   * The text of the example intent that was clicked (if any).
   * Used as fallback when no graph intent exists yet.
   * This is UI state separate from the graph's stored metadata.intent.
   */
  @field()
  accessor currentExampleIntent: string = "";

  /**
   * Planner status message shown during generation.
   */
  @field()
  accessor plannerStatus: string = "Creating your app";

  /**
   * Planner thought/progress message shown during generation.
   */
  @field()
  accessor plannerThought: string = "Planning ...";

  /**
   * Whether the user has seen the global confirmation dialog.
   */
  @field({ persist: "local" })
  accessor seenConfirmationDialog: boolean = false;

  /**
   * Example intents for the home screen.
   */
  get examples() {
    return FLOWGEN_EXAMPLES;
  }

  /**
   * Whether generation is currently in progress.
   */
  get isGenerating() {
    return this.state.status === "generating";
  }

  /**
   * The intent for generation.
   * Only returns the value when generation is in progress (not initial).
   */
  get intent() {
    if (this.state.status !== "initial" && this.#intentValue) {
      return this.#intentValue;
    }
    return "";
  }

  #intentValue: string | undefined;

  /**
   * Set the intent for generation.
   */
  setIntent(intent: string) {
    this.#intentValue = intent;
  }

  /**
   * Start generation mode.
   */
  startGenerating() {
    this.state = { status: "generating" };
  }

  /**
   * Clears all input state and resets to initial.
   * Called after successful generation or when starting fresh.
   */
  clear() {
    this.inputValue = "";
    this.currentExampleIntent = "";
    this.#intentValue = undefined;
    this.plannerStatus = "Creating your app";
    this.plannerThought = "Planning ...";
    this.state = { status: "initial" };
  }
}
