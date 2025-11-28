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
import { createA2Server } from "@breadboard-ai/a2";

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

  constructor(config: RuntimeConfig) {
    super();

    const kits = config.kits;

    const googleDriveBoardServer = createGoogleDriveBoardServer(
      config.signinAdapter,
      config.googleDriveClient
    );
    const a2Server = createA2Server();

    const loader = createLoader([googleDriveBoardServer, a2Server]);
    const graphStoreArgs = {
      kits,
      loader,
      sandbox: config.sandbox,
      fileSystem: config.fileSystem,
      flags: config.flags,
    };
    const graphStore = createGraphStore(graphStoreArgs);

    for (const [, item] of a2Server.userGraphs?.entries() || []) {
      graphStore.addByURL(item.url, [], {});
    }

    const boardServers: RuntimeConfigBoardServers = {
      a2Server,
      googleDriveBoardServer,
    };

    const autonamer = new Autonamer(
      graphStoreArgs,
      config.fileSystem,
      config.sandbox
    );

    const {
      fetchWithCreds,
      flags,
      consentManager,
      settings,
      mcpClientManager,
      sandbox,
      appName,
      appSubName,
    } = config;

    const state = new StateManager(
      this,
      graphStore,
      fetchWithCreds,
      googleDriveBoardServer,
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

    this.shell = new Shell(appName, appSubName);
    this.util = Util;
    this.select = new Select();
    this.router = new Router();
    this.board = new Board(
      loader,
      graphStore,
      kits,
      boardServers,
      config.recentBoardStore,
      config.signinAdapter,
      config.googleDriveClient
    );
    this.state = state;

    this.edit = edit;
    this.run = new Run(graphStore, state, flags, edit);

    this.kits = kits;
    this.autonamer = autonamer;
    this.flags = flags;
    this.fetchWithCreds = fetchWithCreds;
    this.consentManager = consentManager;

    this.#setupPassthruHandlers();
    void config.recentBoardStore.restore();
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
      loader: this.board.loader,
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