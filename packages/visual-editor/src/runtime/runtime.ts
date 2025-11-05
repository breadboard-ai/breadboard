/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  createGraphStore,
  createLoader,
  err,
  Kit,
} from "@google-labs/breadboard";
import { Router } from "./router.js";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { Util } from "./util.js";
import { RuntimeConfig, RuntimeConfigBoardServers, Tab } from "./types.js";

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
import { Shell } from "./shell.js";
import { Outcome, RunConfig, RuntimeFlagManager, ConsentManager } from "@breadboard-ai/types";
import {
  RuntimeHostStatusUpdateEvent,
  RuntimeSnackbarEvent,
  RuntimeToastEvent,
  RuntimeUnsnackbarEvent,
} from "./events.js";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { inputsFromSettings } from "@breadboard-ai/shared-ui/data/inputs.js";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "@breadboard-ai/data";
import { Autonamer } from "./autonamer.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";

export class Runtime extends EventTarget {
  public readonly shell: Shell;
  public readonly router: Router;
  public readonly board: Board;
  public readonly run: Run;
  public readonly edit: Edit;
  public readonly kits: Kit[];
  public readonly select: Select;
  public readonly autonamer: Autonamer;
  public readonly state: StateManager;
  public readonly flags: RuntimeFlagManager;
  public readonly util: typeof Util;
  public readonly fetchWithCreds: typeof globalThis.fetch;
  public readonly consentManager: ConsentManager;

  constructor(config: {
    shell: Shell;
    router: Router;
    board: Board;
    run: Run;
    edit: Edit;
    kits: Kit[];
    select: Select;
    autonamer: Autonamer;
    state: StateManager;
    flags: RuntimeFlagManager;
    util: typeof Util;
    fetchWithCreds: typeof globalThis.fetch;
    consentManager: ConsentManager,
  }) {
    super();

    this.shell = config.shell;
    this.router = config.router;
    this.board = config.board;
    this.run = config.run;
    this.edit = config.edit;
    this.kits = config.kits;
    this.select = config.select;
    this.autonamer = config.autonamer;
    this.state = config.state;
    this.flags = config.flags;
    this.util = config.util;
    this.fetchWithCreds = config.fetchWithCreds;
    this.consentManager = config.consentManager;

    this.#setupPassthruHandlers();
  }

  async prepareRun(tab: Tab, settings: SettingsStore): Promise<Outcome<void>> {
    const url = tab.graph?.url;
    if (!url) {
      return err(`Unable to prepare run: graph does not have a URL`);
    }

    const graph = tab?.graph;
    const runConfig: RunConfig = {
      url,
      runner: graph,
      diagnostics: true,
      kits: [], // The kits are added by the runtime.
      loader: this.board.getLoader(),
      graphStore: this.edit.graphStore,
      fileSystem: this.edit.graphStore.fileSystem.createRunFileSystem({
        graphUrl: url,
        env: envFromGraphDescriptor(
          this.edit.graphStore.fileSystem.env(),
          graph
        ),
        assets: assetsFromGraphDescriptor(graph),
      }),
      inputs: inputsFromSettings(settings),
      interactiveSecrets: true,
      fetchWithCreds: this.fetchWithCreds,
      consentManager: this.consentManager,
      getProjectRunState: () => {
        return this.state.getProjectState(tab.mainGraphId)?.run;
      },
      clientDeploymentConfiguration: CLIENT_DEPLOYMENT_CONFIG,
      flags: this.flags,
    };

    // Let the queued up updates trigger the render before actually preparing
    // the run. This is necessary, because the main graph is being set in
    // `bb-renderer` is actually side-effectey, but we don't have another way
    // to account for this
    // TODO: Remove side effectey graph-setting in `bb-renderer`.
    await Promise.resolve();

    return this.run.prepareRun(tab, runConfig);
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
        | RuntimeToastEvent
        | RuntimeSnackbarEvent
        | RuntimeUnsnackbarEvent
        | RuntimeHostStatusUpdateEvent
    ) => {
      evt.stopPropagation();
      evt.preventDefault();
      return evt.clone();
    };

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

    this.shell.addEventListener(
      RuntimeHostStatusUpdateEvent.eventName,
      (evt: RuntimeHostStatusUpdateEvent) => {
        const newEvt = cancelClone(evt);
        this.dispatchEvent(newEvt);
      }
    );
  }
}

export async function create(config: RuntimeConfig): Promise<Runtime> {
  const kits = config.kits;
  let servers = await getBoardServers(
    config.signinAdapter,
    config.googleDriveClient
  );

  // First run - set everything up.
  if (servers.length === 0) {
    await createDefaultLocalBoardServer();

    // Migrate any legacy data. We do this in order so that IDB doesn't get
    // into a bad state with races and the like.
    if (await legacyGraphProviderExists()) {
      await migrateIDBGraphProviders(config.signinAdapter);
      await migrateRemoteGraphProviders();
      await migrateFileSystemProviders();
    }

    servers = await getBoardServers(
      config.signinAdapter,
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

  const autonamer = new Autonamer(
    graphStoreArgs,
    config.fileSystem,
    config.sandbox
  );

  const recentBoards = await config.recentBoardStore.restore();
  const flags = config.flags;

  const state = new StateManager(
    graphStore,
    config.fetchWithCreds,
    servers,
    flags,
    config.mcpClientManager
  );
  const shell = new Shell(config.appName, config.appSubName);

  const edit = new Edit(
    state,
    loader,
    kits,
    config.sandbox,
    graphStore,
    autonamer,
    config.settings
  );

  return new Runtime({
    router: new Router(),
    board: new Board(
      [],
      loader,
      kits,
      boardServers,
      config.recentBoardStore,
      recentBoards,
      config.signinAdapter,
      config.googleDriveClient
    ),
    edit,
    run: new Run(graphStore, dataStore, state, flags, edit),
    state,
    autonamer,
    select: new Select(),
    util: Util,
    kits,
    shell,
    flags,
    fetchWithCreds: config.fetchWithCreds,
    consentManager: config.consentManager,
  });
}
