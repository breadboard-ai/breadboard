/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createGraphStore, createLoader, Kit } from "@google-labs/breadboard";
import { Router } from "./router.js";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { Util } from "./util.js";
import { RuntimeConfig, RuntimeConfigBoardServers } from "./types.js";

import {
  createDefaultLocalBoardServer,
  getBoardServers,
  migrateIDBGraphProviders,
  migrateRemoteGraphProviders,
  migrateFileSystemProviders,
  legacyGraphProviderExists,
  BoardServerAwareDataStore,
} from "@breadboard-ai/board-server-management";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { StateManager } from "./state.js";
import { getDataStore } from "@breadboard-ai/data-store";
import { createSideboardRuntimeProvider } from "./sideboard-runtime.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";

export async function create(config: RuntimeConfig): Promise<{
  router: Router;
  board: Board;
  run: Run;
  edit: Edit;
  kits: Kit[];
  select: Select;
  sideboards: SideBoardRuntime;
  state: StateManager;
  util: typeof Util;
}> {
  const kits = config.kits;
  let servers = await getBoardServers(
    config.tokenVendor,
    config.googleDriveClient
  );

  // First run - set everything up.
  if (servers.length === 0) {
    await createDefaultLocalBoardServer();

    // Migrate any legacy data. We do this in order so that IDB doesn't get
    // into a bad state with races and the like.
    if (await legacyGraphProviderExists()) {
      await migrateIDBGraphProviders();
      await migrateRemoteGraphProviders();
      await migrateFileSystemProviders();
    }

    servers = await getBoardServers(
      config.tokenVendor,
      config.googleDriveClient
    );
  }

  // Add board servers that are built into
  servers.push(...config.builtInBoardServers);

  const loader = createLoader(servers);
  const graphStoreArgs = {
    kits,
    loader,
    sandbox: config.sandbox,
    fileSystem: config.fileSystem,
  };
  const graphStore = createGraphStore(graphStoreArgs);

  servers.forEach((server) => {
    server.ready().then(() => {
      server.kits.forEach((kit) => {
        graphStore.registerKit(kit, []);
      });
      if (server.preload) {
        server.preload((item) => {
          graphStore.addByURL(item.url, [], {});
        });
      }
    });
  });

  const boardServers: RuntimeConfigBoardServers = {
    servers,
    loader,
    graphStore,
    builtInBoardServers: config.builtInBoardServers,
  };

  const dataStore = new BoardServerAwareDataStore(
    getDataStore(),
    servers,
    undefined
  );

  const sideboards = createSideboardRuntimeProvider(
    graphStoreArgs,
    servers,
    config
  ).createSideboardRuntime();

  const state = new StateManager(graphStore, sideboards, servers);

  const runtime = {
    router: new Router(),
    board: new Board(
      [],
      loader,
      kits,
      boardServers,
      config.tokenVendor,
      config.googleDriveClient
    ),
    edit: new Edit(
      state,
      loader,
      kits,
      config.sandbox,
      graphStore,
      sideboards,
      config.settings
    ),
    run: new Run(graphStore, dataStore, config.runStore, state),
    state,
    sideboards,
    select: new Select(),
    util: Util,
    kits,
  } as const;

  return runtime;
}

export type RuntimeInstance = Awaited<ReturnType<typeof create>>;
