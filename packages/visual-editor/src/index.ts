/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import type {
  RunErrorEvent,
  RunSecretEvent,
  BoardServer,
} from "@breadboard-ai/types";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { map } from "lit/directives/map.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, nothing } from "lit";
import {
  createRunObserver,
  GraphDescriptor,
  SerializedRun,
  MutableGraphStore,
  defaultModuleContent,
  createFileSystem,
  createEphemeralBlobStore,
  FileSystem,
  addSandboxedRunModule,
  hash,
} from "@google-labs/breadboard";
import {
  createFileSystemBackend,
  createFlagManager,
  getRunStore,
} from "@breadboard-ai/data-store";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { provide } from "@lit/context";
import { RecentBoardStore } from "./data/recent-boards";
import { SecretsHelper } from "./utils/secrets-helper";
import { SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import { styles as mainStyles } from "./index.styles.js";
import * as Runtime from "./runtime/runtime.js";
import {
  TabId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "./runtime/types";
import {
  createTokenVendor,
  TokenVendor,
} from "@breadboard-ai/connection-client";

import { sandbox } from "./sandbox";
import {
  AssetMetadata,
  GraphIdentifier,
  Module,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import { KeyboardCommandDeps } from "./commands/types";
import {
  SIGN_IN_CONNECTION_ID,
  SigninAdapter,
  signinAdapterContext,
} from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { sideBoardRuntime } from "@breadboard-ai/shared-ui/contexts/side-board-runtime.js";
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { MAIN_BOARD_ID } from "@breadboard-ai/shared-ui/constants/constants.js";
import { createA2Server } from "@breadboard-ai/a2";
import { envFromSettings } from "./utils/env-from-settings";
import { getGoogleDriveBoardService } from "@breadboard-ai/board-server-management";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
  CreateNewBoardMessage,
  EmbedHandler,
  embedState,
  EmbedState,
  IterateOnPromptMessage,
  ToggleIterateOnPromptMessage,
} from "@breadboard-ai/embed";
import { IterateOnPromptEvent } from "@breadboard-ai/shared-ui/events/events.js";
import {
  AppCatalystApiClient,
  CheckAppAccessResponse,
} from "@breadboard-ai/shared-ui/flow-gen/app-catalyst.js";
import {
  FlowGenerator,
  flowGeneratorContext,
} from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";
import { findGoogleDriveAssetsInGraph } from "@breadboard-ai/shared-ui/elements/google-drive/find-google-drive-assets-in-graph.js";
import { stringifyPermission } from "@breadboard-ai/shared-ui/elements/share-panel/share-panel.js";
import { type GoogleDriveAssetShareDialog } from "@breadboard-ai/shared-ui/elements/elements.js";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import { clientDeploymentConfigurationContext } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { type ClientDeploymentConfiguration } from "@breadboard-ai/types/deployment-configuration.js";

import { Admin } from "./admin";
import { MainArguments } from "./types/types";
import {
  type BuildInfo,
  buildInfoContext,
} from "@breadboard-ai/shared-ui/contexts/build-info.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { eventRoutes } from "./event-routing/event-routing";
import { keyboardCommands } from "./commands/commands";
import { ReactiveAppScreen } from "@breadboard-ai/shared-ui/state/app-screen.js";
import { type AppScreenOutput } from "@breadboard-ai/shared-ui/state/types.js";

type RenderValues = {
  canSave: boolean;
  saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS;
  projectState: BreadboardUI.State.Project | null;
  showingOverlay: boolean;
  showExperimentalComponents: boolean;
  themeHash: number;
  tabStatus: BreadboardUI.Types.STATUS;
  topGraphResult: BreadboardUI.Types.TopGraphRunResult;
};

const LOADING_TIMEOUT = 1250;
const BOARD_AUTO_SAVE_TIMEOUT = 1_500;

@customElement("bb-main")
export class Main extends SignalWatcher(LitElement) {
  @provide({ context: clientDeploymentConfigurationContext })
  accessor clientDeploymentConfiguration: ClientDeploymentConfiguration;

  @provide({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator | undefined;

  @provide({ context: BreadboardUI.Contexts.environmentContext })
  accessor environment: BreadboardUI.Contexts.Environment;

  @provide({ context: BreadboardUI.Elements.tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  accessor settingsHelper!: SettingsHelperImpl;

  @provide({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime;

  @provide({ context: BreadboardUI.Contexts.embedderContext })
  accessor embedState!: EmbedState;

  @property()
  @provide({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter | undefined;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer | undefined;

  @provide({ context: buildInfoContext })
  accessor buildInfo: BuildInfo;

  @state()
  accessor #apiClient: AppCatalystApiClient | null = null;

  @state()
  accessor #tab: Runtime.Types.Tab | null = null;

  accessor #uiState!: BreadboardUI.State.UI;

  readonly #googleDriveAssetShareDialogRef: Ref<GoogleDriveAssetShareDialog> =
    createRef<GoogleDriveAssetShareDialog>();
  readonly #canvasControllerRef: Ref<BreadboardUI.Elements.CanvasController> =
    createRef();
  readonly #tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  readonly #snackbarRef: Ref<BreadboardUI.Elements.Snackbar> = createRef();
  readonly #feedbackPanelRef: Ref<BreadboardUI.Elements.FeedbackPanel> =
    createRef();

  #boardRunStatus = new Map<TabId, BreadboardUI.Types.STATUS>();
  #boardServers: BoardServer[];
  #settings: SettingsStore | null;
  #secretsHelper: SecretsHelper | null = null;
  #onShowTooltipBound = this.#onShowTooltip.bind(this);
  #hideTooltipBound = this.#hideTooltip.bind(this);
  #onKeyboardShortCut = this.#onKeyboardShortcut.bind(this);
  #recentBoardStore = RecentBoardStore.instance();
  #graphStore!: MutableGraphStore;
  #runStore = getRunStore();
  #fileSystem!: FileSystem;
  #selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  #lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  #lastPointerPosition = { x: 0, y: 0 };
  #runtime!: Runtime.RuntimeInstance;
  #embedHandler?: EmbedHandler;

  /**
   * Monotonically increases whenever the graph topology of a graph in the
   * current tab changes. Graph topology == any non-visual change to the graph.
   * - this property is incremented whenever the "update" event is received
   *   from the `GraphStore` instance, which stores and tracks all known graphs,
   *   across all tabs, etc.
   * - this property is only incremented when the "update" is for the current
   *   tab's graph, but that still works when we switch tabs, since we don't
   *   check the value of the property, just whether it changed.
   * - because it is decorated with `@state()` on this component,
   *   incrementing this property causes a new render of the component.
   * - this property is then passed to various sub-components that need to be
   *   aware of graph topology changes.
   * - these sub-components need to have their own `graphTopologyUpdateId` that
   *   should be decorated as `@property()`, so that the change to this property
   *   causes a new render of that component, too.
   * - as the resulting effect, incrementing the property will keep the parts
   *   of the UI that need to reflect the latest graph topology up to date.
   */
  @state()
  accessor graphTopologyUpdateId: number = 0;

  /**
   * Similar to graphTopologyUpdateId, but for all graphs in the graph store.
   * This is useful for tracking all changes to all graphs, like in
   * component/boards selectors.
   */
  @state()
  accessor graphStoreUpdateId: number = 0;

  @state()
  accessor #tosStatus: CheckAppAccessResponse | null = null;

  @state()
  accessor #ready = false;

  static styles = mainStyles;

  constructor(args: MainArguments) {
    super();

    this.buildInfo = args.buildInfo;
    this.#boardServers = [];
    this.#settings = args.settings ?? null;
    this.#embedHandler = args.embedHandler;
    this.environment = args.environment;
    this.clientDeploymentConfiguration = args.clientDeploymentConfiguration;

    this.#init(args).then(() => {
      console.log(`[${Strings.from("APP_NAME")} Visual Editor Initialized]`);
      this.#ready = true;
    });
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.addEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.addEventListener("pointerdown", this.#hideTooltipBound);
    window.addEventListener("keydown", this.#onKeyboardShortCut);

    if (this.#embedHandler) {
      this.embedState = embedState();
    }

    this.#embedHandler?.subscribe(
      "toggle_iterate_on_prompt",
      async (message: ToggleIterateOnPromptMessage) => {
        this.embedState.showIterateOnPrompt = message.on;
      }
    );
    this.#embedHandler?.subscribe(
      "create_new_board",
      async (message: CreateNewBoardMessage) => {
        if (!message.prompt) {
          // If no prompt provided, generate an empty board.
          this.#generateBoardFromGraph(BreadboardUI.Utils.blankBoard());
        } else {
          void this.#generateGraph(message.prompt)
            .then((graph) => this.#generateBoardFromGraph(graph))
            .catch((error) => console.error("Error generating board", error));
        }
      }
    );
    this.#embedHandler?.sendToEmbedder({ type: "handshake_ready" });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.removeEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.removeEventListener("pointerdown", this.#hideTooltipBound);
    window.removeEventListener("keydown", this.#onKeyboardShortCut);
  }

  async #init(args: MainArguments) {
    let googleDriveProxyUrl: string | undefined;
    if (this.clientDeploymentConfiguration.ENABLE_GOOGLE_DRIVE_PROXY) {
      if (this.clientDeploymentConfiguration.BACKEND_API_ENDPOINT) {
        googleDriveProxyUrl = new URL(
          "v1beta1/getOpalFile",
          this.clientDeploymentConfiguration.BACKEND_API_ENDPOINT
        ).href;
      } else {
        console.warn(
          `ENABLE_GOOGLE_DRIVE_PROXY was true but BACKEND_API_ENDPOINT was missing.` +
            ` Google Drive proxying will not be available.`
        );
      }
    }

    this.googleDriveClient = new GoogleDriveClient({
      apiBaseUrl: "https://www.googleapis.com",
      proxyUrl: googleDriveProxyUrl,
      publicApiKey: this.environment.googleDrive.publicApiKey,
      getUserAccessToken: async () => {
        if (!this.signinAdapter) {
          throw new Error(`SigninAdapter is misconfigured`);
        }
        const token = await this.signinAdapter.refresh();
        if (token?.state === "valid") {
          return token.grant.access_token;
        }
        throw new Error(
          `User is unexpectedly signed out, or SigninAdapter is misconfigured`
        );
      },
    });

    let settingsRestore = Promise.resolve();
    if (this.#settings) {
      this.settingsHelper = new SettingsHelperImpl(this.#settings);
      this.tokenVendor = createTokenVendor(
        {
          get: (conectionId: string) => {
            return this.settingsHelper.get(
              BreadboardUI.Types.SETTINGS_TYPE.CONNECTIONS,
              conectionId
            )?.value as string;
          },
          set: async (connectionId: string, grant: string) => {
            await this.settingsHelper.set(
              BreadboardUI.Types.SETTINGS_TYPE.CONNECTIONS,
              connectionId,
              {
                name: connectionId,
                value: grant,
              }
            );
          },
        },
        this.environment
      );

      settingsRestore = this.#settings?.restore();
    }

    await settingsRestore;

    this.#fileSystem = createFileSystem({
      env: [...envFromSettings(this.#settings), ...(args.env || [])],
      local: createFileSystemBackend(createEphemeralBlobStore()),
    });

    this.#runtime = await Runtime.create({
      recentBoardStore: this.#recentBoardStore,
      graphStore: this.#graphStore,
      runStore: this.#runStore,
      experiments: {},
      environment: this.environment,
      tokenVendor: this.tokenVendor,
      sandbox,
      settings: this.#settings!,
      proxy: [],
      fileSystem: this.#fileSystem,
      builtInBoardServers: [createA2Server()],
      kits: addSandboxedRunModule(
        sandbox,
        args.kits || [],
        args.moduleInvocationFilter
      ),
      googleDriveClient: this.googleDriveClient,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
      flags: createFlagManager(this.clientDeploymentConfiguration.flags),
    });

    this.#uiState = this.#runtime.state.getOrCreateUIState();
    this.#addRuntimeEventHandlers();

    const admin = new Admin(args, this.environment, this.googleDriveClient);
    admin.runtime = this.#runtime;

    admin.settingsHelper = this.settingsHelper;

    this.#graphStore = this.#runtime.board.getGraphStore();
    this.#boardServers = this.#runtime.board.getBoardServers() || [];
    this.sideBoardRuntime = this.#runtime.sideboards;

    // This is currently used only for legacy graph kits (Agent,
    // Google Drive).
    args.graphStorePreloader?.(this.#graphStore);

    this.sideBoardRuntime.addEventListener("empty", () => {
      this.#uiState.canRunMain = true;
    });
    this.sideBoardRuntime.addEventListener("running", () => {
      this.#uiState.canRunMain = false;
    });

    this.signinAdapter = this.#createSigninAdapter();
    if (this.signinAdapter.state === "signedout") {
      return;
    }

    const backendApiEndpoint =
      this.clientDeploymentConfiguration.BACKEND_API_ENDPOINT;
    if (backendApiEndpoint) {
      this.#apiClient = new AppCatalystApiClient(
        this.signinAdapter,
        backendApiEndpoint
      );

      this.flowGenerator = new FlowGenerator(this.#apiClient);
    } else {
      console.warn(
        `No BACKEND_API_ENDPOINT was configured so` +
          ` FlowGenerator will not be available.`
      );
    }

    this.#graphStore.addEventListener("update", (evt) => {
      const { mainGraphId } = evt;
      const current = this.#tab?.mainGraphId;
      this.graphStoreUpdateId++;
      if (
        !current ||
        (mainGraphId !== current && !evt.affectedGraphs.includes(current))
      ) {
        return;
      }
      this.graphTopologyUpdateId++;
    });

    await this.#runtime.router.init();
    if (!args.boardServerUrl) {
      return;
    }

    // Once we've determined the sign-in status, relay it to an embedder.
    this.#embedHandler?.sendToEmbedder({
      type: "home_loaded",
      isSignedIn: this.signinAdapter.state === "signedin",
    });

    if (args.boardServerUrl.protocol === GoogleDriveBoardServer.PROTOCOL) {
      const gdrive = await getGoogleDriveBoardService();
      if (gdrive) {
        args.boardServerUrl = new URL(gdrive.url);
      }
    }

    let hasMountedBoardServer = false;
    for (const server of this.#boardServers) {
      if (server.url.href === args.boardServerUrl.href) {
        hasMountedBoardServer = true;
        this.#uiState.boardServer = server.name;
        this.#uiState.boardLocation = server.url.href;
        this.boardServer = server;
        break;
      }
    }

    if (!hasMountedBoardServer) {
      console.log(`Mounting server "${args.boardServerUrl.href}" ...`);
      const connecting = await this.#runtime.board.connect(
        args.boardServerUrl.href
      );
      if (connecting?.success) {
        console.log(`Connected to server`);
      }
    }
  }

  #addRuntimeEventHandlers() {
    if (!this.#runtime) {
      console.error("No runtime found");
      return;
    }

    const currentUrl = new URL(window.location.href);

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeToastEvent.eventName,
      (evt: Runtime.Events.RuntimeToastEvent) => {
        this.toast(evt.message, evt.toastType, evt.persistent, evt.toastId);
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeSnackbarEvent.eventName,
      (evt: Runtime.Events.RuntimeSnackbarEvent) => {
        this.snackbar(
          evt.message,
          evt.snackType,
          evt.actions,
          evt.persistent,
          evt.snackbarId,
          evt.replaceAll
        );
      }
    );

    this.#runtime.select.addEventListener(
      Runtime.Events.RuntimeSelectionChangeEvent.eventName,
      (evt: Runtime.Events.RuntimeSelectionChangeEvent) => {
        this.#selectionState = {
          selectionChangeId: evt.selectionChangeId,
          selectionState: evt.selectionState,
          moveToSelection: evt.moveToSelection,
        };

        this.requestUpdate();
      }
    );

    this.#runtime.edit.addEventListener(
      Runtime.Events.RuntimeVisualChangeEvent.eventName,
      (evt: Runtime.Events.RuntimeVisualChangeEvent) => {
        this.#lastVisualChangeId = evt.visualChangeId;
        this.requestUpdate();
      }
    );

    this.#runtime.edit.addEventListener(
      Runtime.Events.RuntimeBoardAutonameEvent.eventName,
      (evt: Runtime.Events.RuntimeBoardAutonameEvent) => {
        console.log("Autoname Status Change:", evt.status);
      }
    );

    this.#runtime.edit.addEventListener(
      Runtime.Events.RuntimeBoardEditEvent.eventName,
      () => {
        this.#runtime.board.save(
          this.#tab?.id ?? null,
          BOARD_AUTO_SAVE_TIMEOUT,
          null
        );
      }
    );

    this.#runtime.edit.addEventListener(
      Runtime.Events.RuntimeErrorEvent.eventName,
      (evt: Runtime.Events.RuntimeErrorEvent) => {
        // Wait a frame so we don't end up accidentally spamming the render.
        requestAnimationFrame(() => {
          this.toast(evt.message, BreadboardUI.Events.ToastType.ERROR);
        });
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeBoardLoadErrorEvent.eventName,
      () => {
        if (this.#tab) {
          this.#uiState.loadState = "Error";
        }

        this.toast(
          Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT"),
          BreadboardUI.Events.ToastType.ERROR
        );
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeErrorEvent.eventName,
      (evt: Runtime.Events.RuntimeErrorEvent) => {
        this.toast(evt.message, BreadboardUI.Events.ToastType.ERROR);
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeTabChangeEvent.eventName,
      async (evt: Runtime.Events.RuntimeTabChangeEvent) => {
        this.#tab = this.#runtime.board.currentTab;
        this.#maybeShowWelcomePanel();

        if (this.#tab) {
          // If there is a TGO in the tab change event, honor it and populate a
          // run with it before switching to the tab proper.
          if (evt.topGraphObserver) {
            this.#runtime.run.create(
              this.#tab,
              evt.topGraphObserver,
              evt.runObserver
            );
          }

          if (this.#tab.graph.title) {
            this.#runtime.shell.setPageTitle(this.#tab.graph.title);
          }

          if (this.#tab.readOnly && this.#uiState.mode === "canvas") {
            this.snackbar(
              Strings.from("LABEL_READONLY_PROJECT"),
              BreadboardUI.Types.SnackType.INFORMATION,
              [
                {
                  title: "Remix",
                  action: "remix",
                  value: this.#tab.graph.url,
                },
              ],
              true
            );
          }

          this.#uiState.loadState = "Loaded";
          this.#runtime.select.refresh(
            this.#tab.id,
            this.#runtime.util.createWorkspaceSelectionChangeId()
          );
        } else {
          this.#runtime.router.clearFlowParameters();
          this.#runtime.shell.setPageTitle(null);
        }
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeModuleChangeEvent.eventName,
      () => {
        this.requestUpdate();
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeWorkspaceItemChangeEvent.eventName,
      () => {
        this.requestUpdate();
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeTabCloseEvent.eventName,
      async (evt: Runtime.Events.RuntimeTabCloseEvent) => {
        if (!evt.tabId) {
          return;
        }

        if (this.#tab?.id !== evt.tabId) {
          return;
        }

        if (
          this.#boardRunStatus.get(evt.tabId) ===
          BreadboardUI.Types.STATUS.STOPPED
        ) {
          return;
        }

        this.#boardRunStatus.set(evt.tabId, BreadboardUI.Types.STATUS.STOPPED);
        this.#runtime.run.getAbortSignal(evt.tabId)?.abort();
        this.requestUpdate();
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeBoardSaveStatusChangeEvent.eventName,
      () => {
        this.requestUpdate();
      }
    );

    this.#runtime.run.addEventListener(
      Runtime.Events.RuntimeBoardRunEvent.eventName,
      (evt: Runtime.Events.RuntimeBoardRunEvent) => {
        if (this.#tab && evt.tabId === this.#tab.id) {
          this.requestUpdate();
        }

        switch (evt.runEvt.type) {
          case "next":
          case "graphstart":
          case "skip": {
            // Noops.
            break;
          }

          case "start": {
            this.#boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.RUNNING
            );
            break;
          }

          case "end": {
            this.#boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.STOPPED
            );
            break;
          }

          case "error": {
            const runEvt = evt.runEvt as RunErrorEvent;
            this.toast(
              BreadboardUI.Utils.formatError(runEvt.data.error),
              BreadboardUI.Events.ToastType.ERROR
            );
            this.#boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.STOPPED
            );
            break;
          }

          case "resume": {
            this.#boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.RUNNING
            );
            break;
          }

          case "pause": {
            this.#boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.PAUSED
            );
            break;
          }

          case "secret": {
            const event = evt.runEvt as RunSecretEvent;
            const runner = evt.harnessRunner;
            const { keys } = event.data;
            const signInKey = `connection:${SIGN_IN_CONNECTION_ID}`;

            // Check and see if we're being asked for a sign-in key
            if (keys.at(0) === signInKey) {
              // Yay, we can handle this ourselves.
              const signInAdapter = new SigninAdapter(
                this.tokenVendor,
                this.environment,
                this.settingsHelper
              );
              if (signInAdapter.state === "signedin") {
                runner?.run({ [signInKey]: signInAdapter.accessToken() });
              } else {
                signInAdapter.refresh().then((token) => {
                  if (!runner?.running()) {
                    runner?.run({
                      [signInKey]:
                        token.state === "valid"
                          ? token.grant.access_token
                          : undefined,
                    });
                  }
                });
              }
              return;
            }

            if (this.#secretsHelper) {
              this.#secretsHelper.setKeys(keys);
              if (this.#secretsHelper.hasAllSecrets()) {
                runner?.run(this.#secretsHelper.getSecrets());
              } else {
                const result = SecretsHelper.allKeysAreKnown(
                  this.#settings!,
                  keys
                );
                if (result) {
                  runner?.run(result);
                }
              }
            } else {
              const result = SecretsHelper.allKeysAreKnown(
                this.#settings!,
                keys
              );
              if (result) {
                runner?.run(result);
              } else {
                this.#secretsHelper = new SecretsHelper(this.#settings!);
                this.#secretsHelper.setKeys(keys);
              }
            }
          }
        }
      }
    );

    this.#runtime.router.addEventListener(
      Runtime.Events.RuntimeURLChangeEvent.eventName,
      async (evt: Runtime.Events.RuntimeURLChangeEvent) => {
        this.#runtime.board.currentURL = evt.url;

        if (evt.mode) {
          this.#uiState.mode = evt.mode;
        }

        const urlWithoutMode = new URL(evt.url);
        urlWithoutMode.searchParams.delete("mode");

        // Close tab, go to the home page.
        if (urlWithoutMode.search === "") {
          if (this.#tab) {
            this.#runtime.board.closeTab(this.#tab.id);
            return;
          }

          // This does a round-trip to clear out any tabs, after which it
          // will dispatch an event which will cause the welcome page to be
          // shown.
          this.#runtime.board.createTabsFromURL(currentUrl);
        } else {
          // Load the tab.
          const boardUrl = this.#runtime.board.getBoardURL(urlWithoutMode);
          if (!boardUrl || boardUrl === this.#tab?.graph.url) {
            return;
          }

          if (urlWithoutMode) {
            const loadingTimeout = setTimeout(() => {
              this.snackbar(
                Strings.from("STATUS_GENERIC_LOADING"),
                BreadboardUI.Types.SnackType.PENDING,
                [],
                true,
                evt.id,
                true
              );
            }, LOADING_TIMEOUT);

            this.#uiState.loadState = "Loading";
            await this.#runtime.board.createTabFromURL(
              boardUrl,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              evt.creator,
              evt.resultsFileId
            );
            clearTimeout(loadingTimeout);
            this.unsnackbar();
          }
        }
      }
    );
  }

  async #generateGraph(intent: string): Promise<GraphDescriptor> {
    if (!this.flowGenerator) {
      throw new Error(`No FlowGenerator was provided`);
    }
    const { flow } = await this.flowGenerator.oneShot({ intent });
    return flow;
  }

  async #generateBoardFromGraph(graph: GraphDescriptor) {
    const boardServerName = this.#uiState.boardServer;
    const location = this.#uiState.boardLocation;
    const fileName = `${globalThis.crypto.randomUUID()}.bgl.json`;

    const saveResult = await this.#runtime.board.saveAs(
      boardServerName,
      location,
      fileName,
      graph,
      true,
      {
        start: Strings.from("STATUS_CREATING_PROJECT"),
        end: Strings.from("STATUS_PROJECT_CREATED"),
        error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
      }
    );

    if (!saveResult || !saveResult.result || !saveResult.url) {
      return;
    }

    this.#embedHandler?.sendToEmbedder({
      type: "board_id_created",
      id: saveResult.url.href,
    });
  }

  #createSigninAdapter() {
    return new BreadboardUI.Utils.SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );
  }

  #maybeShowWelcomePanel() {
    if (this.#tab === null) {
      this.#uiState.loadState = "Home";
    }

    if (this.#uiState.loadState !== "Home") {
      return;
    }
    this.#hideAllOverlays();
    this.unsnackbar();
  }

  #hideAllOverlays() {
    this.#uiState.show.delete("BoardEditModal");
    this.#uiState.show.delete("ItemModal");
    this.#uiState.show.delete("BoardServerAddOverlay");
  }

  #onShowTooltip(evt: Event) {
    const tooltipEvent = evt as BreadboardUI.Events.ShowTooltipEvent;
    if (!this.#tooltipRef.value) {
      return;
    }

    const tooltips = this.#settings?.getItem(
      BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
      "Show Tooltips"
    );
    if (!tooltips?.value) {
      return;
    }

    // Add a little clearance onto the value.
    this.#tooltipRef.value.x = Math.min(
      Math.max(tooltipEvent.x, 120),
      window.innerWidth - 120
    );
    this.#tooltipRef.value.y = Math.max(tooltipEvent.y, 90);
    this.#tooltipRef.value.message = tooltipEvent.message;
    this.#tooltipRef.value.visible = true;
  }

  #hideTooltip() {
    if (!this.#tooltipRef.value) {
      return;
    }

    this.#tooltipRef.value.visible = false;
  }

  #receivesInputPreference(target: EventTarget) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLCanvasElement ||
      target instanceof BreadboardUI.Elements.ModuleEditor ||
      (target instanceof HTMLElement &&
        (target.contentEditable === "true" ||
          target.contentEditable === "plaintext-only"))
    );
  }

  #handlingShortcut = false;
  async #onKeyboardShortcut(evt: KeyboardEvent) {
    if (this.#handlingShortcut) {
      return;
    }

    // Check if there's an input preference before actioning any main keyboard
    // command.
    if (
      evt.composedPath().some((target) => this.#receivesInputPreference(target))
    ) {
      return;
    }

    let key = evt.key;
    if (key === "Meta" || key === "Ctrl" || key === "Shift") {
      return;
    }
    if (evt.shiftKey) {
      key = `Shift+${key}`;
    }
    if (evt.metaKey) {
      key = `Cmd+${key}`;
    }
    if (evt.ctrlKey) {
      key = `Ctrl+${key}`;
    }

    const deps: KeyboardCommandDeps = {
      runtime: this.#runtime,
      selectionState: this.#selectionState,
      tab: this.#tab,
      originalEvent: evt,
      pointerLocation: this.#lastPointerPosition,
      settings: this.#settings,
      strings: Strings,
    } as const;

    for (const [keys, command] of keyboardCommands) {
      if (keys.includes(key) && command.willHandle(this.#tab, evt)) {
        evt.preventDefault();
        evt.stopImmediatePropagation();

        this.#handlingShortcut = true;

        // Toast.
        let toastId;
        const notifyUser = () => {
          toastId = this.toast(
            command.messagePending ?? Strings.from("STATUS_GENERIC_WORKING"),
            BreadboardUI.Events.ToastType.PENDING,
            true
          );
        };

        // Either notify or set a timeout for notifying the user.
        let notifyUserOnTimeout;
        if (command.alwaysNotify) {
          notifyUser();
        } else {
          notifyUserOnTimeout = setTimeout(
            notifyUser,
            command.messageTimeout ?? 100
          );
        }

        // Perform the command.
        try {
          this.#uiState.blockingAction = true;
          await command.do(deps);
          this.#uiState.blockingAction = false;

          // Replace the toast.
          if (toastId) {
            this.toast(
              command.messageComplete ?? Strings.from("STATUS_GENERIC_WORKING"),
              command.messageType ?? BreadboardUI.Events.ToastType.INFORMATION,
              false,
              toastId
            );
          }
        } catch (err) {
          const commandErr = err as { message: string };
          this.toast(
            commandErr.message ?? Strings.from("ERROR_GENERIC"),
            BreadboardUI.Events.ToastType.ERROR,
            false,
            toastId
          );
        } finally {
          // Clear the timeout in case it's not fired yet.
          if (notifyUserOnTimeout) {
            clearTimeout(notifyUserOnTimeout);
          }
        }

        this.#handlingShortcut = false;
      }
    }
  }

  untoast(id: string | undefined) {
    if (!id) {
      return;
    }

    this.#uiState.toasts.delete(id);
    this.requestUpdate();
  }

  toast(
    message: string,
    type: BreadboardUI.Events.ToastType,
    persistent = false,
    id = globalThis.crypto.randomUUID()
  ) {
    if (message.length > 77) {
      message = message.slice(0, 74) + "...";
    }

    this.#uiState.toasts.set(id, { message, type, persistent });
    return id;
  }

  snackbar(
    message: string,
    type: BreadboardUI.Types.SnackType,
    actions: BreadboardUI.Types.SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbarRef.value) {
      return;
    }

    return this.#snackbarRef.value.show(
      {
        id,
        message,
        type,
        persistent,
        actions,
      },
      replaceAll
    );
  }

  unsnackbar() {
    if (!this.#snackbarRef.value) {
      return;
    }

    this.#snackbarRef.value.hide();
  }

  #attemptImportFromDrop(evt: DragEvent) {
    if (
      !evt.dataTransfer ||
      !evt.dataTransfer.files ||
      !evt.dataTransfer.files.length
    ) {
      return;
    }

    const isSerializedRun = (
      data: SerializedRun | GraphDescriptor
    ): data is SerializedRun => {
      return "timeline" in data;
    };

    const filesDropped = evt.dataTransfer.files;
    if ([...filesDropped].some((file) => !file.type.includes("json"))) {
      const wasDroppedOnAssetOrganizer = evt
        .composedPath()
        .some((el) => el instanceof BreadboardUI.Elements.AssetOrganizer);

      if (!wasDroppedOnAssetOrganizer) {
        return;
      }

      const assetLoad = [...filesDropped].map((file) => {
        return new Promise<{
          name: string;
          type: string;
          content: string | null;
        }>((resolve) => {
          const reader = new FileReader();
          reader.addEventListener("loadend", () => {
            resolve({
              name: file.name,
              type: file.type,
              content: reader.result as string | null,
            });
          });
          reader.readAsDataURL(file);
        });
      });

      Promise.all(assetLoad).then((assets) => {
        const projectState = this.#runtime.state.getOrCreateProjectState(
          this.#tab?.mainGraphId,
          this.#runtime.edit.getEditor(this.#tab)
        );

        if (!projectState) {
          return;
        }

        for (const asset of assets) {
          if (!asset.content) continue;
          const [, mimeType, , data] = asset.content.split(/[:;,]/);
          projectState.organizer.addGraphAsset({
            path: asset.name,
            metadata: {
              title: asset.name,
              type: "file",
            },
            data: [
              {
                parts: [
                  {
                    inlineData: { mimeType, data },
                  },
                ],
                role: "user",
              },
            ],
          });
        }
      });
      return;
    }

    const fileDropped = evt.dataTransfer.files[0];
    fileDropped.text().then((data) => {
      try {
        const runData = JSON.parse(data) as SerializedRun | GraphDescriptor;
        if (isSerializedRun(runData)) {
          const runObserver = createRunObserver(this.#graphStore, {
            logLevel: "debug",
            dataStore: this.#runtime.run.dataStore,
            sandbox,
          });

          evt.preventDefault();

          runObserver.load(runData).then(async (result) => {
            if (result.success) {
              // TODO: Append the run to the runObserver so that it can be obtained later.
              const topGraphObserver =
                await BreadboardUI.Utils.TopGraphObserver.fromRun(result.run);
              const descriptor = topGraphObserver?.current()?.graph ?? null;

              if (descriptor) {
                this.#runtime.board.createTabFromRun(
                  descriptor,
                  topGraphObserver,
                  runObserver,
                  true
                );
              } else {
                this.toast(
                  Strings.from("ERROR_RUN_LOAD_DATA_FAILED"),
                  BreadboardUI.Events.ToastType.ERROR
                );
              }
            } else {
              this.toast(
                Strings.from("ERROR_RUN_LOAD_DATA_FAILED"),
                BreadboardUI.Events.ToastType.ERROR
              );
            }
          });
        } else {
          this.#runtime.board.createTabFromDescriptor(runData);
        }
      } catch (err) {
        console.warn(err);
        this.toast(
          Strings.from("ERROR_LOAD_FAILED"),
          BreadboardUI.Events.ToastType.ERROR
        );
      }
    });
  }

  #attemptModuleCreate(moduleId: ModuleIdentifier) {
    if (!this.#tab) {
      return;
    }

    const newModule: Module = {
      code: defaultModuleContent(),
      metadata: {},
    };

    const createAsTypeScript =
      this.#settings
        ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
        .items.get("Use TypeScript as Module default language")?.value ?? false;
    if (createAsTypeScript) {
      newModule.metadata = {
        source: {
          code: defaultModuleContent("typescript"),
          language: "typescript",
        },
      };
    }

    this.#runtime.edit.createModule(this.#tab, moduleId, newModule);
  }

  async #attemptToggleExport(
    id: ModuleIdentifier | GraphIdentifier,
    type: "imperative" | "declarative"
  ) {
    if (!this.#tab) {
      return;
    }

    return this.#runtime.edit.toggleExport(this.#tab, id, type);
  }

  #getRenderValues(): RenderValues {
    const observers = this.#runtime?.run.getObservers(this.#tab?.id ?? null);
    const topGraphResult =
      observers?.topGraphObserver?.current() ??
      BreadboardUI.Utils.TopGraphObserver.entryResult(this.#tab?.graph);

    let tabStatus = BreadboardUI.Types.STATUS.STOPPED;
    if (this.#tab) {
      tabStatus =
        this.#boardRunStatus.get(this.#tab.id) ??
        BreadboardUI.Types.STATUS.STOPPED;
    }

    let themeHash = 0;
    if (
      this.#tab?.graph?.metadata?.visual?.presentation?.themes &&
      this.#tab?.graph?.metadata?.visual?.presentation?.theme
    ) {
      const theme = this.#tab.graph.metadata.visual.presentation.theme;
      const themes = this.#tab.graph.metadata.visual.presentation.themes;

      if (themes[theme]) {
        themeHash = hash(themes[theme]);
      }
    }

    const projectState = this.#runtime.state.getOrCreateProjectState(
      this.#tab?.mainGraphId,
      this.#runtime.edit.getEditor(this.#tab)
    );

    if (projectState && this.#tab?.finalOutputValues) {
      const current = new ReactiveAppScreen("", [], undefined);
      const last: AppScreenOutput = {
        output: this.#tab.finalOutputValues,
        schema: {},
      };
      current.outputs.set("final", last);
      projectState.run.app.current = current;
      projectState.run.app.screens.set("final", current);
    }

    const showExperimentalComponents: boolean = this.#settings
      ? (this.#settings
          .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
          .items.get("Show Experimental Components")?.value as boolean)
      : false;

    const canSave = this.#tab
      ? this.#runtime.board.canSave(this.#tab.id) && !this.#tab.readOnly
      : false;

    const saveStatus = this.#tab
      ? (this.#runtime.board.saveStatus(this.#tab.id) ??
        BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED)
      : BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;

    return {
      canSave,
      projectState,
      saveStatus,
      showingOverlay:
        this.#uiState.show.has("TOS") ||
        this.#uiState.show.has("BoardEditModal") ||
        this.#uiState.show.has("ItemModal") ||
        this.#uiState.show.has("BoardServerAddOverlay") ||
        this.#uiState.show.has("NewWorkspaceItemOverlay"),
      showExperimentalComponents,
      themeHash,
      tabStatus,
      topGraphResult,
    } satisfies RenderValues;
  }

  #collectEventRouteDeps(
    evt: BreadboardUI.Events.StateEvent<
      keyof BreadboardUI.Events.StateEventDetailMap
    >
  ) {
    if (!this.#secretsHelper) {
      this.#secretsHelper = new SecretsHelper(this.#settings!);
    }

    return {
      originalEvent: evt,
      runtime: this.#runtime,
      settings: this.#settings,
      secretsHelper: this.#secretsHelper,
      tab: this.#tab,
      uiState: this.#uiState,
    };
  }

  protected willUpdate(): void {
    if (!this.#uiState) {
      return;
    }

    if (this.#tosStatus && !this.#tosStatus.canAccess) {
      this.#uiState.show.add("TOS");
    } else {
      this.#uiState.show.delete("TOS");
    }
  }

  render() {
    if (!this.#ready) {
      return nothing;
    }

    if (!this.signinAdapter) {
      return nothing;
    }

    if (!this.signinAdapter || this.signinAdapter.state === "signedout") {
      return html`<bb-connection-entry-signin
        .adapter=${this.signinAdapter}
        @bbsignin=${async () => {
          window.location.reload();
        }}
      ></bb-connection-entry-signin>`;
    }

    const renderValues = this.#getRenderValues();

    const content = html`<div
      id="content"
      ?inert=${renderValues.showingOverlay || this.#uiState.blockingAction}
    >
      ${this.#uiState.show.has("TOS")
        ? nothing
        : [
            this.#renderCanvasController(renderValues),
            this.#renderAppController(renderValues),
            this.#renderWelcomePanel(renderValues),
          ]}
    </div>`;

    /**
     * bbevent is the container for most of the actions triggered within the UI.
     * It is something of a shapeshifting event, where the `eventType` property
     * indicates which precise event it is. We do it this way because otherwise
     * we end up with a vast array of named event listeners on the elements here
     * and maintenance becomes tricky.
     *
     * @see BreadboardUI.Events.StateEventDetailMap for the list of all events.
     */
    return html`<div
      id="container"
      @bbevent=${async (
        evt: BreadboardUI.Events.StateEvent<
          keyof BreadboardUI.Events.StateEventDetailMap
        >
      ) => {
        // Locate the specific handler based on the event type.
        const eventRoute = eventRoutes.get(evt.detail.eventType);
        if (!eventRoute) {
          console.warn(`No event handler for "${evt.detail.eventType}"`);
          return;
        }

        // Pass the handler everything it may need in order to function. Usually
        // the most important of these are the runtime, originalEvent (which
        // contains the data needed) and the tab so that the runtime can locate
        // the appropriate editor etc.
        const shouldRender = await eventRoute.do(
          this.#collectEventRouteDeps(evt)
        );

        // Some legacy actions require an update after running, so if the event
        // handler returns with a true, schedule an update.
        if (shouldRender) {
          requestAnimationFrame(() => {
            this.requestUpdate();
          });
        }
      }}
      @bbsnackbar=${(snackbarEvent: BreadboardUI.Events.SnackbarEvent) => {
        this.snackbar(
          snackbarEvent.message,
          snackbarEvent.snackType,
          snackbarEvent.actions,
          snackbarEvent.persistent,
          snackbarEvent.snackbarId,
          snackbarEvent.replaceAll
        );
      }}
      @bbunsnackbar=${() => {
        this.unsnackbar();
      }}
      @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
        this.toast(toastEvent.message, toastEvent.toastType);
      }}
      @dragover=${(evt: DragEvent) => {
        evt.preventDefault();
      }}
      @drop=${(evt: DragEvent) => {
        evt.preventDefault();
        this.#attemptImportFromDrop(evt);
      }}
    >
      ${[
        this.#renderHeader(renderValues),
        content,
        this.#uiState.show.has("TOS") ? this.#renderTosDialog() : nothing,
        this.#uiState.show.has("NewWorkspaceItemOverlay")
          ? this.#renderNewWorkspaceItemOverlay()
          : nothing,

        this.#uiState.show.has("BoardServerAddOverlay")
          ? this.#renderBoardServerAddOverlay()
          : nothing,
        this.#uiState.show.has("BoardEditModal")
          ? this.#renderBoardEditModal()
          : nothing,
        this.#uiState.show.has("ItemModal") ? this.#renderItemModal() : nothing,
        this.#renderTooltip(),
        this.#renderToasts(),
        this.#renderSnackbar(),
        this.#renderGoogleDriveAssetShareDialog(),
        this.#renderFeedbackPanel(),
      ]}
    </div>`;
  }

  #renderWelcomePanel(renderValues: RenderValues) {
    if (this.#uiState.loadState !== "Home") {
      return nothing;
    }

    return html`<bb-project-listing
      .recentBoards=${this.#runtime.board.getRecentBoards()}
      .selectedBoardServer=${this.#uiState.boardServer}
      .selectedLocation=${this.#uiState.boardLocation}
      .boardServers=${this.#boardServers}
      .showAdditionalSources=${renderValues.showExperimentalComponents}
      .filter=${this.#uiState.projectFilter}
      @bbgraphboardserveradd=${() => {
        this.#uiState.show.add("BoardServerAddOverlay");
      }}
      @bbgraphboardserverrefresh=${async (
        evt: BreadboardUI.Events.GraphBoardServerRefreshEvent
      ) => {
        const boardServer = this.#runtime.board.getBoardServerByName(
          evt.boardServerName
        );
        if (!boardServer) {
          return;
        }

        const refreshed = await boardServer.refresh(evt.location);
        if (!refreshed) {
          this.toast(
            Strings.from("ERROR_UNABLE_TO_REFRESH_PROJECTS"),
            BreadboardUI.Events.ToastType.WARNING
          );
        }
      }}
      @bbgraphboardserverdisconnect=${async (
        evt: BreadboardUI.Events.GraphBoardServerDisconnectEvent
      ) => {
        await this.#runtime.board.disconnect(evt.location);
      }}
      @bbgraphboardserverrenewaccesssrequest=${async (
        evt: BreadboardUI.Events.GraphBoardServerRenewAccessRequestEvent
      ) => {
        const boardServer = this.#runtime.board.getBoardServerByName(
          evt.boardServerName
        );

        if (!boardServer) {
          return;
        }

        if (boardServer.renewAccess) {
          await boardServer.renewAccess();
        }
      }}
    ></bb-project-listing>`;
  }

  #renderAppController(renderValues: RenderValues) {
    if (!this.signinAdapter) {
      return nothing;
    }

    return html` <bb-app-controller
      class=${classMap({ active: this.#uiState.mode === "app" })}
      .graph=${this.#tab?.graph ?? null}
      .projectRun=${renderValues.projectState?.run}
      .topGraphResult=${renderValues.topGraphResult}
      .showGDrive=${this.signinAdapter.state === "signedin"}
      .settings=${this.#settings}
      .boardServers=${this.#boardServers}
      .status=${renderValues.tabStatus}
      .history=${this.#runtime.edit.getHistory(this.#tab)}
      .isMine=${this.#tab?.graphIsMine ?? false}
      .graphIsEmpty=${(this.#tab?.graph.nodes ?? []).length === 0}
      .showThemeEditing=${false}
      .themeHash=${renderValues.themeHash}
      .readOnly=${true}
    >
    </bb-app-controller>`;
  }

  #renderCanvasController(renderValues: RenderValues) {
    if (!this.signinAdapter) {
      return nothing;
    }

    return html` <bb-canvas-controller
      ${ref(this.#canvasControllerRef)}
      ?inert=${renderValues.showingOverlay}
      .boardServerKits=${this.#tab?.boardServerKits ?? []}
      .boardServers=${this.#boardServers}
      .canRun=${this.#uiState.canRunMain}
      .editor=${this.#runtime.edit.getEditor(this.#tab)}
      .graph=${this.#tab?.graph ?? null}
      .graphIsMine=${this.#tab?.graphIsMine ?? false}
      .graphStore=${this.#graphStore}
      .graphStoreUpdateId=${this.graphStoreUpdateId}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      .history=${this.#runtime.edit.getHistory(this.#tab)}
      .mainGraphId=${this.#tab?.mainGraphId}
      .projectState=${renderValues.projectState}
      .readOnly=${this.#tab?.readOnly ?? true}
      .selectionState=${this.#selectionState}
      .settings=${this.#settings}
      .signedIn=${this.signinAdapter.state === "signedin"}
      .status=${renderValues.tabStatus}
      .themeHash=${renderValues.themeHash}
      .topGraphResult=${renderValues.topGraphResult}
      .visualChangeId=${this.#lastVisualChangeId}
      @bbeditorpositionchange=${(
        evt: BreadboardUI.Events.EditorPointerPositionChangeEvent
      ) => {
        this.#lastPointerPosition.x = evt.x;
        this.#lastPointerPosition.y = evt.y;
      }}
      @bbinteraction=${() => {
        if (!this.#tab) {
          return;
        }

        this.#runtime.board.clearPendingBoardSave(this.#tab.id);
      }}
      @bbworkspacenewitemcreaterequest=${() => {
        this.#uiState.show.add("NewWorkspaceItemOverlay");
      }}
      @bbsubgraphcreate=${async (
        evt: BreadboardUI.Events.SubGraphCreateEvent
      ) => {
        const result = await this.#runtime.edit.createSubGraph(
          this.#tab,
          evt.subGraphTitle
        );
        if (!result) {
          this.toast(
            Strings.from("ERROR_GENERIC"),
            BreadboardUI.Events.ToastType.ERROR
          );
          return;
        }

        if (!this.#tab) {
          return;
        }
        this.#tab.subGraphId = result;
        this.requestUpdate();
      }}
      @bbsubgraphdelete=${async (
        evt: BreadboardUI.Events.SubGraphDeleteEvent
      ) => {
        await this.#runtime.edit.deleteSubGraph(this.#tab, evt.subGraphId);
        if (!this.#tab) {
          return;
        }

        this.#runtime.select.deselectAll(
          this.#tab.id,
          this.#runtime.util.createWorkspaceSelectionChangeId()
        );
      }}
      @bbmodulechangelanguage=${(
        evt: BreadboardUI.Events.ModuleChangeLanguageEvent
      ) => {
        if (!this.#tab) {
          return;
        }

        this.#runtime.edit.changeModuleLanguage(
          this.#tab,
          evt.moduleId,
          evt.moduleLanguage
        );
      }}
      @bbmodulecreate=${(evt: BreadboardUI.Events.ModuleCreateEvent) => {
        this.#attemptModuleCreate(evt.moduleId);
      }}
      @bbmoduledelete=${async (evt: BreadboardUI.Events.ModuleDeleteEvent) => {
        if (!this.#tab) {
          return;
        }

        await this.#runtime.edit.deleteModule(this.#tab, evt.moduleId);
      }}
      @bbmoduleedit=${async (evt: BreadboardUI.Events.ModuleEditEvent) => {
        return this.#runtime.edit.editModule(
          this.#tab,
          evt.moduleId,
          evt.code,
          evt.metadata
        );
      }}
      @bbtoggleexport=${async (evt: BreadboardUI.Events.ToggleExportEvent) => {
        await this.#attemptToggleExport(evt.exportId, evt.exportType);
      }}
      @bbmovenodes=${async (evt: BreadboardUI.Events.MoveNodesEvent) => {
        const { destinationGraphId } = evt;
        for (const [sourceGraphId, nodes] of evt.sourceNodes) {
          await this.#runtime.edit.moveNodesToGraph(
            this.#tab,
            nodes,
            sourceGraphId === MAIN_BOARD_ID ? "" : sourceGraphId,
            destinationGraphId === MAIN_BOARD_ID ? "" : destinationGraphId,
            evt.positionDelta
          );
        }

        if (!this.#tab) {
          return;
        }

        // Clear all selections.
        this.#runtime.select.processSelections(
          this.#tab.id,
          this.#runtime.util.createWorkspaceSelectionChangeId(),
          null,
          true
        );
      }}
      @bbdroppedassets=${async (
        evt: BreadboardUI.Events.DroppedAssetsEvent
      ) => {
        const projectState = this.#runtime.state.getOrCreateProjectState(
          this.#tab?.mainGraphId,
          this.#runtime.edit.getEditor(this.#tab)
        );

        if (!projectState) {
          this.toast("Unable to add", BreadboardUI.Events.ToastType.ERROR);
          return;
        }

        await Promise.all(
          evt.assets.map((asset) => {
            const metadata: AssetMetadata = {
              title: asset.name,
              type: asset.type,
              visual: asset.visual,
            };

            if (asset.subType) {
              metadata.subType = asset.subType;
            }

            return projectState?.organizer.addGraphAsset({
              path: asset.path,
              metadata,
              data: [asset.data],
            });
          })
        );

        this.#checkGoogleDriveAssetShareStatus();
      }}
      @bbgraphreplace=${async (evt: BreadboardUI.Events.GraphReplaceEvent) => {
        await this.#runtime.edit.replaceGraph(
          this.#tab,
          evt.replacement,
          evt.creator
        );
      }}
      @bbiterateonprompt=${(iterateOnPromptEvent: IterateOnPromptEvent) => {
        const message: IterateOnPromptMessage = {
          type: "iterate_on_prompt",
          title: iterateOnPromptEvent.title,
          promptTemplate: iterateOnPromptEvent.promptTemplate,
          boardId: iterateOnPromptEvent.boardId,
          nodeId: iterateOnPromptEvent.nodeId,
          modelId: iterateOnPromptEvent.modelId,
        };
        this.#embedHandler?.sendToEmbedder(message);
      }}
    ></bb-canvas-controller>`;
  }

  #renderNewWorkspaceItemOverlay() {
    return html`<bb-new-workspace-item-overlay
      @bbworkspaceitemcreate=${async (
        evt: BreadboardUI.Events.WorkspaceItemCreateEvent
      ) => {
        this.#uiState.show.delete("NewWorkspaceItemOverlay");

        await this.#runtime.edit.createWorkspaceItem(
          this.#tab,
          evt.itemType,
          evt.title,
          this.#settings
        );
      }}
      @bboverlaydismissed=${() => {
        this.#uiState.show.delete("NewWorkspaceItemOverlay");
      }}
    ></bb-new-workspace-item-overlay>`;
  }

  #renderBoardServerAddOverlay() {
    return html`<bb-board-server-overlay
      .showGoogleDrive=${true}
      .boardServers=${this.#boardServers}
      @bboverlaydismissed=${() => {
        this.#uiState.show.delete("BoardServerAddOverlay");
      }}
      @bbgraphboardserverconnectrequest=${async (
        evt: BreadboardUI.Events.GraphBoardServerConnectRequestEvent
      ) => {
        const result = await this.#runtime.board.connect(
          evt.location,
          evt.apiKey
        );

        if (result.error) {
          this.toast(result.error, BreadboardUI.Events.ToastType.ERROR);
        }

        if (!result.success) {
          return;
        }

        this.#uiState.show.delete("BoardServerAddOverlay");
      }}
    ></bb-board-server-overlay>`;
  }

  #renderBoardEditModal() {
    return html`<bb-edit-board-modal
      .boardTitle=${this.#tab?.graph.title ?? null}
      .boardDescription=${this.#tab?.graph.description ?? null}
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("BoardEditModal");
      }}
    ></bb-edit-board-modal>`;
  }

  #renderItemModal() {
    return html`<bb-item-modal
      .graph=${this.#tab?.graph}
      .selectionState=${this.#selectionState}
      @bboverflowmenuaction=${(
        evt: BreadboardUI.Events.OverflowMenuActionEvent
      ) => {
        evt.stopImmediatePropagation();
        this.#uiState.show.delete("ItemModal");

        if (evt.action === "new-item") {
          this.#uiState.show.add("NewWorkspaceItemOverlay");
          return;
        }

        const selections = BreadboardUI.Utils.Workspace.createSelection(
          this.#selectionState?.selectionState ?? null,
          null,
          null,
          evt.action === "flow" ? null : evt.action,
          null,
          true
        );
        if (!this.#tab) {
          return;
        }
        const selectionChangeId = this.#runtime.select.generateId();
        this.#runtime.select.processSelections(
          this.#tab.id,
          selectionChangeId,
          selections,
          true,
          false
        );
      }}
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("ItemModal");
      }}
    ></bb-item-modal>`;
  }

  #renderTosDialog() {
    const tosTitle = Strings.from("TOS_TITLE");
    let tosHtml = "";
    let tosVersion = 0;
    if (!this.#tosStatus || !this.#tosStatus.canAccess) {
      tosHtml =
        this.#tosStatus?.termsOfService?.terms ?? "Unable to retrieve TOS";
      tosVersion = this.#tosStatus?.termsOfService?.version ?? 0;
    }

    return html`<dialog
      id="tos-dialog"
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }

        evt.preventDefault();
      }}
      ${ref((el: Element | undefined) => {
        const showModalIfNeeded = () => {
          if (el && this.#uiState.show.has("TOS") && el.isConnected) {
            const dialog = el as HTMLDialogElement;
            if (!dialog.open) {
              dialog.showModal();
            }
          }
        };

        requestAnimationFrame(showModalIfNeeded);
      })}
    >
      <form method="dialog">
        <h1>${tosTitle}</h1>
        <div class="tos-content">${unsafeHTML(tosHtml)}</div>
        <div class="controls">
          <button
            @click=${async (evt: Event) => {
              if (!(evt.target instanceof HTMLButtonElement)) {
                return;
              }

              if (!this.#apiClient) {
                console.error("Unable to accept TOS; no client");
                return;
              }

              evt.target.disabled = true;
              await this.#apiClient.acceptTos(tosVersion, true);
              this.#tosStatus = await this.#apiClient.checkTos();
            }}
          >
            Continue
          </button>
        </div>
      </form>
    </dialog>`;
  }

  #renderGoogleDriveAssetShareDialog() {
    return html`
      <bb-google-drive-asset-share-dialog
        ${ref(this.#googleDriveAssetShareDialogRef)}
      ></bb-google-drive-asset-share-dialog>
    `;
  }

  #renderFeedbackPanel() {
    return html`
      <bb-feedback-panel ${ref(this.#feedbackPanelRef)}></bb-feedback-panel>
    `;
  }

  #renderTooltip() {
    return html`<bb-tooltip ${ref(this.#tooltipRef)}></bb-tooltip>`;
  }

  #renderToasts() {
    return html`${map(
      this.#uiState.toasts,
      ([toastId, { message, type, persistent }], idx) => {
        const offset = this.#uiState.toasts.size - idx - 1;
        return html`<bb-toast
          .toastId=${toastId}
          .offset=${offset}
          .message=${message}
          .type=${type}
          .timeout=${persistent ? 0 : nothing}
          @bbtoastremoved=${(evt: BreadboardUI.Events.ToastRemovedEvent) => {
            this.#uiState.toasts.delete(evt.toastId);
          }}
        ></bb-toast>`;
      }
    )}`;
  }

  async #invokeRemixEventRouteWith(
    url: string,
    messages = {
      start: Strings.from("STATUS_REMIXING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_CREATED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    }
  ) {
    this.#uiState.blockingAction = true;
    const remixRoute = eventRoutes.get("board.remix");
    const refresh = await remixRoute?.do(
      this.#collectEventRouteDeps(
        new BreadboardUI.Events.StateEvent({
          eventType: "board.remix",
          messages,
          url,
        })
      )
    );
    this.#uiState.blockingAction = false;

    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  async #invokeDeleteEventRouteWith(url: string) {
    this.#uiState.blockingAction = true;
    const deleteRoute = eventRoutes.get("board.delete");
    const refresh = await deleteRoute?.do(
      this.#collectEventRouteDeps(
        new BreadboardUI.Events.StateEvent({
          eventType: "board.delete",
          messages: {
            query: Strings.from("QUERY_DELETE_PROJECT"),
            start: Strings.from("STATUS_DELETING_PROJECT"),
            end: Strings.from("STATUS_PROJECT_DELETED"),
            error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
          },
          url,
        })
      )
    );
    this.#uiState.blockingAction = false;

    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  #renderSnackbar() {
    return html`<bb-snackbar
      ${ref(this.#snackbarRef)}
      @bbsnackbaraction=${async (
        evt: BreadboardUI.Events.SnackbarActionEvent
      ) => {
        switch (evt.action) {
          case "remix": {
            if (!evt.value) {
              return;
            }

            this.#invokeRemixEventRouteWith(evt.value);
          }
        }
      }}
    ></bb-snackbar>`;
  }

  #renderHeader(renderValues: RenderValues) {
    if (!this.signinAdapter) {
      return nothing;
    }

    return html`<bb-ve-header
      .signinAdapter=${this.signinAdapter}
      .hasActiveTab=${this.#tab !== null}
      .tabTitle=${this.#tab?.graph?.title ?? null}
      .url=${this.#tab?.graph?.url ?? null}
      .loadState=${this.#uiState.loadState}
      .canSave=${renderValues.canSave}
      .isMine=${this.#runtime.board.isMine(this.#tab?.graph.url)}
      .saveStatus=${renderValues.saveStatus}
      .showExperimentalComponents=${renderValues.showExperimentalComponents}
      .mode=${this.#uiState.mode}
      @bbsignout=${async () => {
        const signinAdapter = this.signinAdapter;
        if (!signinAdapter) {
          return;
        }

        await signinAdapter.signOut();
        this.toast(
          Strings.from("STATUS_LOGGED_OUT"),
          BreadboardUI.Events.ToastType.INFORMATION
        );
        this.requestUpdate();
      }}
      @bbclose=${() => {
        if (!this.#tab) {
          return;
        }
        this.#embedHandler?.sendToEmbedder({
          type: "back_clicked",
        });
        this.#runtime.router.go(null, this.#uiState.mode);
      }}
      @bbsharerequested=${() => {
        if (!this.#canvasControllerRef.value) {
          return;
        }

        this.#canvasControllerRef.value.openSharePanel();
      }}
      @input=${(evt: InputEvent) => {
        const inputs = evt.composedPath();
        const input = inputs.find(
          (el) => el instanceof BreadboardUI.Elements.HomepageSearchButton
        );
        if (!input) {
          return;
        }

        this.#uiState.projectFilter = input.value;
      }}
      @change=${async (evt: Event) => {
        const [select] = evt.composedPath();
        if (!(select instanceof BreadboardUI.Elements.ItemSelect)) {
          return;
        }

        switch (select.value) {
          case "edit-title-and-description": {
            if (!this.#tab) {
              return;
            }

            this.#uiState.show.add("BoardEditModal");
            break;
          }

          case "jump-to-item": {
            if (!this.#tab) {
              return;
            }

            this.#uiState.show.add("ItemModal");
            break;
          }

          case "delete": {
            if (!this.#tab?.graph || !this.#tab.graph.url) {
              return;
            }

            this.#invokeDeleteEventRouteWith(this.#tab.graph.url);
            break;
          }

          case "duplicate": {
            if (!this.#tab?.graph || !this.#tab.graph.url) {
              return;
            }

            this.#invokeRemixEventRouteWith(this.#tab.graph.url, {
              start: Strings.from("STATUS_GENERIC_WORKING"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_GENERIC"),
            });
            break;
          }

          case "feedback": {
            if (this.clientDeploymentConfiguration.ENABLE_GOOGLE_FEEDBACK) {
              if (this.#feedbackPanelRef.value) {
                this.#feedbackPanelRef.value.open();
              } else {
                console.error(`Feedback panel was not rendered!`);
              }
            } else {
              const feedbackLink =
                this.clientDeploymentConfiguration.FEEDBACK_LINK;
              if (feedbackLink) {
                window.open(feedbackLink, "_blank");
              }
            }
            break;
          }

          case "chat": {
            window.open("https://discord.gg/googlelabs", "_blank");
            break;
          }

          case "history": {
            if (!this.#canvasControllerRef.value) {
              return;
            }

            this.#canvasControllerRef.value.sideNavItem = "edit-history";
            break;
          }

          default: {
            console.log("Action:", select.value);
            break;
          }
        }
      }}
    >
    </bb-ve-header>`;
  }

  /**
   * Finds all assets in the graph, checks if their sharing permissions match
   * that of the main graph, and prompts the user to fix them if needed.
   */
  async #checkGoogleDriveAssetShareStatus(): Promise<void> {
    const graph = this.#tab?.graph;
    if (!graph) {
      console.error(`No graph was found`);
      return;
    }
    const driveAssetFileIds = findGoogleDriveAssetsInGraph(graph);
    if (driveAssetFileIds.length === 0) {
      return;
    }
    if (!graph.url) {
      console.error(`Graph had no URL`);
      return;
    }
    const graphFileId = extractGoogleDriveFileId(graph.url);
    if (!graphFileId) {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      console.error(`No googleDriveClient was provided`);
      return;
    }

    // Retrieve all relevant permissions.
    const rawAssetPermissionsPromise = Promise.all(
      driveAssetFileIds.map(
        async (assetFileId) =>
          [
            assetFileId,
            await googleDriveClient.readPermissions(assetFileId),
          ] as const
      )
    );
    const processedGraphPermissions = (
      await googleDriveClient.readPermissions(graphFileId)
    )
      .filter(
        (permission) =>
          // We're only concerned with how the graph is shared to others.
          permission.role !== "owner"
      )
      .map((permission) => ({
        ...permission,
        // We only care about reading the file, so downgrade "writer",
        // "commenter", and other roles to "reader" (note that all roles are
        // supersets of of "reader", see
        // https://developers.google.com/workspace/drive/api/guides/ref-roles).
        role: "reader",
      }));

    // Look at each asset and determine whether it is missing any of the
    // permissions that the graph has.
    const assetToMissingPermissions = new Map<
      string,
      gapi.client.drive.Permission[]
    >();
    for (const [
      assetFileId,
      assetPermissions,
    ] of await rawAssetPermissionsPromise) {
      const missingPermissions = new Map(
        processedGraphPermissions.map((graphPermission) => [
          stringifyPermission(graphPermission),
          graphPermission,
        ])
      );
      for (const assetPermission of assetPermissions) {
        missingPermissions.delete(
          stringifyPermission({
            ...assetPermission,
            // See note above about "reader".
            role: "reader",
          })
        );
      }
      if (missingPermissions.size > 0) {
        assetToMissingPermissions.set(assetFileId, [
          ...missingPermissions.values(),
        ]);
      }
    }

    // Prompt to sync the permissions.
    if (assetToMissingPermissions.size > 0) {
      const dialog = this.#googleDriveAssetShareDialogRef.value;
      if (!dialog) {
        console.error(`Asset permissions dialog was not rendered`);
        return;
      }
      dialog.open(assetToMissingPermissions);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-main": Main;
  }
}
