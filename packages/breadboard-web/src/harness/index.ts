/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Harness, HarnessConfig } from "./types";
import { LocalHarness } from "./local-harness";
import { WorkerHarness } from "./worker-harness";

export const createHarness = (config: HarnessConfig): Harness => {
  if (!config.remote) {
    return new LocalHarness(config);
  }
  if (config.remote.type === "worker") {
    return new WorkerHarness(config);
  }
  throw new Error(`Unsupported harness configuration: ${config}`);
};
