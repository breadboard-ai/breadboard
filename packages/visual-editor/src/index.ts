/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import type {
  HarnessProxyConfig,
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
  blank as breadboardBlank,
  EditHistoryCreator,
  FileSystem,
  addSandboxedRunModule,
  hash,
} from "@google-labs/breadboard";
import {
  createFileSystemBackend,
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
import { type GoogleDrivePermission } from "@breadboard-ai/shared-ui/contexts/environment.js";
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
import { AppCatalystApiClient } from "@breadboard-ai/shared-ui/flow-gen/app-catalyst.js";
import {
  FlowGenerator,
  flowGeneratorContext,
} from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";
import { findGoogleDriveAssetsInGraph } from "@breadboard-ai/shared-ui/elements/google-drive/find-google-drive-assets-in-graph.js";
import { stringifyPermission } from "@breadboard-ai/shared-ui/elements/share-panel/share-panel.js";
import { type GoogleDriveAssetShareDialog } from "@breadboard-ai/shared-ui/elements/elements.js";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import {
  type ClientDeploymentConfiguration,
  clientDeploymentConfigurationContext,
} from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { Admin } from "./admin";
import { MainArguments, TosStatus } from "./types/types";
import {
  type BuildInfo,
  buildInfoContext,
} from "@breadboard-ai/shared-ui/contexts/build-info.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { eventRoutes } from "./event-routing/event-routing";
import { keyboardCommands } from "./commands/commands";

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
const TOS_KEY = "tos-status";
const ENVIRONMENT: BreadboardUI.Contexts.Environment = {
  connectionServerUrl: undefined,
  connectionRedirectUrl: "/oauth/",
  environmentName: "dev",
  plugins: {
    input: [
      BreadboardUI.Elements.googleDriveFileIdInputPlugin,
      BreadboardUI.Elements.googleDriveQueryInputPlugin,
    ],
  },
  googleDrive: {
    publishPermissions: JSON.parse(
      import.meta.env.VITE_GOOGLE_DRIVE_PUBLISH_PERMISSIONS || `[]`
    ) as GoogleDrivePermission[],
    publicApiKey: import.meta.env.VITE_GOOGLE_DRIVE_PUBLIC_API_KEY ?? "",
  },
};

if (ENVIRONMENT.googleDrive.publishPermissions.length === 0) {
  console.warn(
    "No googleDrive.publishPermissions were configured." +
      " Publishing with Google Drive will not be supported."
  );
}

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

  #tabSaveId = new Map<
    TabId,
    ReturnType<typeof globalThis.crypto.randomUUID>
  >();
  #tabSaveStatus = new Map<TabId, BreadboardUI.Types.BOARD_SAVE_STATUS>();
  #tabBoardStatus = new Map<TabId, BreadboardUI.Types.STATUS>();
  #boardServers: BoardServer[];
  #settings: SettingsStore | null;
  #secretsHelper: SecretsHelper | null = null;
  #proxy: HarnessProxyConfig[];
  #onShowTooltipBound = this.#onShowTooltip.bind(this);
  #hideTooltipBound = this.#hideTooltip.bind(this);
  #onKeyboardShortCut = this.#onKeyboardShortcut.bind(this);
  #recentBoardStore = RecentBoardStore.instance();
  #recentBoards: BreadboardUI.Types.RecentBoard[] = [];
  #isSaving = false;
  #graphStore!: MutableGraphStore;
  #runStore = getRunStore();
  #fileSystem!: FileSystem;
  #selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  #lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  #lastPointerPosition = { x: 0, y: 0 };
  #tosHtml?: string;
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

  static styles = mainStyles;

  constructor(config: MainArguments) {
    super();

    this.buildInfo = config.buildInfo;
    this.#boardServers = [];
    this.#settings = config.settings ?? null;
    this.#proxy = config.proxy || [];
    this.#tosHtml = config.tosHtml;
    this.#embedHandler = config.embedHandler;

    // This is a big hacky, since we're assigning a value to a constant object,
    // but okay here, because this constant is never re-assigned and is only
    // used by this instance.
    ENVIRONMENT.environmentName = config.environmentName;
    ENVIRONMENT.connectionServerUrl =
      config.connectionServerUrl?.href ||
      import.meta.env.VITE_CONNECTION_SERVER_URL;
    ENVIRONMENT.requiresSignin = config.requiresSignin;

    // Due to https://github.com/lit/lit/issues/4675, context provider values
    // must be done in the constructor.
    this.environment = ENVIRONMENT;
    this.clientDeploymentConfiguration = config.clientDeploymentConfiguration;

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
      publicApiKey: ENVIRONMENT.googleDrive.publicApiKey,
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

    const admin = new Admin(config, ENVIRONMENT, this.googleDriveClient);
    const currentUrl = new URL(window.location.href);

    // Initialization order:
    //  1. Language support.
    //  2. Recent boards.
    //  3. Settings.
    //  4. Runtime.
    //
    // Note: the runtime loads the kits and the initializes the board servers.
    this.#recentBoardStore
      .restore()
      .then((boards) => {
        if (this.#settings) {
          this.settingsHelper = new SettingsHelperImpl(this.#settings);
          admin.settingsHelper = this.settingsHelper;
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
            ENVIRONMENT
          );
        }

        this.#recentBoards = boards;
        return this.#settings?.restore();
      })
      .then(() => {
        this.#fileSystem = createFileSystem({
          env: [...envFromSettings(this.#settings), ...(config.env || [])],
          local: createFileSystemBackend(createEphemeralBlobStore()),
        });
        return Runtime.create({
          graphStore: this.#graphStore,
          runStore: this.#runStore,
          experiments: {},
          environment: this.environment,
          tokenVendor: this.tokenVendor,
          sandbox,
          settings: this.#settings!,
          proxy: this.#proxy,
          fileSystem: this.#fileSystem,
          builtInBoardServers: [createA2Server()],
          kits: addSandboxedRunModule(
            sandbox,
            config.kits || [],
            config.moduleInvocationFilter
          ),
          googleDriveClient: this.googleDriveClient,
          appName: Strings.from("APP_NAME"),
          appSubName: Strings.from("SUB_APP_NAME"),
        });
      })
      .then((runtime) => {
        this.#runtime = runtime;
        this.#uiState = runtime.state.getOrCreateUIState();
        const showTos =
          !!config.enableTos &&
          !!config.tosHtml &&
          localStorage.getItem(TOS_KEY) !== TosStatus.ACCEPTED;
        if (showTos) {
          this.#uiState.show.add("TOS");
        } else {
          this.#uiState.show.delete("TOS");
        }

        admin.runtime = runtime;
        this.#graphStore = runtime.board.getGraphStore();
        this.#boardServers = runtime.board.getBoardServers() || [];

        this.sideBoardRuntime = runtime.sideboards;

        // This is currently used only for legacy graph kits (Agent,
        // Google Drive).
        config.graphStorePreloader?.(this.#graphStore);

        this.sideBoardRuntime.addEventListener("empty", () => {
          this.#uiState.canRunMain = true;
        });
        this.sideBoardRuntime.addEventListener("running", () => {
          this.#uiState.canRunMain = false;
        });

        this.signinAdapter = this.#createSigninAdapter();
        if (
          this.signinAdapter.state === "invalid" ||
          this.signinAdapter.state === "signedout"
        ) {
          return;
        }

        const backendApiEndpoint =
          this.clientDeploymentConfiguration.BACKEND_API_ENDPOINT;
        if (backendApiEndpoint) {
          this.flowGenerator = new FlowGenerator(
            new AppCatalystApiClient(this.signinAdapter, backendApiEndpoint)
          );
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
          (_evt: Runtime.Events.RuntimeBoardEditEvent) => {
            this.requestUpdate();

            const shouldAutoSave = this.#settings?.getItem(
              BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
              "Auto Save Boards"
            ) ?? { value: false };

            if (!shouldAutoSave.value) {
              if (this.#tab) {
                this.#tabSaveStatus.set(
                  this.#tab.id,
                  BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED
                );
              }
              return;
            }

            this.#attemptBoardSave(
              this.#tab,
              Strings.from("STATUS_SAVING_PROJECT"),
              false,
              BOARD_AUTO_SAVE_TIMEOUT
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

              if (
                this.#tab.graph.url &&
                this.#tab.type === Runtime.Types.TabType.URL
              ) {
                await this.#trackRecentBoard(this.#tab.graph.url);
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
              this.#tabBoardStatus.get(evt.tabId) ===
              BreadboardUI.Types.STATUS.STOPPED
            ) {
              return;
            }

            this.#tabBoardStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.STOPPED
            );
            this.#runtime.run.getAbortSignal(evt.tabId)?.abort();
            this.requestUpdate();
          }
        );

        this.#runtime.board.addEventListener(
          Runtime.Events.RuntimeBoardSaveStatusChangeEvent.eventName,
          ({
            status,
            url,
          }: Runtime.Events.RuntimeBoardSaveStatusChangeEvent) => {
            if (!this.#tab || this.#tab.graph.url !== url) return;

            this.#tabSaveStatus.set(this.#tab.id, status);
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
              case "next": {
                // Noop.
                break;
              }

              case "skip": {
                // Noop.
                break;
              }

              case "graphstart": {
                // Noop.
                break;
              }

              case "start": {
                this.#tabBoardStatus.set(
                  evt.tabId,
                  BreadboardUI.Types.STATUS.RUNNING
                );
                break;
              }

              case "end": {
                this.#tabBoardStatus.set(
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
                this.#tabBoardStatus.set(
                  evt.tabId,
                  BreadboardUI.Types.STATUS.STOPPED
                );
                break;
              }

              case "resume": {
                this.#tabBoardStatus.set(
                  evt.tabId,
                  BreadboardUI.Types.STATUS.RUNNING
                );
                break;
              }

              case "pause": {
                this.#tabBoardStatus.set(
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
                  if (signInAdapter.state === "valid") {
                    runner?.run({ [signInKey]: signInAdapter.accessToken() });
                  } else {
                    signInAdapter.refresh().then((token) => {
                      if (!runner?.running()) {
                        runner?.run({
                          [signInKey]: token?.grant?.access_token,
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
                    evt.id
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
                  evt.creator
                );
                clearTimeout(loadingTimeout);
                this.unsnackbar();
              }
            }
          }
        );

        return this.#runtime.router.init();
      })
      .then(async () => {
        if (!config.boardServerUrl) {
          return;
        }

        // Check if we're signed in and return early if not: we're just
        // showing a sign-in screen, no need to continue with initialization.
        const signInAdapter = new SigninAdapter(
          this.tokenVendor,
          this.environment,
          this.settingsHelper
        );
        // Once we've determined the sign-in status, relay it to an embedder.
        this.#embedHandler?.sendToEmbedder({
          type: "home_loaded",
          isSignedIn: signInAdapter.state === "valid",
        });
        if (signInAdapter.state === "signedout") {
          return;
        }

        if (
          config.boardServerUrl.protocol === GoogleDriveBoardServer.PROTOCOL
        ) {
          const gdrive = await getGoogleDriveBoardService();
          if (gdrive) {
            config.boardServerUrl = new URL(gdrive.url);
          }
        }

        let hasMountedBoardServer = false;
        for (const server of this.#boardServers) {
          if (server.url.href === config.boardServerUrl.href) {
            hasMountedBoardServer = true;
            this.#uiState.boardServer = server.name;
            this.#uiState.boardLocation = server.url.href;
            this.boardServer = server;
            break;
          }
        }

        if (!hasMountedBoardServer) {
          console.log(`Mounting server "${config.boardServerUrl.href}" ...`);
          return this.#runtime.board.connect(config.boardServerUrl.href);
        }
      })
      .then((connecting) => {
        if (connecting?.success) {
          console.log(`Connected to server`);
        }
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
          this.#generateBoardFromGraph(blank());
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

    const boardData = await this.#attemptBoardSaveAs(
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
    if (!boardData) return;
    this.#embedHandler?.sendToEmbedder({
      type: "board_id_created",
      id: boardData.url.href,
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

    const isCtrlCommand = BreadboardUI.Utils.isCtrlCommand(evt);

    // Special-case the Save because it's not entirely handled by the runtime
    // yet. When it is we should be able to just call it for the save action and
    // remove the attemptBoardSave call.
    if (evt.key === "s" && isCtrlCommand) {
      evt.preventDefault();
      this.#handlingShortcut = true;
      await this.#attemptBoardSave(
        this.#tab,
        Strings.from("STATUS_PROJECT_SAVED")
      );
      this.#handlingShortcut = false;
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
          await command.do(deps);

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

  async #attemptLogOut() {
    const signinAdapter = this.signinAdapter;
    if (!signinAdapter) {
      return;
    }

    await signinAdapter.signout(() => {
      this.toast(
        Strings.from("STATUS_LOGGED_OUT"),
        BreadboardUI.Events.ToastType.INFORMATION
      );
    });

    // Recreating the signin adapter here will trigger a re-render with the
    // updated state, which will cause us to show the sign-in dialog.
    this.signinAdapter = this.#createSigninAdapter();
  }

  async #clearBoardSave() {
    if (!this.#tab) {
      return;
    }

    const tabToSave = this.#tab;
    this.#tabSaveId.delete(tabToSave.id);
  }

  async #attemptBoardSave(
    tabToSave = this.#tab,
    message = Strings.from("STATUS_PROJECT_SAVED"),
    ackUser = true,
    timeout = 0
  ) {
    if (!tabToSave) {
      return;
    }

    if (tabToSave.readOnly) {
      return;
    }

    const userInitiated = !timeout;
    const boardServerAutosaves =
      !!this.#tab?.boardServer?.capabilities.autosave;
    const useBoardServerEvents = !!this.#tab?.boardServer?.capabilities.events;

    if (timeout !== 0 && !boardServerAutosaves) {
      const saveId = globalThis.crypto.randomUUID();
      this.#tabSaveId.set(tabToSave.id, saveId);
      await new Promise((r) => setTimeout(r, timeout));

      // Check the tab still exists.
      if (!this.#runtime.board.tabs.has(tabToSave.id)) {
        return;
      }

      // If the stored save ID has changed then the user has made a newer change
      // and there is another save pending; therefore, ignore this request.
      const storedSaveId = this.#tabSaveId.get(tabToSave.id);
      if (!storedSaveId || storedSaveId !== saveId) {
        return;
      }

      this.#tabSaveId.delete(tabToSave.id);
    }

    const saveStatus = this.#tabSaveStatus.get(tabToSave.id);
    if (
      saveStatus &&
      saveStatus === BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING
    ) {
      return;
    }

    if (!this.#runtime.board.canSave(tabToSave.id)) {
      return;
    }

    let id;
    if (ackUser) {
      id = this.toast(
        Strings.from("STATUS_SAVING_PROJECT"),
        BreadboardUI.Events.ToastType.PENDING,
        true
      );
    }

    if (!useBoardServerEvents) {
      this.#tabSaveStatus.set(
        tabToSave.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING
      );
      this.requestUpdate();
    }

    try {
      const { result } = await this.#runtime.board.save(
        tabToSave.id,
        userInitiated
      );

      if (!useBoardServerEvents) {
        this.#tabSaveStatus.set(
          tabToSave.id,
          BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED
        );
        this.requestUpdate();
      }

      if (!result) {
        this.#tabSaveStatus.set(
          tabToSave.id,
          BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
        );
        this.requestUpdate();
        return;
      }

      if (ackUser && id) {
        this.toast(
          message,
          BreadboardUI.Events.ToastType.INFORMATION,
          false,
          id
        );
      }
    } catch {
      this.#tabSaveStatus.set(
        tabToSave.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
      );
      this.requestUpdate();
    }
  }

  async #attemptBoardSaveAsAndNavigate(
    boardServerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor,
    ackUser = true,
    ackUserMessage = {
      start: Strings.from("STATUS_SAVING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_SAVED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    },
    creator: EditHistoryCreator
  ) {
    const boardData = await this.#attemptBoardSaveAs(
      boardServerName,
      location,
      fileName,
      graph,
      ackUser,
      ackUserMessage
    );
    if (!boardData) {
      return;
    }
    const { id, url } = boardData;
    this.#runtime.router.go(url.href, this.#uiState.mode, id, creator);
  }

  async #attemptBoardSaveAs(
    boardServerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor,
    ackUser = true,
    ackUserMessage = {
      start: Strings.from("STATUS_SAVING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_SAVED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    }
  ): Promise<{
    id: BreadboardUI.Types.SnackbarUUID | undefined;
    url: URL;
  } | null> {
    if (this.#isSaving) {
      return null;
    }

    let id: BreadboardUI.Types.SnackbarUUID | undefined;
    if (ackUser) {
      id = this.snackbar(
        ackUserMessage.start,
        BreadboardUI.Types.SnackType.INFORMATION,
        [],
        true,
        globalThis.crypto.randomUUID(),
        true
      );
    }

    this.#isSaving = true;
    const { result, error, url } = await this.#runtime.board.saveAs(
      boardServerName,
      location,
      fileName,
      graph
    );
    this.#isSaving = false;

    if (!result || !url) {
      if (ackUser && id) {
        this.snackbar(
          error || ackUserMessage.error,
          BreadboardUI.Types.SnackType.ERROR,
          [],
          false,
          id
        );
      }

      return null;
    }

    return { id: id, url: url };
  }

  async #attemptBoardDelete(
    boardServerName: string,
    url: string,
    isActive: boolean
  ) {
    if (!confirm(Strings.from("QUERY_DELETE_PROJECT"))) {
      return;
    }

    const id = this.snackbar(
      Strings.from("STATUS_DELETING_PROJECT"),
      BreadboardUI.Types.SnackType.PENDING,
      [],
      true
    );

    const { result, error } = await this.#runtime.board.delete(
      boardServerName,
      url
    );

    if (result) {
      this.unsnackbar();
    } else {
      this.snackbar(
        error || Strings.from("ERROR_GENERIC"),
        BreadboardUI.Types.SnackType.ERROR,
        [],
        false,
        id
      );
    }

    if (this.#tab && isActive) {
      this.#runtime.select.deselectAll(
        this.#tab.id,
        this.#runtime.select.generateId()
      );
      this.#runtime.board.closeTab(this.#tab.id);
      this.#removeRecentUrl(url);
    }
  }

  async #attemptRemix(graph: GraphDescriptor, creator: EditHistoryCreator) {
    const remixedGraph = { ...graph, title: `${graph.title} Remix` };

    return this.#attemptBoardCreate(remixedGraph, creator);
  }

  async #attemptBoardCreate(
    graph: GraphDescriptor,
    creator: EditHistoryCreator
  ) {
    const boardServerName = this.#uiState.boardServer;
    const location = this.#uiState.boardLocation;
    const fileName = `${globalThis.crypto.randomUUID()}.bgl.json`;

    await this.#attemptBoardSaveAsAndNavigate(
      boardServerName,
      location,
      fileName,
      graph,
      true,
      {
        start: Strings.from("STATUS_CREATING_PROJECT"),
        end: Strings.from("STATUS_PROJECT_CREATED"),
        error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
      },
      creator
    );
  }

  async #trackRecentBoard(url: string) {
    url = url.replace(window.location.origin, "");
    const currentIndex = this.#recentBoards.findIndex(
      (board) => board.url === url
    );
    if (currentIndex === -1) {
      this.#recentBoards.unshift({
        title: this.#tab?.graph.title ?? Strings.from("TITLE_UNTITLED_PROJECT"),
        url,
      });
    } else {
      const [item] = this.#recentBoards.splice(currentIndex, 1);
      this.#recentBoards.unshift(item);
    }

    if (this.#recentBoards.length > 50) {
      this.#recentBoards.length = 50;
    }

    await this.#recentBoardStore.store(this.#recentBoards);
  }

  async #removeRecentUrl(url: string) {
    url = url.replace(window.location.origin, "");
    const count = this.#recentBoards.length;

    this.#recentBoards = this.#recentBoards.filter(
      (board) => board.url !== url
    );

    if (count === this.#recentBoards.length) {
      return;
    }

    await this.#recentBoardStore.store(this.#recentBoards);
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

  async #handleBoardInfoUpdate(evt: BreadboardUI.Events.BoardInfoUpdateEvent) {
    if (!evt.tabId) {
      this.toast(
        Strings.from("ERROR_GENERIC"),
        BreadboardUI.Events.ToastType.ERROR
      );
      return;
    }

    const tab = this.#runtime.board.getTabById(evt.tabId as TabId);
    if (!tab) {
      this.toast(
        Strings.from("ERROR_NO_PROJECT"),
        BreadboardUI.Events.ToastType.ERROR
      );
      return;
    }

    if (evt.subGraphId) {
      await this.#runtime.edit.updateSubBoardInfo(
        tab,
        evt.subGraphId,
        evt.title,
        evt.version,
        evt.description,
        evt.status as "published" | "draft",
        evt.isTool,
        evt.isComponent
      );
    } else if (evt.moduleId) {
      await this.#runtime.edit.updateModuleInfo(
        tab,
        evt.moduleId,
        evt.title,
        evt.description
      );
    } else {
      this.#runtime.edit.updateBoardInfo(
        tab,
        evt.title,
        evt.version,
        evt.description,
        evt.status,
        evt.isTool,
        evt.isComponent
      );
    }
  }

  #attemptLoad(evt: DragEvent) {
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
        this.#tabBoardStatus.get(this.#tab.id) ??
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

    const showExperimentalComponents: boolean = this.#settings
      ? (this.#settings
          .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
          .items.get("Show Experimental Components")?.value as boolean)
      : false;

    const canSave = this.#tab
      ? this.#runtime.board.canSave(this.#tab.id) && !this.#tab.readOnly
      : false;

    const saveStatus = this.#tab
      ? (this.#tabSaveStatus.get(this.#tab.id) ??
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

  render() {
    if (!this.signinAdapter) {
      return nothing;
    }

    if (
      !this.signinAdapter ||
      (this.signinAdapter.state !== "anonymous" &&
        this.signinAdapter.state !== "valid")
    ) {
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
      ?inert=${renderValues.showingOverlay}
    >
      ${[
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

        if (!this.#secretsHelper) {
          this.#secretsHelper = new SecretsHelper(this.#settings!);
        }

        // Pass the handler everything it may need in order to function. Usually
        // the most important of these are the runtime, originalEvent (which
        // contains the data needed) and the tab so that the runtime can locate
        // the appropriate editor etc.
        const shouldRender = await eventRoute.do({
          originalEvent: evt,
          // TODO: Determine if this is needed.
          proxy: this.#proxy,
          runtime: this.#runtime,
          settings: this.#settings,
          secretsHelper: this.#secretsHelper,
          tab: this.#tab,
          uiState: this.#uiState,
        });

        // Some legacy actions require an update after running, so if the event
        // handler returns with a true, schedule an update.
        if (shouldRender) {
          requestAnimationFrame(() => {
            this.requestUpdate();
          });
        }
      }}
      @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
        this.toast(toastEvent.message, toastEvent.toastType);
      }}
      @dragover=${(evt: DragEvent) => {
        evt.preventDefault();
      }}
      @drop=${(evt: DragEvent) => {
        evt.preventDefault();
        this.#attemptLoad(evt);
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
      .recentBoards=${this.#recentBoards}
      .selectedBoardServer=${this.#uiState.boardServer}
      .selectedLocation=${this.#uiState.boardLocation}
      .boardServers=${this.#boardServers}
      .showAdditionalSources=${renderValues.showExperimentalComponents}
      .filter=${this.#uiState.projectFilter}
      @bbboarddelete=${async (evt: BreadboardUI.Events.BoardDeleteEvent) => {
        const boardServer = this.#runtime.board.getBoardServerForURL(
          new URL(evt.url)
        );
        if (!boardServer) {
          return;
        }

        await this.#attemptBoardDelete(boardServer.name, evt.url, false);
      }}
      @bbgraphboardserverblankboard=${() => {
        this.#attemptBoardCreate(blank(), { role: "user" });
      }}
      @bbgraphboardservergeneratedboard=${(
        evt: BreadboardUI.Events.GraphBoardServerGeneratedBoardEvent
      ) => {
        this.#attemptBoardCreate(evt.graph, evt.creator);
      }}
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
      @bbgraphboardserverremixrequest=${async (
        evt: BreadboardUI.Events.GraphBoardServerRemixRequestEvent
      ) => {
        const graphStore = this.#runtime.board.getGraphStore();
        const addResult = graphStore.addByURL(evt.url, [], {});
        const graph = (await graphStore.getLatest(addResult.mutable)).graph;
        if (graph) {
          await this.#attemptRemix(graph, { role: "user" });
        }
      }}
      @bbgraphboardserverdeleterequest=${async (
        evt: BreadboardUI.Events.GraphBoardServerDeleteRequestEvent
      ) => {
        await this.#attemptBoardDelete(
          evt.boardServerName,
          evt.url,
          evt.isActive
        );
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
      .showGDrive=${this.signinAdapter.state === "valid"}
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
      .signedIn=${this.signinAdapter.state === "valid"}
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
        this.#clearBoardSave();
      }}
      @bbworkspacenewitemcreaterequest=${() => {
        this.#uiState.show.add("NewWorkspaceItemOverlay");
      }}
      @bbboardinfoupdate=${async (
        evt: BreadboardUI.Events.BoardInfoUpdateEvent
      ) => {
        await this.#handleBoardInfoUpdate(evt);
        if (evt.exported !== null) {
          if (evt.subGraphId) {
            await this.#attemptToggleExport(evt.subGraphId, "declarative");
          } else if (evt.moduleId) {
            await this.#attemptToggleExport(evt.moduleId, "imperative");
          }
        }
        this.requestUpdate();
      }}
      @bbgraphboardserverblankboard=${() => {
        this.#attemptBoardCreate(blank(), { role: "user" });
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
      @bbassetedgechange=${async (
        evt: BreadboardUI.Events.AssetEdgeChangeEvent
      ) => {
        await this.#runtime.edit.changeAssetEdge(
          this.#tab,
          evt.changeType,
          evt.assetEdge,
          evt.subGraphId
        );
      }}
      @bbaddnodewithedge=${async (
        evt: BreadboardUI.Events.AddNodeWithEdgeEvent
      ) => {
        if (!this.#tab) {
          return;
        }

        await this.#runtime.edit.addNodeWithEdge(
          this.#tab,
          evt.node,
          evt.edge,
          evt.subGraphId
        );

        this.#runtime.select.selectNodes(
          this.#tab.id,
          this.#runtime.select.generateId(),
          evt.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
          [evt.node.id]
        );
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

        // Trigger a re-render.
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
    return html`<dialog
      id="tos-dialog"
      ${ref((el: Element | undefined) => {
        if (el && this.#uiState.show.has("TOS") && el.isConnected) {
          const dialog = el as HTMLDialogElement;
          if (!dialog.open) {
            dialog.showModal();
          }
        }
      })}
    >
      <form method="dialog">
        <h1>${tosTitle}</h1>
        <div class="tos-content">${unsafeHTML(this.#tosHtml)}</div>
        <div class="controls">
          <button
            @click=${() => {
              this.#uiState.show.delete("TOS");
              localStorage.setItem(TOS_KEY, TosStatus.ACCEPTED);
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

            const graphStore = this.#runtime.board.getGraphStore();
            const addResult = graphStore.addByURL(evt.value, [], {});
            const graph = (await graphStore.getLatest(addResult.mutable)).graph;

            if (graph) {
              await this.#attemptRemix(graph, { role: "user" });
            }
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
      .loadState=${this.#uiState.loadState}
      .canSave=${renderValues.canSave}
      .isMine=${this.#runtime.board.isMine(this.#tab?.graph.url)}
      .saveStatus=${renderValues.saveStatus}
      .showExperimentalComponents=${renderValues.showExperimentalComponents}
      .mode=${this.#uiState.mode}
      @bbremix=${async () => {
        if (!this.#tab?.graph) {
          return;
        }

        await this.#attemptRemix(this.#tab.graph, {
          role: "user",
        });
      }}
      @bbsignout=${async () => {
        await this.#attemptLogOut();
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
            if (!this.#tab || !this.#tab.graph || !this.#tab.graph.url) {
              return;
            }

            const boardServer = this.#runtime.board.getBoardServerForURL(
              new URL(this.#tab.graph.url)
            );
            if (!boardServer) {
              return;
            }

            await this.#attemptBoardDelete(
              boardServer.name,
              this.#tab.graph.url,
              true
            );
            break;
          }

          case "duplicate": {
            if (!this.#tab?.graph) {
              return;
            }

            await this.#attemptRemix(this.#tab.graph, {
              role: "user",
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

function blank() {
  const blankBoard = breadboardBlank();
  const title = Strings.from("TITLE_UNTITLED_PROJECT") || blankBoard.title;
  return { ...breadboardBlank(), title };
}
