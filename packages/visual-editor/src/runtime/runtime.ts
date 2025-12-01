/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { createGraphStore, createLoader, err } from "@google-labs/breadboard";
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
import { Outcome, RunConfig, RuntimeFlagManager } from "@breadboard-ai/types";
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
import { createA2Server, createA2ModuleFactory } from "@breadboard-ai/a2";
import {
  createFileSystemBackend,
  createFlagManager,
} from "@breadboard-ai/data-store";
import {
  addRunModule,
  composeFileSystemBackends,
  createEphemeralBlobStore,
  createFileSystem,
  PersistentBackend,
} from "@google-labs/breadboard";
import { RecentBoardStore } from "../data/recent-boards";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { McpClientManager } from "@breadboard-ai/mcp";
import {
  ConsentAction,
  ConsentUIType,
  ConsentRequest,
  FileSystem,
} from "@breadboard-ai/types";
import { ConsentManager } from "@breadboard-ai/shared-ui/utils/consent-manager.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { createActionTrackerBackend } from "@breadboard-ai/shared-ui/utils/action-tracker";
import { envFromSettings } from "../utils/env-from-settings";
import { builtInMcpClients } from "../mcp-clients";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

export class Runtime extends EventTarget {
  public readonly shell: Shell;
  public readonly router: Router;
  public readonly board: Board;
  public readonly run: Run;
  public readonly edit: Edit;
  public readonly select: Select;
  public readonly state: StateManager;
  public readonly flags: RuntimeFlagManager;
  public readonly util: typeof Util;
  public readonly fetchWithCreds: typeof globalThis.fetch;
  public readonly consentManager: ConsentManager;
  public readonly signinAdapter: SigninAdapter;
  public readonly googleDriveClient: GoogleDriveClient;
  public readonly fileSystem: FileSystem;
  public readonly mcpClientManager: McpClientManager;
  public readonly recentBoardStore: RecentBoardStore;
  public readonly googleDriveBoardServer: GoogleDriveBoardServer;

  constructor(config: RuntimeConfig) {
    super();

    this.flags = createFlagManager(config.globalConfig.flags);

    this.signinAdapter = new SigninAdapter(
      config.shellHost,
      config.initialSignInState
    );
    this.fetchWithCreds = this.signinAdapter.fetchWithCreds;

    const proxyApiBaseUrl = new URL("/api/drive-proxy/", window.location.href)
      .href;
    const apiBaseUrl =
      this.signinAdapter.state === "signedout"
        ? proxyApiBaseUrl
        : config.globalConfig.GOOGLE_DRIVE_API_ENDPOINT ||
          "https://www.googleapis.com";

    this.googleDriveClient = new GoogleDriveClient({
      apiBaseUrl,
      proxyApiBaseUrl,
      fetchWithCreds: this.fetchWithCreds,
    });

    this.fileSystem = createFileSystem({
      env: [...envFromSettings(config.settings), ...(config.env || [])],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(
        new Map<string, PersistentBackend>([
          ["track", createActionTrackerBackend()],
        ])
      ),
    });

    let backendApiEndpoint = config.globalConfig.BACKEND_API_ENDPOINT;
    if (!backendApiEndpoint) {
      console.warn(`No BACKEND_API_ENDPOINT in ClientDeploymentConfiguration`);
      backendApiEndpoint = window.location.href;
    }

    this.mcpClientManager = new McpClientManager(
      builtInMcpClients,
      {
        fileSystem: this.fileSystem,
        fetchWithCreds: this.fetchWithCreds,
      },
      backendApiEndpoint
    );

    const sandbox = createA2ModuleFactory({
      mcpClientManager: this.mcpClientManager,
      fetchWithCreds: this.fetchWithCreds,
    });

    const kits = addRunModule(sandbox, []);

    this.consentManager = new ConsentManager(
      async (request: ConsentRequest, uiType: ConsentUIType) => {
        return new Promise<ConsentAction>((resolve) => {
          if (uiType === ConsentUIType.MODAL) {
            const uiState = this.state.ui;
            uiState.consentRequests.push({
              request,
              consentCallback: resolve,
            });
          } else {
            const appState = this.state.project?.run.app;
            if (appState) {
              appState.consentRequests.push({
                request,
                consentCallback: resolve,
              });
            } else {
              console.warn(
                "In-app consent requested when no app state existed"
              );
              resolve(ConsentAction.DENY);
            }
          }
        });
      }
    );

    this.recentBoardStore = RecentBoardStore.instance();

    this.googleDriveBoardServer = createGoogleDriveBoardServer(
      this.signinAdapter,
      this.googleDriveClient
    );
    const a2Server = createA2Server();

    const loader = createLoader([this.googleDriveBoardServer, a2Server]);
    const graphStoreArgs = {
      kits,
      loader,
      sandbox,
      fileSystem: this.fileSystem,
      flags: this.flags,
    };
    const graphStore = createGraphStore(graphStoreArgs);

    for (const [, item] of a2Server.userGraphs?.entries() || []) {
      graphStore.addByURL(item.url, [], {});
    }

    const boardServers: RuntimeConfigBoardServers = {
      a2Server,
      googleDriveBoardServer: this.googleDriveBoardServer,
    };

    const autonamer = new Autonamer(graphStoreArgs, this.fileSystem, sandbox);

    const { settings, appName, appSubName } = config;

    const state = new StateManager(this, graphStore);

    const edit = new Edit(
      state,
      loader,
      kits,
      sandbox,
      graphStore,
      autonamer,
      this.flags,
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
      this.recentBoardStore,
      this.signinAdapter,
      this.googleDriveClient
    );
    this.state = state;

    this.edit = edit;
    this.run = new Run(graphStore, state, this.flags, edit);

    this.#setupPassthruHandlers();
    void this.recentBoardStore.restore();
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
        return this.state.project?.run;
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