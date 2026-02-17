/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPlanRunner } from "../../engine/runtime/harness/index.js";
import type { HarnessRunner, RunConfig } from "@breadboard-ai/types";

/**
 * Result of createRunner - the harness runner and abort controller.
 */
export interface CreateRunnerResult {
  runner: HarnessRunner;
  abortController: AbortController;
}

/**
 * SCA Run Service - handles runner creation.
 *
 * This service is responsible for creating HarnessRunner instances.
 * It does not hold state - state is owned by RunController.
 * The action layer coordinates between this service and the controller.
 *
 * @example
 * ```typescript
 * // In RunActions.prepare():
 * const { runner, abortController } = runService.createRunner(config);
 * runController.setRunner(runner, abortController);
 * ```
 */
export class RunService {
  /**
   * Creates a new HarnessRunner and AbortController.
   *
   * The config should already have signal and graphStore set.
   * The caller (action) is responsible for setting the runner on the controller.
   *
   * @param config The run configuration
   * @returns The created runner and abort controller
   */
  createRunner(config: RunConfig): CreateRunnerResult {
    const abortController = new AbortController();

    // Merge the abort signal into the config
    const configWithSignal: RunConfig = {
      ...config,
      signal: abortController.signal,
    };

    const runner = createPlanRunner(configWithSignal);

    return {
      runner,
      abortController,
    };
  }
}
