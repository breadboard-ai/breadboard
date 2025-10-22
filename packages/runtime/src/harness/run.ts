/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, Kit, RunConfig } from "@breadboard-ai/types";
import { runLocally } from "./local.js";
import { configureSecretAsking } from "./secrets.js";
import { asyncGen } from "@breadboard-ai/utils";

export { run, configureKits };

async function configureKits(
  config: RunConfig,
  next: (data: HarnessRunResult) => Promise<void>
): Promise<Kit[]> {
  return configureSecretAsking(config.interactiveSecrets, config.kits, next);
}

async function* run(config: RunConfig) {
  if (!config.remote) {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const kits = await configureKits(config, next);

      for await (const data of runLocally(config, kits)) {
        await next(data);
      }
    });
  } else {
    throw new Error(
      `Unsupported harness configuration: ${JSON.stringify(config, null, 2)}`
    );
  }
}
