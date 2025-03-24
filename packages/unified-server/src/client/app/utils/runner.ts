/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { sandbox } from "../sandbox";
import { createRunner, RunConfig } from "@google-labs/breadboard/harness";
import {
  addSandboxedRunModule,
  assetsFromGraphDescriptor,
  createEphemeralBlobStore,
  createFileSystem,
  createGraphStore,
  createRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { BoardServerAwareDataStore } from "@breadboard-ai/board-server-management";
import {
  createFileSystemBackend,
  getDataStore,
  getRunStore,
} from "@breadboard-ai/data-store";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import { Runner } from "../types/types";
import { loadKits, registerLegacyKits } from "./kit-loader.js";
import { TokenVendor } from "@breadboard-ai/connection-client";
import { RemoteBoardServer } from "@breadboard-ai/remote-board-server";

function withRunModule(kits: Kit[]): Kit[] {
  return addSandboxedRunModule(sandbox, kits);
}

export async function createFlowRunner(
  config: RunConfig | null,
  boardServerUrl: URL,
  tokenVendor: TokenVendor
): Promise<Runner | null> {
  if (!config) {
    return null;
  }

  const boardServer = await RemoteBoardServer.from(
    boardServerUrl.href,
    "Board Server",
    { username: "", apiKey: "", secrets: new Map() },
    tokenVendor
  );
  if (!boardServer) return null;

  const servers = [boardServer];

  // await boardServer.ready();

  const kits = withRunModule(loadKits());
  const graphStore = createGraphStore({
    kits,
    loader: config.loader!,
    sandbox,
  });
  registerLegacyKits(graphStore);

  const runStore = getRunStore();
  const dataStore = new BoardServerAwareDataStore(getDataStore(), servers);
  const abortController = new AbortController();
  const fileSystem = createFileSystem({
    local: createFileSystemBackend(createEphemeralBlobStore()),
  });

  const graph = config.runner!;

  config = {
    ...config,
    store: dataStore,
    kits: [...graphStore.kits],
    signal: abortController.signal,
    graphStore: graphStore,
    fileSystem: fileSystem.createRunFileSystem({
      graphUrl: graph.url!,
      env: [],
      assets: assetsFromGraphDescriptor(graph),
    }),
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
    runStore,
  };
}
