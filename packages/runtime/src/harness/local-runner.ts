/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunResult } from "@breadboard-ai/types";
import { AbstractRunner } from "./abstract-runner.js";
import { run } from "./run.js";

export { LocalRunner };

class LocalRunner extends AbstractRunner {
  protected async *getGenerator(): AsyncGenerator<
    HarnessRunResult,
    void,
    unknown
  > {
    yield* run(this.config);
  }
}
