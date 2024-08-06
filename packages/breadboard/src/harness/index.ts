/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocalRunner } from "./local-runner.js";
import { HarnessRunner, RunConfig } from "./types.js";

export type * from "./types.js";

export { serve, defineServeConfig } from "./serve.js";
export { run } from "./run.js";

export type * from "./serve.js";
export { type KitConfig } from "./kits.js";

export { createWorker } from "./worker.js";
export { createSecretAskingKit } from "./secrets.js";

export const createRunner = (config: RunConfig): HarnessRunner => {
  return new LocalRunner(config);
};
