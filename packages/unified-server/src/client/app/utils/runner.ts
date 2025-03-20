/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { sandbox } from "../sandbox";
import { createRunner, RunConfig } from "@google-labs/breadboard/harness";
import {
  addSandboxedRunModule,
  createDefaultDataStore,
  createGraphStore,
  createRunObserver,
  Kit,
} from "@google-labs/breadboard";

import { getRunStore } from "@breadboard-ai/data-store";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import { RunState } from "@breadboard-ai/shared-ui/utils/run-state.ts";
import { Runner } from "../types/types";
import { loadKits, registerLegacyKits } from "./kit-loader.js";

function withRunModule(kits: Kit[]): Kit[] {
  return addSandboxedRunModule(sandbox, kits);
}

export async function createFlowRunner(
  config: RunConfig | null
): Promise<Runner | null> {
  if (!config) {
    return null;
  }

  const kits = withRunModule(loadKits());
  const graphStore = createGraphStore({
    kits,
    loader: config.loader!,
    sandbox,
  });
  registerLegacyKits(graphStore);

  const runStore = getRunStore();
  const dataStore = createDefaultDataStore();
  const abortController = new AbortController();

  config = {
    ...config,
    store: dataStore,
    kits: [...graphStore.kits],
    signal: abortController.signal,
    graphStore: graphStore,
  };

  const harnessRunner = createRunner(config);
  const runState = RunState. 
  const runObserver = createRunObserver(graphStore, {
    logLevel: "debug",
    dataStore: dataStore,
    runStore: runStore,
    kits: config.kits,
    sandbox: sandbox,
  });

  // const runState = new RunState(graphStore, {
  //   kits: config.kits,
  //   dataStore,
  //   runStore,
  //   sandbox,
  // });
  // console.log(runState); // DO NOT SUBMIT.

  const topGraphObserver = new TopGraphObserver(
    harnessRunner,
    config.signal,
    runObserver
  );

  harnessRunner.addObserver(runObserver);

  return {
    harnessRunner,
    topGraphObserver,
    runObserver,
    abortController,
    kits: config.kits,
    runStore,
  };
}
