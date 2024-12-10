/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addSandboxedRunModule,
  asRuntimeKit,
  createGraphStore,
  createLoader,
  Kit,
} from "@google-labs/breadboard";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { Util } from "./util.js";
import { RuntimeConfig } from "./types.js";

import {
  createDefaultLocalBoardServer,
  getBoardServers,
  migrateIDBGraphProviders,
  migrateRemoteGraphProviders,
  migrateExampleGraphProviders,
  migrateFileSystemProviders,
  legacyGraphProviderExists,
} from "@breadboard-ai/board-server-management";

import { loadKits } from "../utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import BuildExampleKit from "../build-example-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { sandbox } from "../sandbox";
import { Select } from "./select.js";

function withRunModule(kits: Kit[]): Kit[] {
  return addSandboxedRunModule(sandbox, kits);
}

export async function create(config: RuntimeConfig): Promise<{
  board: Board;
  run: Run;
  edit: Edit;
  kits: Kit[];
  select: Select;
  util: typeof Util;
}> {
  const kits = withRunModule(
    await loadKits([
      asRuntimeKit(GeminiKit),
      asRuntimeKit(BuildExampleKit),
      asRuntimeKit(PythonWasmKit),
    ])
  );

  const skipPlaygroundExamples = import.meta.env.MODE !== "development";
  let servers = await getBoardServers(
    config.tokenVendor,
    skipPlaygroundExamples
  );

  // First run - set everything up.
  if (servers.length === 0) {
    await createDefaultLocalBoardServer();

    // Migrate any legacy data. We do this in order so that IDB doesn't get
    // into a bad state with races and the like.
    if (await legacyGraphProviderExists()) {
      await migrateIDBGraphProviders();
      await migrateRemoteGraphProviders();
      await migrateExampleGraphProviders();
      await migrateFileSystemProviders();
    }

    servers = await getBoardServers();
  }

  const loader = createLoader(servers);
  const graphStore = createGraphStore({
    kits,
    loader,
    sandbox: config.sandbox,
  });

  servers.forEach((server) => {
    server.ready().then(() => {
      server.kits.forEach((kit) => {
        graphStore.registerKit(kit, []);
      });
    });
  });

  const boardServers = {
    servers,
    loader,
    graphStore,
  };

  const runtime = {
    board: new Board([], loader, kits, boardServers, config.tokenVendor),
    edit: new Edit([], loader, kits, config.sandbox, graphStore),
    run: new Run(graphStore, config.dataStore, config.runStore),
    select: new Select(),
    util: Util,
    kits,
  } as const;

  return runtime;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
