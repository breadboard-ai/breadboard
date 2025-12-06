/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type * as BreadboardUI from "../ui/index.js";
import { Router } from "./router.js";
import { Board } from "./board.js";
import { Run } from "./run.js";
import { Edit } from "./edit.js";
import { Util } from "./util.js";
import { RuntimeConfig, Tab } from "./types.js";

export * as Events from "./events.js";
export * as Types from "./types.js";

import { Select } from "./select.js";
import { StateManager } from "./state.js";
import { Shell } from "./shell.js";
import {
  Outcome,
  PersistentBackend,
  RunConfig,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import {
  RuntimeHostStatusUpdateEvent,
  RuntimeSnackbarEvent,
  RuntimeToastEvent,
  RuntimeUnsnackbarEvent,
} from "./events.js";
import { SettingsStore } from "../ui/data/settings-store.js";
import { inputsFromSettings } from "../ui/data/inputs.js";
import { Autonamer } from "./autonamer.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../ui/config/client-deployment-configuration.js";
import { createGoogleDriveBoardServer } from "../ui/utils/create-server.js";
import { createA2Server, createA2ModuleFactory } from "../a2/index.js";
import { createFileSystemBackend, createFlagManager } from "../idb/index.js";
import { RecentBoardStore } from "../data/recent-boards";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { McpClientManager } from "../mcp/index.js";
import {
  ConsentAction,
  ConsentUIType,
  ConsentRequest,
  FileSystem,
} from "@breadboard-ai/types";
import { ConsentManager } from "../ui/utils/consent-manager.js";
import { SigninAdapter } from "../ui/utils/signin-adapter.js";
import { createActionTrackerBackend } from "../ui/utils/action-tracker";
import { envFromSettings } from "../utils/env-from-settings";
import { builtInMcpClients } from "../mcp-clients";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { FlowGenerator } from "../ui/flow-gen/flow-generator.js";
import { AppCatalystApiClient } from "../ui/flow-gen/app-catalyst.js";
import { EmailPrefsManager } from "../ui/utils/email-prefs-manager.js";
import { err } from "@breadboard-ai/utils";
import { createFileSystem } from "../engine/file-system/index.js";
import { createEphemeralBlobStore } from "../engine/file-system/ephemeral-blob-store.js";
import { composeFileSystemBackends } from "../engine/file-system/composed-peristent-backend.js";
import { addRunModule } from "../engine/add-run-module.js";
import { createGraphStore } from "../engine/inspector/index.js";
import { createLoader } from "../engine/loader/index.js";
import {
  assetsFromGraphDescriptor,
  envFromGraphDescriptor,
} from "../data/file-system.js";

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
  public readonly flowGenerator: FlowGenerator;
  public readonly apiClient: AppCatalystApiClient;
  public readonly emailPrefsManager: EmailPrefsManager;

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

    const autonamer = new Autonamer(graphStoreArgs, this.fileSystem, sandbox);

    const { appName, appSubName } = config;
    this.shell = new Shell(appName, appSubName);

    this.board = new Board(
      loader,
      graphStore,
      this.googleDriveBoardServer,
      this.recentBoardStore,
      this.signinAdapter,
      this.googleDriveClient
    );
    this.util = Util;
    this.select = new Select();
    this.router = new Router();
    this.edit = new Edit(graphStore, autonamer, this.flags);
    this.apiClient = new AppCatalystApiClient(
      this.fetchWithCreds,
      backendApiEndpoint
    );
    this.emailPrefsManager = new EmailPrefsManager(this.apiClient);
    this.flowGenerator = new FlowGenerator(this.apiClient, this.flags);

    this.state = new StateManager(this, graphStore);

    this.run = new Run(graphStore, this.state, this.flags, kits);

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