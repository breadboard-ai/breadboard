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
  Kit,
} from "@google-labs/breadboard";

import { getRunStore } from "@breadboard-ai/data-store";
import { RunState } from "@breadboard-ai/shared-ui/utils/run-state";
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
  const runState = RunState.create(graphStore, config, harnessRunner);
  harnessRunner.addObserver(runState);

  return {
    harnessRunner,
    graphObserver: runState.demandGraphObserverFromHarness(),
    runObserver: runState,
    abortController,
    kits: config.kits,
    runStore,
  };
}
