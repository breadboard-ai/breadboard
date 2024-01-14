/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Harness, HarnessConfig } from "./types.js";
import { LocalHarness } from "./local-harness.js";
import { WorkerHarness } from "./worker-harness.js";

export type * from "./types.js";

export { serve, defineServeConfig } from "./serve.js";
export type * from "./serve.js";

export { createWorker } from "./worker-harness.js";
export { createSecretAskingKit } from "./secrets.js";

export const createHarness = (config: HarnessConfig): Harness => {
  if (!config.remote) {
    return new LocalHarness(config);
  }
  if (config.remote.type === "worker") {
    return new WorkerHarness(config);
  }
  throw new Error(`Unsupported harness configuration: ${config}`);
};
