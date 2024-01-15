/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LocalHarness } from "./local-harness.js";
import { HarnessConfig } from "./types.js";
import { runInWorker } from "./worker-harness.js";

export const run = (config: HarnessConfig) => {
  if (!config.remote) {
    return new LocalHarness(config).run();
  }
  if (config.remote.type === "worker") {
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    return runInWorker(workerURL, config);
  }
  throw new Error(`Unsupported harness configuration: ${config}`);
};
