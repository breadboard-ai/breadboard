/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunner, RunConfig } from "@breadboard-ai/types";
import { LocalRunner } from "./local-runner.js";
import { RemoteRunner } from "./remote-runner.js";
export { RunnerErrorEvent } from "./events.js";

export { run } from "./run.js";

export const createRunner = (config: RunConfig): HarnessRunner => {
  if (config.remote) {
    return new RemoteRunner(config);
  }
  return new LocalRunner(config);
};
