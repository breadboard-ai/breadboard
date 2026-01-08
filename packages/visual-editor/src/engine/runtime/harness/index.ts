/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner, RunConfig } from "@breadboard-ai/types";
import { PlanRunner } from "./plan-runner.js";
export { RunnerErrorEvent } from "./events.js";

export function createPlanRunner(config: RunConfig): HarnessRunner {
  return new PlanRunner(config);
}
