/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessConfig } from "./types.js";
import { HostRuntime, RunResult } from "../worker/host-runtime.js";
import { asyncGen } from "../utils/async-gen.js";

export class WorkerHarness extends HostRuntime {
  #config: HarnessConfig;

  constructor(config: HarnessConfig) {
    super(config);
    this.#config = config;
  }

  override async *run(url: string) {
    yield* asyncGen<RunResult>(async (next) => {
      for await (const result of super.run(url)) {
        await next(result);
      }
    });
  }
}
