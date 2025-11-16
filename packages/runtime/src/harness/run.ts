/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, RunConfig } from "@breadboard-ai/types";
import { runLocally } from "./local.js";
import { asyncGen } from "@breadboard-ai/utils";

export { run };

async function* run(config: RunConfig) {
  yield* asyncGen<HarnessRunResult>(async (next) => {
    for await (const data of runLocally(config, config.kits)) {
      await next(data);
    }
  });
}
