/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
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
import { Shell } from "./shell.js";
import { RuntimeFlagManager } from "@breadboard-ai/types";
import {
  RuntimeShareDialogRequestedEvent,
  RuntimeSnackbarEvent,
  RuntimeToastEvent,
  RuntimeUnsnackbarEvent,
} from "./events.js";

export class Runtime extends EventTarget {
  public readonly shell: Shell;
  public readonly router: Router;
  public readonly board: Board;
  public readonly run: Run;
  public readonly edit: Edit;
  public readonly kits: Kit[];
  public readonly select: Select;
  public readonly sideboards: SideBoardRuntime;
  public readonly state: StateManager;
  public readonly flags: RuntimeFlagManager;
  public readonly util: typeof Util;

  constructor(config: {
    shell: Shell;
    router: Router;
    board: Board;
    run: Run;
    edit: Edit;
    kits: Kit[];
    select: Select;
    sideboards: SideBoardRuntime;
    state: StateManager;
    flags: RuntimeFlagManager;
    util: typeof Util;
  }) {
    super();

    this.shell = config.shell;
    this.router = config.router;
    this.board = config.board;
    this.run = config.run;
    this.edit = config.edit;
    this.kits = config.kits;
    this.select = config.select;
    this.sideboards = config.sideboards;
    this.state = config.state;
    this.flags = config.flags;
    this.util = config.util;

    this.#setupPassthruHandlers();
  }

  snackbar(
    snackbarId: ReturnType<typeof globalThis.crypto.randomUUID>,
    message: string,
    type: BreadboardUI.Types.SnackType,
    actions: BreadboardUI.Types.SnackbarAction[],
    persistent: boolean,
    replaceAll: boolean
  ) {
    this.dispatchEvent(
      new RuntimeSnackbarEvent(
        snackbarId,
        message,
        type,
        actions,
        persistent,
        replaceAll
      )
    );
  }

  unsnackbar() {
    this.dispatchEvent(new RuntimeUnsnackbarEvent());
  }

  #setupPassthruHandlers() {
    const cancelClone = (
      evt:
        | RuntimeShareDialogRequestedEvent
        | RuntimeToastEvent
        | RuntimeSnackbarEvent
        | RuntimeUnsnackbarEvent
    ) => {
      evt.stopPropagation();
      evt.preventDefault();
      return evt.clone();
    };

    this.edit.addEventListener(
      RuntimeShareDialogRequestedEvent.eventName,
      (evt: RuntimeShareDialogRequestedEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.board.addEventListener(
      RuntimeToastEvent.eventName,
      (evt: RuntimeToastEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.board.addEventListener(
      RuntimeSnackbarEvent.eventName,
      (evt: RuntimeSnackbarEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );

    this.board.addEventListener(
      RuntimeUnsnackbarEvent.eventName,
      (evt: RuntimeUnsnackbarEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );
  }
}

export async function create(config: RuntimeConfig): Promise<Runtime> {
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

  const recentBoards = await config.recentBoardStore.restore();

  const state = new StateManager(graphStore, sideboards, servers);

  const flags = config.flags;

  return new Runtime({
    router: new Router(),
    board: new Board(
      [],
      loader,
      kits,
      boardServers,
      config.recentBoardStore,
      recentBoards,
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
    run: new Run(graphStore, dataStore, config.runStore, state, flags),
    state,
    sideboards,
    select: new Select(),
    util: Util,
    kits,
    shell: new Shell(config.appName, config.appSubName),
    flags,
  });
}
