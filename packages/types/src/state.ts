/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues } from "./graph-descriptor.js";
import { LLMContent } from "./llm-content.js";
import { Particle } from "./particles.js";
import { NodeRunState } from "./run-status.js";
import { Schema } from "./schema.js";

export type SimplifiedProjectRunState = {
  console: Map<string, ConsoleEntry>;
  /**
   * Represents the App state during the run.
   */
  app: App;
};

/**
 * Represents an error that occurred during a run.
 */
export type RunError = {
  message: string;
  /**
   * Details of the error (if any) in markdown.
   */
  details?: string;
};

/**
 * Represents the Model+Controller for a single Console entry.
 * Currently, each entry represents the output of a step when it's run.
 */
export type ConsoleEntry = {
  title: string;
  icon?: string;
  tags?: string[];
  status?: NodeRunState;
  open: boolean;
  /**
   * Indicates that this entry replaced an existing entry (or is a "re-run"),
   * and likely has new outputs that are worth showing the user.
   */
  rerun: boolean;

  /**
   * A list of work items: things that a step is doing.
   */
  work: Map<string, WorkItem>;
  /**
   * The final output of the step.
   */
  output: Map<string, LLMContent /* Particle */>;

  /**
   * The error message that might have occurred in this step
   */
  error: RunError | null;

  /**
   * Starts out as `false` and is set to `true` when the entry is finalized.
   */
  completed: boolean;

  /**
   * A convenient pointer at the last work item.
   */
  current: WorkItem | null;
};

export type A2UIServerReceiver = {
  /**
   * Sends a message to the A2UI server.
   * @param payload -- TODO make this A2UIClientEventMessage
   */
  sendMessage(payload: unknown): void;
};

export type SimplifiedA2UIClient = {
  /**
   * The A2UI Model Processor
   * TODO: Incorporate A2UI types properly into this type system.
   */
  processor: unknown;
  receiver: A2UIServerReceiver;
};

/**
 * Represents the Model+Controller for a single work item within the
 * Console entry. Work items are a way for the steps to communicate what they
 * are doing.
 */
export type WorkItem = {
  title: string;
  icon?: string;
  /**
   * Start time for the work item.
   */
  start: number;
  /**
   * End time for the work time (null if still in progress)
   */
  end: number | null;
  /**
   * How long this item has been running so far (in milliseconds)
   */
  elapsed: number;
  /**
   * If true, this work item currently awaiting user input.
   */
  awaitingUserInput: boolean;
  /**
   * If true, this work item is open by default.
   */
  openByDefault?: boolean;
  /**
   * If true, indicates that this work item was shown to the user as part
   * of a chat interaction.
   */
  chat: boolean;
  /**
   * Schema representing the product, if available. This is useful when
   * the WorkItem represents an input.
   */
  schema?: Schema;
  /**
   * Similar to the `output` of the `ConsoleEntry`, represents the work product
   * of this item.
   *
   * The Map type represents the A2UI update.
   */
  product: Map<string, LLMContent | Particle | SimplifiedA2UIClient>;
};

/**
 * Represents the App state during the run.
 * Designed so that the App View can be built from this state
 */
export type App = {
  /**
   * Current state of the app. Can be one of the following:
   * - "splash" -- the app is showing a splash screen
   * - "output" -- the app is showing the final output
   * - "progress" -- the app is showing progress
   * - "input" - the app is asking the user for inputs
   * - "error" - the app is showing an error
   */
  state: "splash" | "output" | "progress" | "input" | "error";
  /**
   * A sequence of screens that is produced during the run.
   */
  screens: Map<string, AppScreen>;
  /**
   * Currently interactive screens
   */
  current: ReadonlyMap<string, AppScreen>;
  /**
   * The last screen.
   */
  last: AppScreen | null;
};

/**
 * Represents the state of a single App Screen
 */
export type AppScreen = {
  /**
   * The title of the screen
   */
  title: string;
  /**
   * When "interactive", indicates that this screen is still being created
   * or is asking user for input.
   * When "complete", indicates that this screen is finalized and is now
   * a historical artifact of the run.
   */
  status: "interactive" | "complete";
  /**
   * The "progress" screen only shows the output to the user, either final
   * or intermediate results.
   * The "input" screen shows the output to the user and requests input
   * from the user.
   * See https://github.com/breadboard-ai/breadboard/wiki/Screens for details.
   */
  type: "progress" | "input";
  /**
   * The outputs for this screen
   */
  outputs: Map<string, AppScreenOutput>;
  /**
   * The last output for the screen
   */
  last: AppScreenOutput | null;
};

/**
 * Represents an output on a screen. There may be more than one output,
 * like multiple bubbling outputs from the step, as well as the final output.
 */
export type AppScreenOutput = {
  /**
   * The Schema of the output values.
   */
  schema: Schema | undefined;
  /**
   * The output values.
   */
  output: OutputValues;
};
