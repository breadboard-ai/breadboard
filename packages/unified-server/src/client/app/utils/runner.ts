/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { sandbox } from "../sandbox";
import { createRunner, RunConfig } from "@google-labs/breadboard/harness";
import {
  createDefaultDataStore,
  createGraphStore,
  createRunObserver,
} from "@google-labs/breadboard";

import { getRunStore } from "@breadboard-ai/data-store";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import { Runner } from "../types/types";

export async function createFlowRunner(
  config: RunConfig | null
): Promise<Runner | null> {
  if (!config) {
    return null;
  }

  const graphStore = createGraphStore({
    kits: config.kits,
    loader: config.loader!,
    sandbox,
  });
  const runStore = getRunStore();
  const dataStore = createDefaultDataStore();
  const abortController = new AbortController();

  config = {
    ...config,
    store: dataStore,
    kits: [...graphStore.kits], ///...tab.boardServerKits],
    signal: abortController.signal,
    graphStore: graphStore,
  };

  const harnessRunner = createRunner(config);
  const runObserver = createRunObserver(graphStore, {
    logLevel: "debug",
    dataStore: dataStore,
    runStore: runStore,
    kits: config.kits,
    sandbox: sandbox,
  });

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
  };
}
