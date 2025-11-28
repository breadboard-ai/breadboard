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

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { StateManager } from "./state.js";
import { Shell } from "./shell.js";
import {
  Outcome,
  RunConfig,
  RuntimeFlagManager,
  ConsentManager,
  BoardServer,
  MutableGraphStore,
  GraphLoader,
} from "@breadboard-ai/types";
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
import { createGoogleDriveBoardServer } from "@breadboard-ai/shared-ui/utils/create-server.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

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
    kits: Kit[];
    autonamer: Autonamer;
    servers: BoardServer[];
    config: RuntimeConfig;
    graphStore: MutableGraphStore;
    loader: GraphLoader;
  }) {
    super();

    const {
      shell,
      router,
      board,
      servers,
      loader,
      kits,
      graphStore,
      autonamer,
      config: {
        fetchWithCreds,
        flags,
        consentManager,
        settings,
        mcpClientManager,
        sandbox,
      },
    } = config;

    const state = new StateManager(
      this,
      graphStore,
      fetchWithCreds,
      servers.at(0) as GoogleDriveBoardServer,
      flags,
      mcpClientManager
    );

    const edit = new Edit(
      state,
      loader,
      kits,
      sandbox,
      graphStore,
      autonamer,
      flags,
      settings
    );

    this.shell = shell;
    this.util = Util;
    this.select = new Select();
    this.router = router;
    this.board = board;
    this.state = state;

    this.edit = edit;
    this.run = new Run(graphStore, state, flags, edit);

    this.kits = kits;
    this.autonamer = autonamer;
    this.flags = flags;
    this.fetchWithCreds = fetchWithCreds;
    this.consentManager = consentManager;

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
      fetchWithCreds: this.fetchWithCreds,
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
  const servers: BoardServer[] = [
    createGoogleDriveBoardServer(
      config.signinAdapter,
      config.googleDriveClient
    ),
  ];

  const a2Server = config.builtInBoardServers.at(0);
  if (!a2Server) {
    throw new Error("Mis-configuration: A2 embedded server is not present");
  }

  // Add board servers that are built into
  servers.push(a2Server);

  const loader = createLoader(servers);
  const graphStoreArgs = {
    kits,
    loader,
    sandbox: config.sandbox,
    fileSystem: config.fileSystem,
  };
  const graphStore = createGraphStore(graphStoreArgs);

  for (const [, item] of a2Server.userGraphs?.entries() || []) {
    graphStore.addByURL(item.url, [], {});
  }

  const boardServers: RuntimeConfigBoardServers = {
    servers,
    loader,
    graphStore,
    builtInBoardServers: config.builtInBoardServers,
  };

  const autonamer = new Autonamer(
    graphStoreArgs,
    config.fileSystem,
    config.sandbox
  );

  const recentBoards = await config.recentBoardStore.restore();
  const shell = new Shell(config.appName, config.appSubName);

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
    autonamer,
    servers,
    graphStore,
    kits,
    shell,
    config,
    loader,
  });
}
