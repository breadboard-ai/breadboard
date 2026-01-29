/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { STATUS } from "../../../ui/types/types.js";
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

/**
 * @fileoverview
 *
 * Run Triggers - reacts to runner events to update controller state.
 *
 * The trigger listens to HarnessRunner lifecycle events and updates
 * the RunController status accordingly.
 */

/**
 * Registers listeners on the current runner to update controller status.
 *
 * Call this after setting a runner on the controller via RunActions.prepare().
 * The trigger will listen to start/pause/resume/end/error events and update
 * controller.run.main.status.
 *
 * Note: This must be called after the runner is set on the controller.
 */
export function registerRunStatusListener(): void {
  const { controller } = bind;
  const { runner } = controller.run.main;

  if (!runner) {
    console.warn("registerRunStatusListener called without an active runner");
    return;
  }

  runner.addEventListener("start", () => {
    controller.run.main.setStatus(STATUS.RUNNING);
  });

  runner.addEventListener("resume", () => {
    controller.run.main.setStatus(STATUS.RUNNING);
  });

  runner.addEventListener("pause", () => {
    controller.run.main.setStatus(STATUS.PAUSED);
  });

  runner.addEventListener("end", () => {
    controller.run.main.setStatus(STATUS.STOPPED);
  });

  runner.addEventListener("error", () => {
    controller.run.main.setStatus(STATUS.STOPPED);
  });
}
