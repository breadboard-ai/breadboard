/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConsoleEntry,
  HarnessRunner,
  NodeIdentifier,
  RunError,
  Schema,
} from "@breadboard-ai/types";
import { STATUS } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import { SignalMap } from "signal-utils/map";
import { SignalSet } from "signal-utils/set";

/**
 * Re-export STATUS for consumers that need it.
 */
export { STATUS };

/**
 * Represents user input request.
 */
export type UserInput = {
  id: NodeIdentifier;
  schema: Schema;
};

/**
 * Status for an individual step in the step list.
 */
export type StepStatus =
  | "loading"
  | "working"
  | "ready"
  | "complete"
  | "pending";

/**
 * State for a step in the step list view.
 */
export interface StepListStepState {
  icon?: string;
  title: string;
  status: StepStatus;
  prompt: string;
  label: string;
  tags?: string[];
}

/**
 * Controller for run lifecycle, status, and output state.
 *
 * This controller owns all state related to a single run of the board:
 * - Lifecycle: status, runner, abort controller
 * - Output: console entries, input requests, errors
 *
 * Note: This controller does NOT store the graph itself. Node metadata lookups
 * are performed by Triggers that have access to Services (graphStore), keeping
 * the Controller decoupled from Services.
 */
export class RunController extends RootController {
  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Current run status.
   * Tracks whether the board is stopped, running, or paused.
   */
  @field()
  private accessor _status: STATUS = STATUS.STOPPED;

  /**
   * The current HarnessRunner.
   * Set by actions when preparing a run.
   */
  @field({ deep: false })
  accessor runner: HarnessRunner | null = null;

  /**
   * The AbortController for the current run.
   * Used to stop the run. Not reactive as it's used imperatively.
   */
  accessor abortController: AbortController | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Console entries representing the run's output.
   * Populated by OutputTrigger listening to runner events.
   */
  @field({ deep: true })
  private accessor _console: Map<string, ConsoleEntry> = new SignalMap();

  /**
   * Current input request the run is waiting for.
   * Set when the runner pauses for user input.
   */
  @field()
  private accessor _input: UserInput | null = null;

  /**
   * Fatal error from the run (if any).
   * Non-fatal node errors are tracked separately.
   */
  @field()
  private accessor _error: RunError | null = null;

  /**
   * Node IDs whose errors the user has dismissed.
   */
  @field({ deep: true })
  private accessor _dismissedErrors: Set<NodeIdentifier> = new SignalSet();

  /**
   * Estimated total entries for progress calculation.
   * Initially based on node count, updated as run progresses.
   */
  @field()
  private accessor _estimatedEntryCount: number = 0;

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the current run status.
   */
  get status(): STATUS {
    return this._status;
  }

  /**
   * Updates the run status.
   * This is called in response to run lifecycle events.
   *
   * @param status The new run status
   */
  setStatus(status: STATUS): void {
    this._status = status;
  }

  /**
   * Sets the runner and abort controller.
   * Called by RunActions.prepare() after creating the runner.
   *
   * @param runner The HarnessRunner
   * @param abortController The AbortController for this run
   */
  setRunner(runner: HarnessRunner, abortController: AbortController): void {
    this.runner = runner;
    this.abortController = abortController;
  }

  /**
   * Clears the runner and abort controller.
   */
  clearRunner(): void {
    this.runner = null;
    this.abortController = null;
  }

  /**
   * Starts the current run.
   *
   * @throws Error if no runner is set (programming error)
   */
  start(): void {
    if (!this.runner) {
      throw new Error("start() called without an active runner");
    }
    this.runner.start();
    // Note: Status will be updated by the trigger listening to runner events
  }

  /**
   * Stops the current run by aborting it.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this._status = STATUS.STOPPED;
  }

  /**
   * Resets the run status to stopped and clears runner.
   */
  reset(): void {
    this._status = STATUS.STOPPED;
    this.clearRunner();
  }

  /**
   * Checks if the board is currently running.
   */
  get isRunning(): boolean {
    return this._status === STATUS.RUNNING;
  }

  /**
   * Checks if the board is currently paused.
   */
  get isPaused(): boolean {
    return this._status === STATUS.PAUSED;
  }

  /**
   * Checks if the board is stopped (idle).
   */
  get isStopped(): boolean {
    return this._status === STATUS.STOPPED;
  }

  /**
   * Checks if there's an active runner.
   */
  get hasRunner(): boolean {
    return this.runner !== null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gets the console entries map.
   */
  get console(): Map<string, ConsoleEntry> {
    return this._console;
  }

  /**
   * Adds or updates a console entry.
   *
   * @param id The node identifier
   * @param entry The console entry (with resolved metadata)
   */
  setConsoleEntry(id: string, entry: ConsoleEntry): void {
    this._console.set(id, entry);
  }

  /**
   * Gets the current input request (if any).
   */
  get input(): UserInput | null {
    return this._input;
  }

  /**
   * Sets the current input request.
   * Called when the runner pauses waiting for user input.
   *
   * @param input The input request with node ID and schema
   */
  setInput(input: UserInput): void {
    this._input = input;
  }

  /**
   * Clears the current input request.
   * Called when input is provided or run is cancelled.
   */
  clearInput(): void {
    this._input = null;
  }

  /**
   * Gets the fatal error (if any).
   */
  get error(): RunError | null {
    return this._error;
  }

  /**
   * Sets the fatal error.
   *
   * @param error The error from the run
   */
  setError(error: RunError): void {
    this._error = error;
  }

  /**
   * Dismisses the current error.
   * If a nodeId is provided, adds it to dismissed set.
   *
   * @param nodeId Optional node ID to track as dismissed
   */
  dismissError(nodeId?: NodeIdentifier): void {
    if (nodeId) {
      this._dismissedErrors.add(nodeId);
    }
    this._error = null;
  }

  /**
   * Gets the set of dismissed error node IDs.
   */
  get dismissedErrors(): Set<NodeIdentifier> {
    return this._dismissedErrors;
  }

  /**
   * Gets the estimated entry count for progress calculation.
   * Returns the larger of the estimate and actual console size.
   */
  get estimatedEntryCount(): number {
    return Math.max(this._estimatedEntryCount, this._console.size);
  }

  /**
   * Sets the estimated entry count.
   * Typically set at run start based on graph node count.
   *
   * @param count The estimated number of entries
   */
  setEstimatedEntryCount(count: number): void {
    this._estimatedEntryCount = count;
  }

  /**
   * Resets all output state for a new run.
   * Clears console, input, errors, and estimate.
   */
  resetOutput(): void {
    this._console.clear();
    this._input = null;
    this._error = null;
    this._dismissedErrors.clear();
    this._estimatedEntryCount = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Progress as a number between 0 and 1.
   * Based on console entries vs estimated total.
   */
  get progress(): number {
    if (this.estimatedEntryCount === 0) return 0;
    return this._console.size / this.estimatedEntryCount;
  }

  /**
   * Console state: "start" if empty, "entries" otherwise.
   */
  get consoleState(): "start" | "entries" {
    return this._console.size > 0 ? "entries" : "start";
  }
}
