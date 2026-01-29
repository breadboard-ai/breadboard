/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunner } from "@breadboard-ai/types";
import { STATUS } from "../../../../ui/types/types.js";
import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";

/**
 * Re-export STATUS for consumers that need it.
 */
export { STATUS };

/**
 * Controller for run lifecycle and status.
 */
export class RunController extends RootController {
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

  constructor(controllerId: string, persistenceId: string) {
    super(controllerId, persistenceId);
  }

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
}
