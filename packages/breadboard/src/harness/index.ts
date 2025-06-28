/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocalRunner } from "./local-runner.js";
import { RemoteRunner } from "./remote-runner.js";
import { HarnessRunner, RunConfig } from "./types.js";
export { RunnerErrorEvent } from "./events.js";

export type * from "./types.js";

export { run } from "./run.js";

export { createSecretAskingKit } from "./secrets.js";

export const createRunner = (config: RunConfig): HarnessRunner => {
  if (config.remote) {
    return new RemoteRunner(config);
  }
  return new LocalRunner(config);
};
