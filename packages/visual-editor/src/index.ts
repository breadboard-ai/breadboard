/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import {
  HarnessProxyConfig,
  type HarnessRunner,
  RunConfig,
  RunErrorEvent,
  RunSecretEvent,
} from "@google-labs/breadboard/harness";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { map } from "lit/directives/map.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, HTMLTemplateResult, nothing } from "lit";
import {
  createRunObserver,
  GraphDescriptor,
  BoardServer,
  InspectableRun,
  InspectableRunSequenceEntry,
  NodeConfiguration,
  SerializedRun,
  MutableGraphStore,
  defaultModuleContent,
  createFileSystem,
  createEphemeralBlobStore,
  assetsFromGraphDescriptor,
  blank,
  isInlineData,
  isStoredData,
  EditHistoryCreator,
  envFromGraphDescriptor,
  FileSystem,
} from "@google-labs/breadboard";
import {
  createFileSystemBackend,
  getRunStore,
} from "@breadboard-ai/data-store";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import { addNodeProxyServerConfig } from "./data/node-proxy-servers";
import { provide } from "@lit/context";
import { RecentBoardStore } from "./data/recent-boards";
import { SecretsHelper } from "./utils/secrets-helper";
import { SettingsHelperImpl } from "./utils/settings-helper";
import { styles as mainStyles } from "./index.styles.js";
import * as Runtime from "./runtime/runtime.js";
import {
  TabId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "./runtime/types";
import { createPastRunObserver } from "./utils/past-run-observer";
import { getRunNodeConfig } from "./utils/run-node";
import {
  createTokenVendor,
  TokenVendor,
} from "@breadboard-ai/connection-client";

import { sandbox } from "./sandbox";
import {
  GraphIdentifier,
  GraphTheme,
  InputValues,
  LLMContent,
  Module,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import { KeyboardCommand, KeyboardCommandDeps } from "./commands/types";
import {
  CopyCommand,
  CutCommand,
  DeleteCommand,
  GroupCommand,
  PasteCommand,
  SelectAllCommand,
  UngroupCommand,
} from "./commands/commands";
import {
  SigninAdapter,
  signinAdapterContext,
} from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { sideBoardRuntime } from "@breadboard-ai/shared-ui/contexts/side-board-runtime.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { OverflowAction } from "@breadboard-ai/shared-ui/types/types.js";
import { MAIN_BOARD_ID } from "@breadboard-ai/shared-ui/constants/constants.js";
import { createA2Server } from "@breadboard-ai/a2";
import { envFromSettings } from "./utils/env-from-settings";

const STORAGE_PREFIX = "bb-main";
const LOADING_TIMEOUT = 250;

export type MainArguments = {
  boards?: BreadboardUI.Types.Board[];
  providers?: BoardServer[]; // Deprecated.
  /** When specified, this will be the only available board service. */
  forcedBoardServiceName?: string;
  settings?: SettingsStore;
  proxy?: HarnessProxyConfig[];
  version?: string;
  /**
   * The Git hash of the current commit.
   */
  gitCommitHash?: string;
  languagePack?: string;
  /**
   * The URL of the board server with which this editor instance
   * is associated.
   */
  boardServerUrl?: URL;
  /**
   * The URL of the connection server with which this editor instance
   * is associated.
   */
  connectionServerUrl?: URL;
  /**
   * Whether or not this instance of requires sign in.
   */
  requiresSignin?: boolean;

};

type SaveAsConfiguration = {
  title: string;
  graph: GraphDescriptor;
  isNewBoard: boolean;
};

type BoardOverlowMenuConfiguration = {
  tabId: TabId;
  x: number;
  y: number;
};

type UserOverflowMenuConfiguration = {
  x: number;
  y: number;
};

type BoardItemsOverflowMenuConfiguration = {
  x: number;
  y: number;
};

const generatedUrls = new Set<string>();

const ENVIRONMENT: BreadboardUI.Contexts.Environment = {
  connectionServerUrl: undefined,
  connectionRedirectUrl: "/oauth/",
  plugins: {
    input: [
      BreadboardUI.Elements.googleDriveFileIdInputPlugin,
      BreadboardUI.Elements.googleDriveQueryInputPlugin,
    ],
  },
};

const BOARD_AUTO_SAVE_TIMEOUT = 1_500;

@customElement("bb-main")
export class Main extends LitElement {
  @state()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @state()
  accessor showNav = false;

  @state()
  accessor showBoardServerAddOverlay = false;

  @state()
  accessor showHistory = false;

  @state()
  accessor showFirstRun = false;

  @state()
  accessor showWelcomePanel = false;

  @state()
  accessor showBoardReferenceMarkers = false;

  @state()
  accessor showOpenBoardOverlay = false;

  @state()
  accessor showCommandPalette = false;

  @state()
  accessor showModulePalette = false;

  @state()
  accessor showNewWorkspaceItemOverlay = false;

  @state()
  accessor showBoardOverflowMenu = false;
  #boardOverflowMenuConfiguration: BoardOverlowMenuConfiguration | null = null;

  @state()
  accessor showUserOverflowMenu = false;
  #userOverflowMenuConfiguration: UserOverflowMenuConfiguration | null = null;

  @state()
  accessor showSaveAsDialog = false;
  #saveAsState: SaveAsConfiguration | null = null;

  @state()
  accessor showNodeConfigurator = false;
  #nodeConfiguratorData: BreadboardUI.Types.NodePortConfiguration | null = null;
  #nodeConfiguratorRef: Ref<BreadboardUI.Elements.NodeConfigurationOverlay> =
    createRef();

  @state()
  accessor showCommentEditor = false;
  #commentValueData: BreadboardUI.Types.CommentConfiguration | null = null;

  @state()
  accessor showBoardItemsOverflowMenu = false;
  #boardItemsOverflowMenuConfiguration: BoardItemsOverflowMenuConfiguration | null =
    null;

  @state()
  accessor boardEditOverlayInfo: {
    tabId: TabId;
    title: string;
    version: string;
    description: string;
    published: boolean | null;
    private: boolean;
    exported: boolean;
    isTool: boolean | null;
    isComponent: boolean | null;
    subGraphId: string | null;
    moduleId: string | null;
    x: number | null;
    y: number | null;
  } | null = null;

  @state()
  accessor showSettingsOverlay = false;

  @state()
  accessor toasts = new Map<
    string,
    {
      message: string;
      type: BreadboardUI.Events.ToastType;
      persistent: boolean;
    }
  >();

  @provide({ context: BreadboardUI.Contexts.environmentContext })
  accessor environment: BreadboardUI.Contexts.Environment;

  @provide({ context: BreadboardUI.Elements.tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  accessor settingsHelper!: SettingsHelperImpl;

  @provide({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime;

  @provide({ context: signinAdapterContext })
  accessor signinAdapter!: SigninAdapter;

  @state()
  accessor selectedBoardServer = "Browser Storage";

  @state()
  accessor selectedLocation = "Browser Storage";

  @state()
  accessor previewOverlayURL: URL | null = null;

  @state()
  accessor boardServerNavState: string | null = null;

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  @state()
  accessor canRun = true;

  @property()
  accessor tab: Runtime.Types.Tab | null = null;

  #uiRef: Ref<BreadboardUI.Elements.UI> = createRef();
  #tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  #boardId = 0;
  #boardPendingSave = false;
  #tabSaveId = new Map<
    TabId,
    ReturnType<typeof globalThis.crypto.randomUUID>
  >();
  #tabSaveStatus = new Map<TabId, BreadboardUI.Types.BOARD_SAVE_STATUS>();
  #tabBoardStatus = new Map<TabId, BreadboardUI.Types.STATUS>();
  #tabLoadStatus = new Map<TabId, BreadboardUI.Types.BOARD_LOAD_STATUS>();
  #boardServers: BoardServer[];
  #forcedBoardServiceName?: string;
  #settings: SettingsStore | null;
  #secretsHelper: SecretsHelper | null = null;
  /**
   * Optional proxy configuration for the board.
   * This is used to provide additional proxied nodes.
   */
  #proxy: HarnessProxyConfig[];
  #onShowTooltipBound = this.#onShowTooltip.bind(this);
  #hideTooltipBound = this.#hideTooltip.bind(this);
  #hidePalettesAndTooltipBound = this.#hidePalettesAndTooltip.bind(this);
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #downloadRunBound = this.#downloadRun.bind(this);
  #confirmUnloadWithUserFirstIfNeededBound =
    this.#confirmUnloadWithUserFirstIfNeeded.bind(this);
  #version = "dev";
  #gitCommitHash = "dev";
  #recentBoardStore = RecentBoardStore.instance();
  #recentBoards: BreadboardUI.Types.RecentBoard[] = [];
  #isSaving = false;
  #graphStore!: MutableGraphStore;
  #runStore = getRunStore();
  #fileSystem!: FileSystem;
  #selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  #lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  #lastPointerPosition = { x: 0, y: 0 };

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

  #globalCommands: BreadboardUI.Types.Command[] = [
    {
      title: Strings.from("COMMAND_OPEN_PROJECT"),
      name: "open-board",
      icon: "open",
      callback: () => {
        this.showOpenBoardOverlay = true;
      },
    },
    {
      title: Strings.from("COMMAND_SAVE_PROJECT"),
      name: "save-board",
      icon: "save",
      callback: () => {
        this.#attemptBoardSave();
      },
    },
    {
      title: Strings.from("COMMAND_SAVE_PROJECT_AS"),
      name: "save-board-as",
      icon: "save",
      callback: () => {
        this.showSaveAsDialog = true;
      },
    },
    {
      title: Strings.from("COMMAND_EDIT_PROJECT_INFORMATION"),
      name: "edit-board-information",
      icon: "edit",
      callback: () => {
        this.#showBoardEditOverlay(
          this.tab,
          100,
          50,
          this.tab?.subGraphId ?? null,
          null
        );
      },
    },
    {
      title: Strings.from("COMMAND_OPEN_MODULE"),
      name: "open-module",
      icon: "open",
      callback: () => {
        this.showModulePalette = true;
      },
    },
    {
      title: Strings.from("COMMAND_CREATE_MODULE"),
      icon: "add-circle",
      name: "create-module",
      callback: () => {
        const moduleId = BreadboardUI.Utils.getModuleId();
        if (!moduleId) {
          return;
        }

        this.#attemptModuleCreate(moduleId);
      },
    },
  ];
  #viewCommandNamespace = "default";
  #viewCommands = new Map<string, BreadboardUI.Types.Command[]>();

  #runtime!: Runtime.RuntimeInstance;

  static styles = mainStyles;
  proxyFromUrl: string | undefined;

  #initialize: Promise<void>;
  constructor(config: MainArguments) {
    super();

    // This is a big hacky, since we're assigning a value to a constant object,
    // but okay here, because this constant is never re-assigned and is only
    // used by this instance.
    ENVIRONMENT.connectionServerUrl =
      config.connectionServerUrl?.href ||
      import.meta.env.VITE_CONNECTION_SERVER_URL;
    ENVIRONMENT.requiresSignin = config.requiresSignin;

    // Due to https://github.com/lit/lit/issues/4675, context provider values
    // must be done in the constructor.
    this.environment = ENVIRONMENT;

    const boardServerLocation = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-board-server`
    );
    if (boardServerLocation) {
      const [boardServer, location] = boardServerLocation.split("::");

      if (boardServer && location) {
        this.selectedBoardServer = boardServer;
        this.selectedLocation = location;
      }
    }

    this.#version = config.version || "dev";
    this.#gitCommitHash = config.gitCommitHash || "unknown";
    this.#boardServers = [];
    this.#settings = config.settings || null;
    this.#proxy = config.proxy || [];
    this.#forcedBoardServiceName = config.forcedBoardServiceName;
    console.log('vvv forcedBoardServiceName', this.#forcedBoardServiceName);
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
        ENVIRONMENT
      );
    }

    const currentUrl = new URL(window.location.href);
    const firstRunFromUrl = currentUrl.searchParams.get("firstrun");

    if (firstRunFromUrl && firstRunFromUrl === "true") {
      this.showFirstRun = true;
    }

    const proxyFromUrl = currentUrl.searchParams.get("python_proxy");
    if (proxyFromUrl) {
      console.log("Setting python_proxy: %s", proxyFromUrl);
      this.proxyFromUrl = proxyFromUrl;
    }

    const stopCurrentRunIfActive = (tabId: TabId | null) => {
      if (!tabId) {
        return;
      }

      if (this.tab?.id !== tabId) {
        return;
      }

      if (
        this.#tabBoardStatus.get(tabId) === BreadboardUI.Types.STATUS.STOPPED
      ) {
        return;
      }

      this.#tabBoardStatus.set(tabId, BreadboardUI.Types.STATUS.STOPPED);
      this.#runtime.run.getAbortSignal(tabId)?.abort();
    };

    // Initialization order:
    //  1. Language support.
    //  2. Recent boards.
    //  3. Settings.
    //  4. Runtime.
    //
    // Note: the runtime loads the kits and the initializes the board servers.
    this.#initialize = this.#recentBoardStore
      .restore()
      .then((boards) => {
        this.#recentBoards = boards;
        return this.#settings?.restore();
      })
      .then(() => {
        this.#fileSystem = createFileSystem({
          env: envFromSettings(this.#settings),
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
        });
      })
      .then((runtime) => {
        this.#runtime = runtime;
        this.#graphStore = runtime.board.getGraphStore();
        this.#boardServers = runtime.board.getBoardServers(this.#forcedBoardServiceName) || [];

        this.sideBoardRuntime = runtime.sideboards;

        this.sideBoardRuntime.addEventListener("empty", () => {
          this.canRun = true;
        });
        this.sideBoardRuntime.addEventListener("running", () => {
          this.canRun = false;
        });

        this.signinAdapter = new BreadboardUI.Utils.SigninAdapter(
          this.tokenVendor,
          this.environment,
          this.settingsHelper
        );

        this.#graphStore.addEventListener("update", (evt) => {
          const { mainGraphId } = evt;
          const current = this.tab?.mainGraphId;
          this.graphStoreUpdateId++;
          if (
            !current ||
            (mainGraphId !== current && !evt.affectedGraphs.includes(current))
          ) {
            return;
          }
          this.graphTopologyUpdateId++;
        });

        this.#runtime.edit.addEventListener(
          Runtime.Events.RuntimeBoardEnhanceEvent.eventName,
          async (evt: Runtime.Events.RuntimeBoardEnhanceEvent) => {
            if (!this.#nodeConfiguratorData) {
              return;
            }

            await this.#setNodeDataForConfiguration(
              this.#nodeConfiguratorData,
              evt.configuration
            );

            this.requestUpdate();
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
          Runtime.Events.RuntimeBoardEditEvent.eventName,
          (_evt: Runtime.Events.RuntimeBoardEditEvent) => {
            this.requestUpdate();

            // TODO: Bring this back once we have stable runs.
            // const observers = this.#runtime.run.getObservers(evt.tabId);
            // if (observers) {
            //   if (!evt.visualOnly) {
            //     observers.topGraphObserver?.updateAffected(evt.affectedNodes);
            //     observers.runObserver?.replay(evt.affectedNodes);
            //   }
            // }

            const shouldAutoSave = this.#settings?.getItem(
              BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
              "Auto Save Boards"
            ) ?? { value: false };

            if (!shouldAutoSave.value) {
              if (this.tab) {
                this.#tabSaveStatus.set(
                  this.tab.id,
                  BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED
                );
              }
              return;
            }

            this.#attemptBoardSave(
              this.tab,
              Strings.from("STATUS_SAVING_PROJECT"),
              false,
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
            if (this.tab) {
              this.#tabLoadStatus.set(
                this.tab.id,
                BreadboardUI.Types.BOARD_LOAD_STATUS.ERROR
              );
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
          Runtime.Events.RuntimeBoardServerChangeEvent.eventName,
          (evt: Runtime.Events.RuntimeBoardServerChangeEvent) => {
            this.showBoardServerAddOverlay = false;
            this.#boardServers = runtime.board.getBoardServers() || [];

            if (evt.connectedBoardServerName && evt.connectedBoardServerURL) {
              this.selectedBoardServer = evt.connectedBoardServerName;
              this.selectedLocation = evt.connectedBoardServerURL;
            }

            this.requestUpdate();
          }
        );

        this.#runtime.board.addEventListener(
          Runtime.Events.RuntimeTabChangeEvent.eventName,
          async (evt: Runtime.Events.RuntimeTabChangeEvent) => {
            this.tab = this.#runtime.board.currentTab;
            this.#maybeShowWelcomePanel();

            if (this.tab) {
              // If there is a TGO in the tab change event, honor it and populate a
              // run with it before switching to the tab proper.
              if (evt.topGraphObserver) {
                this.#runtime.run.create(
                  this.tab,
                  evt.topGraphObserver,
                  evt.chatController,
                  evt.runObserver
                );
              }

              if (
                this.tab.graph.url &&
                this.tab.type === Runtime.Types.TabType.URL
              ) {
                this.#updatePageURL();
                await this.#trackRecentBoard(this.tab.graph.url);
              }

              if (this.tab.graph.title) {
                this.#setPageTitle(this.tab.graph.title);
              }

              this.#runtime.select.refresh(
                this.tab.id,
                this.#runtime.util.createWorkspaceSelectionChangeId()
              );
            } else {
              this.#clearTabParams();
              this.#setPageTitle(null);
            }
          }
        );

        this.#runtime.board.addEventListener(
          Runtime.Events.RuntimeModuleChangeEvent.eventName,
          () => {
            this.#updatePageURL();
            this.requestUpdate();
          }
        );

        this.#runtime.board.addEventListener(
          Runtime.Events.RuntimeWorkspaceItemChangeEvent.eventName,
          () => {
            this.#updatePageURL();
            this.requestUpdate();
          }
        );

        this.#runtime.board.addEventListener(
          Runtime.Events.RuntimeTabCloseEvent.eventName,
          async (evt: Runtime.Events.RuntimeTabCloseEvent) => {
            stopCurrentRunIfActive(evt.tabId);

            await this.#confirmSaveWithUserFirstIfNeeded();
            this.#updatePageURL();
            this.requestUpdate();
          }
        );

        this.#runtime.run.addEventListener(
          Runtime.Events.RuntimeBoardRunEvent.eventName,
          (evt: Runtime.Events.RuntimeBoardRunEvent) => {
            if (this.tab && evt.tabId === this.tab.id) {
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
                this.#handleSecretEvent(
                  evt.runEvt as RunSecretEvent,
                  evt.harnessRunner
                );
              }
            }
          }
        );

        return this.#runtime.board.createTabsFromURL(currentUrl);
      })
      .then(() => {
        if (!config.boardServerUrl) {
          return;
        }

        let hasMountedBoardServer = false;
        for (const server of this.#boardServers) {
          if (server.url.href === config.boardServerUrl.href) {
            hasMountedBoardServer = true;
            this.selectedBoardServer = server.name;
            this.selectedLocation = server.url.href;
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
    window.addEventListener("pointerdown", this.#hidePalettesAndTooltipBound);
    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("bbrundownload", this.#downloadRunBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.removeEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.removeEventListener(
      "pointerdown",
      this.#hidePalettesAndTooltipBound
    );
    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("bbrundownload", this.#downloadRunBound);
  }

  #handleSecretEvent(event: RunSecretEvent, runner?: HarnessRunner) {
    const { keys } = event.data;
    if (this.#secretsHelper) {
      this.#secretsHelper.setKeys(keys);
      if (this.#secretsHelper.hasAllSecrets()) {
        runner?.run(this.#secretsHelper.getSecrets());
      } else {
        const result = SecretsHelper.allKeysAreKnown(this.#settings!, keys);
        if (result) {
          runner?.run(result);
        }
      }
    } else {
      const result = SecretsHelper.allKeysAreKnown(this.#settings!, keys);
      if (result) {
        runner?.run(result);
      } else {
        this.#secretsHelper = new SecretsHelper(this.#settings!);
        this.#secretsHelper.setKeys(keys);
      }
    }
  }

  #maybeShowWelcomePanel() {
    this.showWelcomePanel = this.tab === null;

    if (!this.showWelcomePanel) {
      return;
    }
    this.#hideAllOverlays();
  }

  #hideAllOverlays() {
    this.boardEditOverlayInfo = null;
    this.showSettingsOverlay = false;
    this.showBoardServerAddOverlay = false;
    this.showSaveAsDialog = false;
    this.showNodeConfigurator = false;
    this.showCommentEditor = false;
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

  #hidePalettesAndTooltip() {
    this.#hideCommandPalette();
    this.#hideModulePalette();
    this.#hideTooltip();
  }

  #hideCommandPalette() {
    this.showCommandPalette = false;
  }

  #hideModulePalette() {
    this.showModulePalette = false;
  }

  #hideTooltip() {
    if (!this.#tooltipRef.value) {
      return;
    }

    this.#tooltipRef.value.visible = false;
  }

  #updatePageURL() {
    const url = this.#runtime.board.createURLFromTabs();
    const decodedUrl = decodeURIComponent(url.href);
    window.history.replaceState(null, "", decodedUrl);
  }

  #setBoardPendingSaveState(boardPendingSave: boolean) {
    if (boardPendingSave === this.#boardPendingSave) {
      return;
    }

    this.#boardPendingSave = boardPendingSave;
    if (this.#boardPendingSave) {
      window.addEventListener(
        "beforeunload",
        this.#confirmUnloadWithUserFirstIfNeededBound
      );
    } else {
      window.removeEventListener(
        "beforeunload",
        this.#confirmUnloadWithUserFirstIfNeededBound
      );
    }
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

  #commands: Map<string[], KeyboardCommand> = new Map([
    [DeleteCommand.keys, DeleteCommand],
    [SelectAllCommand.keys, SelectAllCommand],
    [CopyCommand.keys, CopyCommand],
    [CutCommand.keys, CutCommand],
    [PasteCommand.keys, PasteCommand],
    [GroupCommand.keys, GroupCommand],
    [UngroupCommand.keys, UngroupCommand],
  ]);

  #handlingKey = false;
  async #onKeyDown(evt: KeyboardEvent) {
    if (this.#handlingKey) {
      return;
    }

    if (!this.tab) {
      return;
    }

    // Check if there's an input preference before actioning any main keyboard
    // command.
    if (
      evt.composedPath().some((target) => this.#receivesInputPreference(target))
    ) {
      return;
    }

    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

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
      tab: this.tab,
      originalEvent: evt,
      pointerLocation: this.#lastPointerPosition,
    } as const;

    for (const [keys, command] of this.#commands) {
      if (keys.includes(key) && command.willHandle(evt)) {
        evt.preventDefault();
        evt.stopImmediatePropagation();

        this.#handlingKey = true;

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

        this.#handlingKey = false;
      }
    }

    if (evt.key === "p" && isCtrlCommand) {
      evt.preventDefault();
      evt.stopImmediatePropagation();

      if (evt.shiftKey) {
        this.showCommandPalette = true;
      } else {
        this.showModulePalette = true;
      }
    }

    if (evt.key === "o" && isCtrlCommand) {
      evt.preventDefault();
      evt.stopImmediatePropagation();

      this.showOpenBoardOverlay = true;
    }

    if (evt.key === "s" && isCtrlCommand) {
      evt.preventDefault();

      if (evt.shiftKey) {
        this.showSaveAsDialog = true;
        return;
      }

      let saveMessage = Strings.from("STATUS_PROJECT_SAVED");
      if (this.#nodeConfiguratorRef.value && this.#nodeConfiguratorData) {
        this.#nodeConfiguratorRef.value.processData();
        saveMessage = Strings.from("STATUS_PROJECT_CONFIGURATION_SAVED");
      }

      this.#attemptBoardSave(this.tab, saveMessage);
      return;
    }

    if (evt.key === "z" && isCtrlCommand) {
      const isFocusedOnRenderer = evt
        .composedPath()
        .find((target) => target instanceof BreadboardUI.Elements.Renderer);

      if (!isFocusedOnRenderer) {
        return;
      }

      if (evt.shiftKey) {
        this.#runtime.edit.redo(this.tab);
        return;
      }

      this.#runtime.edit.undo(this.tab);
      return;
    }
  }

  async #downloadRun() {
    if (!this.tab) {
      return;
    }

    const observers = this.#runtime.run.getObservers(this.tab.id);
    if (!observers) {
      return;
    }

    const currentRun = (await observers.runObserver?.runs())?.at(0);
    if (!currentRun) {
      return;
    }

    const serializedRun = await currentRun.serialize?.();
    if (!serializedRun) {
      return;
    }

    const data = JSON.stringify(serializedRun, null, 2);
    const fileName = `run-${new Date().toISOString()}.json`;
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );

    const anchor = document.createElement("a");
    anchor.download = fileName;
    anchor.href = url;
    anchor.click();
  }

  async #selectRun(evt: BreadboardUI.Events.NodeActivitySelectedEvent) {
    if (!this.tab) {
      return;
    }

    const observers = this.#runtime.run.getObservers(this.tab.id);
    if (!observers) {
      return;
    }

    const currentRun = (await observers.runObserver?.runs())?.at(0);
    if (!currentRun) {
      return;
    }

    const event = currentRun.getEventById(evt.runId);

    if (!event) {
      console.warn(
        "The `bbrunselect` was received but the event was not found."
      );
      return;
    }

    if (event.type !== "node") {
      console.warn(
        "The `bbrunselect` was received but the event is not a node."
      );
      return;
    }

    const run = event.runs[0];
    if (!run) {
      console.warn(
        "The `bbrunselect` was received but the run was not found in the event."
      );
      return;
    }

    const topGraphObserver =
      await BreadboardUI.Utils.TopGraphObserver.fromRun(run);

    if (!topGraphObserver) {
      return;
    }

    const runGraph = topGraphObserver.current()?.graph ?? null;
    if (runGraph) {
      runGraph.title = evt.nodeTitle;
      this.#runtime.board.createTabFromRun(
        runGraph,
        topGraphObserver,
        createPastRunObserver(run),
        true
      );
    }
  }

  async #attemptLogOut() {
    const signInAdapter = new SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );

    await signInAdapter.signout(() => {
      this.toast(
        Strings.from("STATUS_LOGGED_OUT"),
        BreadboardUI.Events.ToastType.INFORMATION
      );
    });
  }

  async #attemptBoardStart() {
    const url = this.tab?.graph?.url;
    if (!url) {
      return;
    }

    const graph = this.tab?.graph;

    this.#runtime.edit.sideboards.discardTasks();

    this.#runBoard(
      addNodeProxyServerConfig(
        this.#proxy,
        {
          url,
          runner: graph,
          diagnostics: true,
          kits: [], // The kits are added by the runtime.
          loader: this.#runtime.board.getLoader(),
          graphStore: this.#graphStore,
          fileSystem: this.#fileSystem.createRunFileSystem({
            graphUrl: url,
            env: envFromGraphDescriptor(this.#fileSystem.env(), graph),
            assets: assetsFromGraphDescriptor(graph),
          }),
          inputs: BreadboardUI.Data.inputsFromSettings(this.#settings),
          interactiveSecrets: true,
        },
        this.#settings,
        this.proxyFromUrl,
        await this.#getProxyURL(url)
      )
    );
  }

  async #attemptBoardStop(clearLastRun = false) {
    const tabId = this.tab?.id ?? null;
    const abortController = this.#runtime.run.getAbortSignal(tabId);
    if (!abortController) {
      return;
    }

    abortController.abort(Strings.from("STATUS_GENERIC_RUN_STOPPED"));
    const runner = this.#runtime.run.getRunner(tabId);
    if (runner?.running()) {
      await runner?.run();
    }

    if (clearLastRun) {
      await this.#runtime.run.clearLastRun(tabId, this.tab?.graph.url);
    }

    requestAnimationFrame(() => {
      this.requestUpdate();
    });
  }

  async #clearBoardSave() {
    if (!this.tab) {
      return;
    }

    const tabToSave = this.tab;
    this.#tabSaveId.delete(tabToSave.id);
  }

  async #attemptBoardSave(
    tabToSave = this.tab,
    message = Strings.from("STATUS_PROJECT_SAVED"),
    ackUser = true,
    showSaveAsIfNeeded = true,
    timeout = 0
  ) {
    if (!tabToSave) {
      return;
    }

    if (tabToSave.readOnly) {
      return;
    }

    if (timeout !== 0) {
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
      if (showSaveAsIfNeeded) {
        this.showSaveAsDialog = true;
      }
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

    this.#tabSaveStatus.set(
      tabToSave.id,
      BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING
    );
    this.requestUpdate();

    try {
      const { result } = await this.#runtime.board.save(tabToSave.id);

      this.#tabSaveStatus.set(
        tabToSave.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED
      );
      this.requestUpdate();

      if (!result) {
        this.#tabSaveStatus.set(
          tabToSave.id,
          BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
        );
        this.requestUpdate();
        return;
      }

      this.#setBoardPendingSaveState(false);
      if (ackUser && id) {
        this.toast(
          message,
          BreadboardUI.Events.ToastType.INFORMATION,
          false,
          id
        );
      }
    } catch (err) {
      this.#tabSaveStatus.set(
        tabToSave.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
      );
      this.requestUpdate();
    }
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
    },
    creator: EditHistoryCreator
  ) {
    if (this.#isSaving) {
      return;
    }

    let id: ReturnType<typeof this.toast> | undefined;

    if (ackUser) {
      id = this.toast(
        ackUserMessage.start,
        BreadboardUI.Events.ToastType.PENDING,
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
        this.toast(
          error || ackUserMessage.error,
          BreadboardUI.Events.ToastType.ERROR,
          false,
          id
        );
      }

      return;
    }

    this.#setBoardPendingSaveState(false);
    this.#persistBoardServerAndLocation(boardServerName, location);

    this.#attemptBoardLoad(
      new BreadboardUI.Events.StartEvent(url.href, undefined, creator)
    );

    if (ackUser && id) {
      this.toast(
        ackUserMessage.end,
        BreadboardUI.Events.ToastType.INFORMATION,
        false,
        id
      );
    }
  }

  async #attemptBoardDelete(
    boardServerName: string,
    url: string,
    isActive: boolean
  ) {
    if (!confirm(Strings.from("QUERY_DELETE_PROJECT"))) {
      return;
    }

    const id = this.toast(
      Strings.from("STATUS_DELETING_PROJECT"),
      BreadboardUI.Events.ToastType.PENDING,
      true
    );

    const { result, error } = await this.#runtime.board.delete(
      boardServerName,
      url
    );
    if (result) {
      this.toast(
        Strings.from("STATUS_PROJECT_DELETED"),
        BreadboardUI.Events.ToastType.INFORMATION,
        false,
        id
      );
    } else {
      this.toast(
        error || Strings.from("ERROR_GENERIC"),
        BreadboardUI.Events.ToastType.ERROR,
        false,
        id
      );
    }

    if (this.tab && isActive) {
      this.#runtime.select.deselectAll(
        this.tab.id,
        this.#runtime.select.generateId()
      );
      this.#runtime.board.closeTab(this.tab.id);
      this.#removeRecentUrl(url);
    }

    this.boardServerNavState = globalThis.crypto.randomUUID();
  }

  async #attemptBoardCreate(
    graph: GraphDescriptor,
    creator: EditHistoryCreator
  ) {
    const boardServerName = this.selectedBoardServer;
    const location = this.selectedLocation;
    const fileName = `${globalThis.crypto.randomUUID()}.bgl.json`;

    await this.#attemptBoardSaveAs(
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

  #setPageTitle(title: string | null) {
    const suffix = `${Strings.from("APP_NAME")} - ${Strings.from("SUB_APP_NAME")}`;
    if (title) {
      window.document.title = `${title} - ${suffix}`;
      return;
    }

    window.document.title = suffix;
  }

  async #trackRecentBoard(url: string) {
    url = url.replace(window.location.origin, "");
    const currentIndex = this.#recentBoards.findIndex(
      (board) => board.url === url
    );
    if (currentIndex === -1) {
      this.#recentBoards.unshift({
        title: this.tab?.graph.title ?? Strings.from("TITLE_UNTITLED_PROJECT"),
        url,
      });
    } else {
      const [item] = this.#recentBoards.splice(currentIndex, 1);
      this.#recentBoards.unshift(item);
    }

    if (this.#recentBoards.length > 5) {
      this.#recentBoards.length = 5;
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

  async #runBoard(config: RunConfig, history?: InspectableRunSequenceEntry[]) {
    if (!this.tab) {
      console.error("Unable to run board, no active tab");
      return;
    }

    this.#runtime.run.runBoard(this.tab, config, history);
  }

  #clearTabParams() {
    const pageUrl = new URL(window.location.href);
    const tabs = [...pageUrl.searchParams].filter(([id]) =>
      id.startsWith("tab")
    );

    for (const [id] of tabs) {
      pageUrl.searchParams.delete(id);
    }

    window.history.replaceState(null, "", pageUrl);
  }

  #setUrlParam(param: string, value: string | null) {
    const pageUrl = new URL(window.location.href);
    if (value === null) {
      pageUrl.searchParams.delete(param);
    } else {
      pageUrl.searchParams.set(param, value);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  untoast(id: string | undefined) {
    if (!id) {
      return;
    }

    this.toasts.delete(id);
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

    this.toasts.set(id, { message, type, persistent });
    this.requestUpdate();

    return id;
  }

  async #getProxyURL(urlString: string): Promise<string | null> {
    const url = new URL(urlString, window.location.href);
    for (const boardServer of this.#boardServers) {
      const proxyURL = await boardServer.canProxy?.(url);
      if (proxyURL) {
        return proxyURL;
      }
    }
    return null;
  }

  #confirmUnloadWithUserFirstIfNeeded(evt: Event) {
    if (!this.#boardPendingSave) {
      return;
    }

    evt.returnValue = true;
    return true;
  }

  async #confirmSaveWithUserFirstIfNeeded() {
    if (!this.#boardPendingSave) {
      return;
    }

    if (!this.tab?.graph || !this.tab?.graph.url) {
      return;
    }

    try {
      const url = new URL(this.tab?.graph.url, window.location.href);
      const boardServer = this.#runtime.board.getBoardServerForURL(url);
      if (!boardServer) {
        return;
      }

      const capabilities = boardServer.canProvide(url);
      if (!capabilities || !capabilities.save) {
        return;
      }
    } catch (err) {
      // Likely an error with the URL.
      return;
    }

    if (!confirm(Strings.from("QUERY_SAVE_PROJECT"))) {
      return;
    }

    return this.#attemptBoardSave();
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

  #persistBoardServerAndLocation(boardServerName: string, location: string) {
    this.selectedBoardServer = boardServerName;
    this.selectedLocation = location;

    globalThis.sessionStorage.setItem(
      `${STORAGE_PREFIX}-board-server`,
      `${boardServerName}::${location}`
    );
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
        const projectState = this.#runtime.state.getOrCreate(
          this.tab?.mainGraphId,
          this.#runtime.edit.getEditor(this.tab)
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

  async #attemptBoardLoad(evt: BreadboardUI.Events.StartEvent) {
    if (evt.url) {
      let id;
      const loadingTimeout = setTimeout(() => {
        id = this.toast(
          Strings.from("STATUS_GENERIC_LOADING"),
          BreadboardUI.Events.ToastType.PENDING,
          true
        );
      }, LOADING_TIMEOUT);

      await this.#runtime.board.createTabFromURL(
        evt.url,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        evt.creator
      );
      clearTimeout(loadingTimeout);
      this.untoast(id);
    } else if (evt.descriptor) {
      this.#runtime.board.createTabFromDescriptor(evt.descriptor);
    }
  }

  async #attemptNodeRun(id: string, stopAfter = true) {
    if (!this.tab) {
      console.warn(
        "NodeRunRequestEvent dispatched, but no current tab is present. Likely a bug somewhere."
      );
      return;
    }
    const firstRun = (
      await this.#runtime.run.getObservers(this.tab.id)?.runObserver?.runs()
    )?.at(0);

    const nodeConfig = this.#runtime.edit
      .getEditor(this.tab)
      ?.inspect("")
      ?.nodeById(id)
      ?.configuration();

    const configResult = await getRunNodeConfig(id, nodeConfig, firstRun);
    if (!configResult.success) {
      return;
    }
    const { config, history } = configResult.result;
    if (!stopAfter && config) {
      delete config.stopAfter;
    }

    if (!this.tab?.graph?.url) {
      return;
    }

    const graph = this.tab?.graph;

    this.#runBoard(
      addNodeProxyServerConfig(
        this.#proxy,
        {
          url: this.tab.graph.url!,
          runner: graph,
          diagnostics: true,
          kits: [], // The kits are added by the runtime.
          loader: this.#runtime.board.getLoader(),
          inputs: BreadboardUI.Data.inputsFromSettings(this.#settings),
          interactiveSecrets: true,
          graphStore: this.#graphStore,
          ...config,
        },
        this.#settings,
        this.proxyFromUrl,
        await this.#getProxyURL(this.tab?.graph.url)
      ),
      history
    );
  }

  #attemptModuleCreate(moduleId: ModuleIdentifier) {
    if (!this.tab) {
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

    this.#runtime.edit.createModule(this.tab, moduleId, newModule);
  }

  #attemptParamCreate(evt: BreadboardUI.Events.ParamCreateEvent) {
    if (!this.tab) {
      return;
    }

    return this.#runtime.edit.createParam(
      this.tab,
      evt.graphId,
      evt.path,
      evt.title,
      evt.description
    );
  }

  #attemptParamDelete(evt: BreadboardUI.Events.ParamDeleteEvent) {
    if (!this.tab) {
      return;
    }

    return this.#runtime.edit.deleteParam(this.tab, evt.graphId, evt.path);
  }

  async #attemptToggleExport(
    id: ModuleIdentifier | GraphIdentifier,
    type: "imperative" | "declarative"
  ) {
    if (!this.tab) {
      return;
    }

    return this.#runtime.edit.toggleExport(this.tab, id, type);
  }

  #showBoardEditOverlay(
    tab = this.tab,
    x: number | null,
    y: number | null,
    subGraphId: string | null,
    moduleId: string | null
  ) {
    if (!tab) {
      return;
    }
    const exports = tab.graph.exports;

    if (moduleId) {
      const module = tab.graph.modules?.[moduleId];
      if (!module) {
        return;
      }

      const { metadata } = module;

      this.boardEditOverlayInfo = {
        tabId: tab.id,
        description: metadata?.description ?? "",
        isTool: false,
        private: false,
        isComponent: false,
        published: false,
        subGraphId,
        moduleId,
        title: metadata?.title ?? "",
        version: "",
        exported: exports?.includes(`#module:${moduleId}`) ?? false,
        x,
        y,
      };
      return;
    }

    const graph = subGraphId ? tab.graph.graphs?.[subGraphId] : tab.graph;

    if (!graph) {
      return;
    }

    const { description, title, version, metadata } = graph;

    this.boardEditOverlayInfo = {
      tabId: tab.id,
      description: description ?? "",
      isTool: metadata?.tags?.includes("tool") ?? false,
      isComponent: metadata?.tags?.includes("component") ?? false,
      published: metadata?.tags?.includes("published") ?? false,
      private: metadata?.tags?.includes("private") ?? false,
      subGraphId,
      moduleId,
      title: title ?? "",
      version: version ?? "",
      exported: subGraphId
        ? (exports?.includes(`#${subGraphId}`) ?? false)
        : false,
      x,
      y,
    };
  }

  async #setNodeDataForConfiguration(
    configuration: Partial<BreadboardUI.Types.NodePortConfiguration>,
    nodeConfiguration: NodeConfiguration | null
  ) {
    if (!configuration.id) {
      console.warn("Unable to set node data, no ID");
      return;
    }

    const { id, subGraphId } = configuration;

    const title = this.#runtime.edit.getNodeTitle(this.tab, id, subGraphId);

    const [ports, nodeType, metadata, currentMetadata] = await Promise.all([
      this.#runtime.edit.getNodePorts(this.tab, id, subGraphId),
      this.#runtime.edit.getNodeType(this.tab, id, subGraphId),
      this.#runtime.edit.getNodeMetadata(this.tab, id, subGraphId),
      this.#runtime.edit.getNodeCurrentMetadata(this.tab, id, subGraphId),
    ]);

    if (!ports) {
      return;
    }

    this.#runtime.edit.sideboards.discardTasks();

    this.showNodeConfigurator = true;
    this.#nodeConfiguratorData = {
      id,
      x: configuration.x ?? 0,
      y: configuration.y ?? 0,
      title,
      type: nodeType,
      selectedPort: configuration.selectedPort ?? null,
      subGraphId: subGraphId ?? null,
      ports,
      metadata,
      nodeConfiguration,
      currentMetadata,
      addHorizontalClickClearance:
        configuration.addHorizontalClickClearance ?? false,
      graphNodeLocation: configuration.graphNodeLocation ?? null,
    };
  }

  #createItemList(): OverflowAction[] {
    const list: OverflowAction[] = Object.entries(
      this.tab?.graph.modules ?? {}
    ).map(([name, module]) => {
      return {
        name,
        icon: module.metadata?.runnable ? "step" : "code",
        title: module.metadata?.title ?? name,
        secondaryAction: "delete",
        disabled: this.#selectionState?.selectionState.modules.has(name),
      };
    });

    const hasNoGraphsSelected =
      this.#selectionState?.selectionState.graphs.size === 0;
    const hasNoModulesSelected =
      this.#selectionState?.selectionState.modules.size === 0;
    const hasMainGraphSelected =
      this.#selectionState?.selectionState.graphs.has(MAIN_BOARD_ID);

    list.push({
      name: "new-item",
      icon: "add-circle",
      title: Strings.from("COMMAND_NEW_ITEM"),
      disabled: false,
    });

    if (!this.tab?.graph.main) {
      list.unshift({
        name: "flow",
        icon: "flow",
        title: "Flow",
        disabled:
          (hasNoGraphsSelected || hasMainGraphSelected) && hasNoModulesSelected,
      });
    }
    return list;
  }

  render() {
    const signInAdapter = new BreadboardUI.Utils.SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );

    const toasts = html`${map(
      this.toasts,
      ([toastId, { message, type, persistent }], idx) => {
        const offset = this.toasts.size - idx - 1;
        return html`<bb-toast
          .toastId=${toastId}
          .offset=${offset}
          .message=${message}
          .type=${type}
          .timeout=${persistent ? 0 : nothing}
          @bbtoastremoved=${(evt: BreadboardUI.Events.ToastRemovedEvent) => {
            this.toasts.delete(evt.toastId);
          }}
        ></bb-toast>`;
      }
    )}`;

    const showingOverlay =
      this.boardEditOverlayInfo !== null ||
      this.showSettingsOverlay ||
      this.showFirstRun ||
      this.showBoardServerAddOverlay ||
      this.showSaveAsDialog ||
      this.showNodeConfigurator ||
      this.showCommentEditor ||
      this.showOpenBoardOverlay ||
      this.showCommandPalette ||
      this.showModulePalette ||
      this.showNewWorkspaceItemOverlay ||
      this.showBoardOverflowMenu ||
      this.showUserOverflowMenu ||
      this.showBoardItemsOverflowMenu;

    const uiController = this.#initialize
      .then(() => {
        const observers = this.#runtime?.run.getObservers(this.tab?.id ?? null);
        if (observers && observers.runObserver) {
          return observers.runObserver?.runs();
        }

        return [];
      })
      .then((runs: InspectableRun[]) => {
        const observers = this.#runtime?.run.getObservers(this.tab?.id ?? null);
        const topGraphResult =
          observers?.topGraphObserver?.current() ??
          BreadboardUI.Utils.TopGraphObserver.entryResult(this.tab?.graph);
        const projectState = this.#runtime.state.getOrCreate(
          this.tab?.mainGraphId,
          this.#runtime.edit.getEditor(this.tab)
        );
        const inputsFromLastRun = runs[1]?.inputs() ?? null;
        const tabURLs = this.#runtime.board.getTabURLs();
        const offerConfigurationEnhancements =
          this.#settings?.getItem(
            BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
            "Offer Configuration Enhancements"
          )?.value ?? false;

        const showCustomStepEditing =
          this.#settings?.getItem(
            BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
            "Enable Custom Step Creation"
          )?.value ?? false;

        let tabStatus = BreadboardUI.Types.STATUS.STOPPED;
        if (this.tab) {
          tabStatus =
            this.#tabBoardStatus.get(this.tab.id) ??
            BreadboardUI.Types.STATUS.STOPPED;
        }

        let tabLoadStatus = BreadboardUI.Types.BOARD_LOAD_STATUS.LOADING;
        if (this.tab) {
          tabLoadStatus =
            this.#tabLoadStatus.get(this.tab.id) ??
            BreadboardUI.Types.BOARD_LOAD_STATUS.LOADING;
        }

        let boardOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.boardEditOverlayInfo) {
          const location = {
            x: this.boardEditOverlayInfo.x ?? 160,
            y: this.boardEditOverlayInfo.y ?? 100,
            addHorizontalClickClearance: true,
          };

          boardOverlay = html`<bb-board-details-overlay
            .tabId=${this.boardEditOverlayInfo.tabId}
            .boardTitle=${this.boardEditOverlayInfo.title}
            .boardVersion=${this.boardEditOverlayInfo.version}
            .boardDescription=${this.boardEditOverlayInfo.description}
            .boardPublished=${this.boardEditOverlayInfo.published}
            .boardPrivate=${this.boardEditOverlayInfo.private}
            .boardIsTool=${this.boardEditOverlayInfo.isTool}
            .boardIsComponent=${this.boardEditOverlayInfo.isComponent}
            .boardExported=${this.boardEditOverlayInfo.exported}
            .subGraphId=${this.boardEditOverlayInfo.subGraphId}
            .moduleId=${this.boardEditOverlayInfo.moduleId}
            .location=${location}
            @bboverlaydismissed=${() => {
              this.boardEditOverlayInfo = null;
            }}
            @bbboardinfoupdate=${async (
              evt: BreadboardUI.Events.BoardInfoUpdateEvent
            ) => {
              await this.#handleBoardInfoUpdate(evt);
              if (evt.exported !== null) {
                if (evt.subGraphId) {
                  await this.#attemptToggleExport(
                    evt.subGraphId,
                    "declarative"
                  );
                } else if (evt.moduleId) {
                  await this.#attemptToggleExport(evt.moduleId, "imperative");
                }
              }

              this.boardEditOverlayInfo = null;
              this.requestUpdate();
            }}
          ></bb-board-details-overlay>`;
        }

        let settingsOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showSettingsOverlay) {
          settingsOverlay = html`<bb-settings-edit-overlay
            class="settings"
            .settings=${this.#settings?.values || null}
            @bbsettingsupdate=${async (
              evt: BreadboardUI.Events.SettingsUpdateEvent
            ) => {
              if (!this.#settings) {
                return;
              }

              try {
                await this.#settings.save(evt.settings);
                this.toast(
                  Strings.from("STATUS_SAVED_SETTINGS"),
                  BreadboardUI.Events.ToastType.INFORMATION
                );
              } catch (err) {
                console.warn(err);
                this.toast(
                  Strings.from("ERROR_SAVE_SETTINGS"),
                  BreadboardUI.Events.ToastType.ERROR
                );
              }

              this.requestUpdate();
            }}
            @bboverlaydismissed=${() => {
              this.showSettingsOverlay = false;
            }}
          ></bb-settings-edit-overlay>`;
        }

        let showNewWorkspaceItemOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showNewWorkspaceItemOverlay) {
          showNewWorkspaceItemOverlay = html`<bb-new-workspace-item-overlay
            @bbworkspaceitemcreate=${async (
              evt: BreadboardUI.Events.WorkspaceItemCreateEvent
            ) => {
              this.showNewWorkspaceItemOverlay = false;

              await this.#runtime.edit.createWorkspaceItem(
                this.tab,
                evt.itemType,
                evt.title,
                this.#settings
              );
            }}
            @bboverlaydismissed=${() => {
              this.showNewWorkspaceItemOverlay = false;
            }}
          ></bb-new-workspace-item-overlay>`;
        }

        let firstRunOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showFirstRun) {
          const currentUrl = new URL(window.location.href);
          const boardServerUrl = currentUrl.searchParams.get("boardserver");

          firstRunOverlay = html`<bb-first-run-overlay
            class="settings"
            .settings=${this.#settings?.values || null}
            .boardServerUrl=${boardServerUrl}
            .boardServers=${this.#boardServers}
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

              this.showBoardServerAddOverlay = false;
            }}
            @bbsettingsupdate=${async (
              evt: BreadboardUI.Events.SettingsUpdateEvent
            ) => {
              if (!this.#settings) {
                return;
              }

              try {
                await this.#settings.save(evt.settings);
                this.toast(
                  `Welcome to ${Strings.from("APP_NAME")}!`,
                  BreadboardUI.Events.ToastType.INFORMATION
                );
              } catch (err) {
                console.warn(err);
                this.toast(
                  Strings.from("ERROR_SAVE_SETTINGS"),
                  BreadboardUI.Events.ToastType.ERROR
                );
              }

              this.#setUrlParam("firstrun", null);
              this.#setUrlParam("boardserver", null);
              this.showFirstRun = false;
              this.requestUpdate();
            }}
            @bboverlaydismissed=${() => {
              this.#setUrlParam("firstrun", null);
              this.#setUrlParam("boardserver", null);
              this.showFirstRun = false;
            }}
          ></bb-first-run-overlay>`;
        }

        let boardServerAddOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showBoardServerAddOverlay) {
          boardServerAddOverlay = html`<bb-board-server-overlay
            .showGoogleDrive=${true}
            .boardServers=${this.#boardServers}
            @bboverlaydismissed=${() => {
              this.showBoardServerAddOverlay = false;
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
              this.showBoardServerAddOverlay = false;
            }}
          ></bb-board-server-overlay>`;
        }

        const showAdditionalSources =
          this.#settings?.getItem(
            BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
            "Show additional sources"
          )?.value ?? false;

        let saveAsDialogOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showSaveAsDialog) {
          saveAsDialogOverlay = html`<bb-save-as-overlay
            .panelTitle=${this.#saveAsState?.title ??
            Strings.from("COMMAND_SAVE_PROJECT_AS")}
            .boardServers=${this.#boardServers}
            .selectedBoardServer=${this.selectedBoardServer}
            .selectedLocation=${this.selectedLocation}
            .showAdditionalSources=${showAdditionalSources}
            .graph=${structuredClone(
              this.#saveAsState?.graph ?? this.tab?.graph
            )}
            .isNewBoard=${this.#saveAsState?.isNewBoard ?? false}
            @bboverlaydismissed=${() => {
              this.showSaveAsDialog = false;
            }}
            @bbgraphboardserversaveboard=${async (
              evt: BreadboardUI.Events.GraphBoardServerSaveBoardEvent
            ) => {
              this.showSaveAsDialog = false;

              const { boardServerName, location, fileName, graph } = evt;
              await this.#attemptBoardSaveAs(
                boardServerName,
                location,
                fileName,
                graph,
                undefined,
                undefined,
                { role: "user" }
              );
            }}
          ></bb-save-as-overlay>`;

          this.#saveAsState = null;
        }

        const canRunNode = this.#nodeConfiguratorData
          ? topGraphResult.nodeInformation.canRunNode(
              this.#nodeConfiguratorData.id
            )
          : false;

        const run = runs?.[0] ?? null;
        const events = run?.events ?? [];
        const runEventsForNode = events.filter((evt) => {
          return (
            evt.type === "node" &&
            evt.node.descriptor.id === this.#nodeConfiguratorData?.id &&
            evt.end !== null
          );
        });

        const nodeConfiguratorOverlay = html`<bb-focus-editor
          ${ref(this.#nodeConfiguratorRef)}
          .canRunNode=${canRunNode}
          .configuration=${this.#nodeConfiguratorData}
          .graph=${this.tab?.graph}
          .runEventsForNode=${runEventsForNode}
          .boardServers=${this.#boardServers}
          .showTypes=${false}
          .offerConfigurationEnhancements=${offerConfigurationEnhancements}
          .projectState=${projectState}
          .readOnly=${this.tab?.readOnly}
          .active=${this.showNodeConfigurator}
          @bboverlaydismissed=${() => {
            this.#nodeConfiguratorData = null;
            this.showNodeConfigurator = false;
          }}
          @bbnodepartialupdate=${async (
            evt: BreadboardUI.Events.NodePartialUpdateEvent
          ) => {
            if (!this.tab) {
              this.toast(
                Strings.from("ERROR_NO_PROJECT"),
                BreadboardUI.Events.ToastType.ERROR
              );
              return;
            }

            await this.#runtime.edit.changeNodeConfigurationPart(
              this.tab,
              evt.id,
              evt.configuration,
              evt.subGraphId,
              evt.metadata,
              evt.ins
            );
          }}
          @bbrunisolatednode=${async (
            evt: BreadboardUI.Events.RunIsolatedNodeEvent
          ) => {
            await this.#attemptNodeRun(evt.id);
          }}
          @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
            this.toast(toastEvent.message, toastEvent.toastType);
          }}
          @bbparamcreate=${(evt: BreadboardUI.Events.ParamCreateEvent) => {
            return this.#attemptParamCreate(evt);
          }}
        >
        </bb-focus-editor>`;

        let commentOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showCommentEditor) {
          commentOverlay = html`<bb-comment-overlay
            .commentValue=${this.#commentValueData}
            @bbcommentupdate=${(
              evt: BreadboardUI.Events.CommentUpdateEvent
            ) => {
              this.#commentValueData = null;
              this.showCommentEditor = false;

              this.#runtime.edit.changeComment(
                this.tab,
                evt.id,
                evt.text,
                evt.subGraphId
              );
            }}
            @bboverlaydismissed=${() => {
              this.#commentValueData = null;
              this.showCommentEditor = false;
            }}
          ></bb-comment-overlay>`;
        }

        let openDialogOverlay: HTMLTemplateResult | symbol = nothing;
        if (this.showOpenBoardOverlay) {
          openDialogOverlay = html`<bb-open-board-overlay
            .selectedBoardServer=${this.selectedBoardServer}
            .selectedLocation=${this.selectedLocation}
            .boardServers=${this.#boardServers}
            .boardServerNavState=${this.boardServerNavState}
            @bboverlaydismissed=${() => {
              this.showOpenBoardOverlay = false;
              this.#maybeShowWelcomePanel();
            }}
            @bbgraphboardserverblankboard=${() => {
              this.showOpenBoardOverlay = false;
              this.#attemptBoardCreate(blank(), { role: "user" });
            }}
            @bbgraphboardserveradd=${() => {
              this.showBoardServerAddOverlay = true;
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
              if (refreshed) {
                this.toast(
                  Strings.from("STATUS_PROJECTS_REFRESHED"),
                  BreadboardUI.Events.ToastType.INFORMATION
                );
              } else {
                this.toast(
                  Strings.from("ERROR_UNABLE_TO_REFRESH_PROJECTS"),
                  BreadboardUI.Events.ToastType.WARNING
                );
              }

              this.boardServerNavState = globalThis.crypto.randomUUID();
            }}
            @bbgraphboardserverdisconnect=${async (
              evt: BreadboardUI.Events.GraphBoardServerDisconnectEvent
            ) => {
              await this.#runtime.board.disconnect(evt.location);
              this.boardServerNavState = globalThis.crypto.randomUUID();
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

              this.boardServerNavState = globalThis.crypto.randomUUID();
            }}
            @bbgraphboardserverloadrequest=${async (
              evt: BreadboardUI.Events.GraphBoardServerLoadRequestEvent
            ) => {
              this.showOpenBoardOverlay = false;
              this.#attemptBoardLoad(
                new BreadboardUI.Events.StartEvent(evt.url)
              );
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
            @bbgraphboardserverselectionchange=${(
              evt: BreadboardUI.Events.GraphBoardServerSelectionChangeEvent
            ) => {
              this.#persistBoardServerAndLocation(
                evt.selectedBoardServer,
                evt.selectedLocation
              );
            }}
            >Open board</bb-open-board-overlay
          >`;
        }

        let userOverflowMenu: HTMLTemplateResult | symbol = nothing;
        if (this.showUserOverflowMenu && this.#userOverflowMenuConfiguration) {
          const actions: BreadboardUI.Types.OverflowAction[] = [
            {
              title: Strings.from("COMMAND_LOG_OUT"),
              name: "logout",
              icon: "logout",
            },
          ];

          userOverflowMenu = html`<bb-overflow-menu
            id="user-overflow"
            style=${styleMap({
              left: `${this.#userOverflowMenuConfiguration.x}px`,
              top: `${this.#userOverflowMenuConfiguration.y}px`,
            })}
            .actions=${actions}
            .disabled=${false}
            @bboverflowmenudismissed=${() => {
              this.showUserOverflowMenu = false;
            }}
            @bboverflowmenuaction=${async (
              actionEvt: BreadboardUI.Events.OverflowMenuActionEvent
            ) => {
              this.showUserOverflowMenu = false;

              switch (actionEvt.action) {
                case "logout": {
                  this.#attemptLogOut();
                  break;
                }
              }
            }}
          ></bb-overflow-menu>`;
        }

        let boardOverflowMenu: HTMLTemplateResult | symbol = nothing;
        if (
          this.showBoardOverflowMenu &&
          this.#boardOverflowMenuConfiguration
        ) {
          const tabId = this.#boardOverflowMenuConfiguration.tabId;
          const actions: BreadboardUI.Types.OverflowAction[] = [];

          if (this.#runtime.board.canSave(tabId)) {
            actions.push({
              title: Strings.from("COMMAND_EDIT_PROJECT_INFORMATION"),
              name: "edit",
              icon: "edit",
              value: tabId,
            });
          }

          if (this.#runtime.board.canPreview(tabId)) {
            actions.push({
              title: Strings.from("COMMAND_COPY_APP_PREVIEW_URL"),
              name: "copy-preview-to-clipboard",
              icon: "share",
              value: tabId,
            });
          }

          actions.push(
            {
              title: Strings.from("COMMAND_COPY_PROJECT_CONTENTS"),
              name: "copy-board-contents",
              icon: "copy",
              value: tabId,
            },
            {
              title: Strings.from("COMMAND_EXPORT_PROJECT"),
              name: "download",
              icon: "download",
              value: tabId,
            }
          );

          if (this.#runtime.board.canSave(tabId)) {
            actions.push({
              title: Strings.from("COMMAND_DELETE_PROJECT"),
              name: "delete",
              icon: "delete",
              value: tabId,
            });
          }

          boardOverflowMenu = html`<bb-overflow-menu
            id="board-overflow"
            style=${styleMap({
              right: `${this.#boardOverflowMenuConfiguration.x}px`,
              top: `${this.#boardOverflowMenuConfiguration.y}px`,
            })}
            .actions=${actions}
            .disabled=${false}
            @bboverflowmenudismissed=${() => {
              this.showBoardOverflowMenu = false;
            }}
            @bboverflowmenuaction=${async (
              actionEvt: BreadboardUI.Events.OverflowMenuActionEvent
            ) => {
              this.showBoardOverflowMenu = false;
              const x = this.#boardOverflowMenuConfiguration?.x ?? 100;
              const y = this.#boardOverflowMenuConfiguration?.y ?? 100;

              if (!actionEvt.value) {
                this.toast(
                  Strings.from("ERROR_GENERIC"),
                  BreadboardUI.Events.ToastType.ERROR
                );
                return;
              }

              const tab = this.#runtime.board.getTabById(
                actionEvt.value as TabId
              );
              if (!tab) {
                this.toast(
                  Strings.from("ERROR_GENERIC"),
                  BreadboardUI.Events.ToastType.ERROR
                );
                return;
              }

              switch (actionEvt.action) {
                case "edit-board-details": {
                  this.#showBoardEditOverlay(tab, x, y, null, null);
                  break;
                }

                case "copy-board-contents": {
                  if (!tab.graph || !tab.graph.url) {
                    this.toast(
                      Strings.from("ERROR_GENERIC"),
                      BreadboardUI.Events.ToastType.ERROR
                    );
                    break;
                  }

                  await navigator.clipboard.writeText(
                    JSON.stringify(tab.graph, null, 2)
                  );
                  this.toast(
                    Strings.from("STATUS_PROJECT_CONTENTS_COPIED"),
                    BreadboardUI.Events.ToastType.INFORMATION
                  );
                  break;
                }

                case "copy-to-clipboard": {
                  if (!tab.graph || !tab.graph.url) {
                    this.toast(
                      Strings.from("ERROR_GENERIC"),
                      BreadboardUI.Events.ToastType.ERROR
                    );
                    break;
                  }

                  await navigator.clipboard.writeText(tab.graph.url);
                  this.toast(
                    Strings.from("STATUS_PROJECT_URL_COPIED"),
                    BreadboardUI.Events.ToastType.INFORMATION
                  );
                  break;
                }

                case "copy-tab-to-clipboard": {
                  if (!tab.graph || !tab.graph.url) {
                    this.toast(
                      Strings.from("ERROR_GENERIC"),
                      BreadboardUI.Events.ToastType.ERROR
                    );
                    break;
                  }

                  const url = new URL(window.location.href);
                  url.search = `?tab0=${tab.graph.url}`;

                  await navigator.clipboard.writeText(url.href);
                  this.toast(
                    Strings.from("STATUS_FULL_URL_COPIED"),
                    BreadboardUI.Events.ToastType.INFORMATION
                  );
                  break;
                }

                case "download": {
                  if (!tab.graph) {
                    break;
                  }

                  const board = structuredClone(tab.graph);
                  delete board["url"];

                  const data = JSON.stringify(board, null, 2);
                  const url = URL.createObjectURL(
                    new Blob([data], { type: "application/json" })
                  );

                  for (const url of generatedUrls) {
                    try {
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.warn(err);
                    }
                  }

                  generatedUrls.clear();
                  generatedUrls.add(url);

                  let fileName = `${board.title ?? Strings.from("TITLE_UNTITLED_PROJECT")}.json`;
                  if (tab.graph.url) {
                    try {
                      const boardUrl = new URL(
                        tab.graph.url,
                        window.location.href
                      );
                      const baseName = /[^/]+$/.exec(boardUrl.pathname);
                      if (baseName) {
                        fileName = baseName[0];
                      }
                    } catch (err) {
                      // Ignore errors - this is best-effort to get the file name from the URL.
                    }
                  }

                  const anchor = document.createElement("a");
                  anchor.download = fileName;
                  anchor.href = url;
                  anchor.click();
                  break;
                }

                case "delete": {
                  if (!tab.graph || !tab.graph.url) {
                    return;
                  }

                  const boardServer = this.#runtime.board.getBoardServerForURL(
                    new URL(tab.graph.url)
                  );
                  if (!boardServer) {
                    return;
                  }

                  this.#attemptBoardDelete(
                    boardServer.name,
                    tab.graph.url,
                    true
                  );
                  break;
                }

                case "save": {
                  this.#attemptBoardSave(tab);
                  break;
                }

                case "save-as": {
                  this.#saveAsState = {
                    title: Strings.from("COMMAND_SAVE_PROJECT_AS"),
                    graph: tab.graph,
                    isNewBoard: false,
                  };

                  this.showSaveAsDialog = true;
                  break;
                }

                case "copy-preview-to-clipboard": {
                  if (!tab.graph || !tab.graph.url) {
                    return;
                  }

                  const boardServer = this.#runtime.board.getBoardServerForURL(
                    new URL(tab.graph.url)
                  );
                  if (!boardServer) {
                    return;
                  }

                  try {
                    const previewUrl = await boardServer.preview(
                      new URL(tab.graph.url)
                    );

                    await navigator.clipboard.writeText(previewUrl.href);
                    this.toast(
                      Strings.from("STATUS_APP_PREVIEW_URL_COPIED"),
                      BreadboardUI.Events.ToastType.INFORMATION
                    );
                  } catch (err) {
                    this.toast(
                      Strings.from("ERROR_GENERIC"),
                      BreadboardUI.Events.ToastType.ERROR
                    );
                  }
                  break;
                }
              }
            }}
          ></bb-overflow-menu>`;
        }

        const canSave = this.tab
          ? this.#runtime.board.canSave(this.tab.id) && !this.tab.readOnly
          : false;
        const saveStatus = this.tab
          ? (this.#tabSaveStatus.get(this.tab.id) ?? "saved")
          : BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;
        const remote =
          (this.tab?.graph.url?.startsWith("http") ||
            this.tab?.graph.url?.startsWith("drive")) ??
          false;
        const readonly = this.tab?.readOnly ?? !canSave;
        let saveTitle = Strings.from("LABEL_SAVE_STATUS_SAVED");
        switch (saveStatus) {
          case BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING: {
            saveTitle = Strings.from("LABEL_SAVE_STATUS_SAVING");
            break;
          }

          case BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED: {
            if (readonly) {
              saveTitle += " - " + Strings.from("LABEL_SAVE_STATUS_READ_ONLY");
            }
            break;
          }

          case BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR: {
            saveTitle = Strings.from("LABEL_SAVE_ERROR");
            break;
          }

          case BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED: {
            saveTitle = Strings.from("LABEL_SAVE_UNSAVED");
            break;
          }
        }

        let boardItemsOverflowMenu: HTMLTemplateResult | symbol = nothing;
        if (
          this.showBoardItemsOverflowMenu &&
          this.#boardItemsOverflowMenuConfiguration
        ) {
          const itemList: OverflowAction[] = this.#createItemList();
          boardItemsOverflowMenu = html`<bb-overflow-menu
            id="board-items-overflow"
            style=${styleMap({
              right: `${this.#boardItemsOverflowMenuConfiguration.x}px`,
              top: `${this.#boardItemsOverflowMenuConfiguration.y}px`,
            })}
            .disabled=${false}
            .actions=${itemList}
            @bboverflowmenuaction=${(
              evt: BreadboardUI.Events.OverflowMenuActionEvent
            ) => {
              evt.stopImmediatePropagation();

              if (evt.action === "new-item") {
                this.showNewWorkspaceItemOverlay = true;
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
              if (!this.tab) {
                return;
              }
              const selectionChangeId = this.#runtime.select.generateId();
              this.#runtime.select.processSelections(
                this.tab.id,
                selectionChangeId,
                selections,
                true,
                false
              );

              this.showBoardItemsOverflowMenu = false;
            }}
            @bboverflowmenusecondaryaction=${(
              evt: BreadboardUI.Events.OverflowMenuSecondaryActionEvent
            ) => {
              evt.stopImmediatePropagation();
              if (!this.tab) {
                return;
              }

              if (typeof evt.value !== "string") {
                return;
              }

              this.#runtime.edit.deleteModule(this.tab, evt.value);
              this.showBoardItemsOverflowMenu = false;
            }}
            @bboverflowmenudismissed=${() => {
              this.showBoardItemsOverflowMenu = false;
            }}
          ></bb-overflow-menu>`;
        }

        let selectedItem = "Flow";
        let selectedItemClass = "flow";
        if (this.#selectionState) {
          if (this.#selectionState.selectionState.modules.size > 0) {
            const module = [
              ...this.#selectionState.selectionState.modules.keys(),
            ][0];
            selectedItem =
              this.tab?.graph.modules?.[module].metadata?.title ?? module;
            selectedItemClass = this.tab?.graph.modules?.[module].metadata
              ?.runnable
              ? "step"
              : "code";
          }

          if (!selectedItem || selectedItem === MAIN_BOARD_ID) {
            selectedItem = "Flow";
            selectedItemClass = "flow";
          }
        }

        const ui = html`<header>
          <div id="header-bar" data-active=${this.tab ? "true" : nothing} ?inert=${showingOverlay}>
            <div id="tab-info">
              <button id="logo" @click=${() => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.board.closeTab(this.tab.id);
              }}
                  ?disabled=${this.tab === null}>
                ${
                  this.showWelcomePanel
                    ? html`<span class="product-name"
                        >${Strings.from("APP_NAME")}</span
                      >`
                    : nothing
                }
              </button>

              ${
                this.tab
                  ? html` <span class="tab-title">${this.tab.graph.title}</span>
                      <button
                        id="tab-edit"
                        class=${classMap({
                          "can-save": canSave,
                        })}
                        @click=${(evt: PointerEvent) => {
                          if (!this.tab || !canSave) {
                            return;
                          }

                          this.#showBoardEditOverlay(
                            this.tab,
                            evt.clientX,
                            evt.clientY,
                            this.tab.subGraphId,
                            null
                          );
                        }}
                      >
                        Edit
                      </button>

                      <span
                        class=${classMap({
                          "save-status": true,
                          "can-save": canSave,
                          remote,
                          [saveStatus]: true,
                          readonly,
                        })}
                      >
                        ${saveTitle}
                      </span>`
                  : nothing
              }

            </div>
            <div id="tab-controls">
              ${
                this.tab
                  ? html` ${showCustomStepEditing
                        ? html`<button
                            id="toggle-board-item"
                            class=${classMap({ [selectedItemClass]: true })}
                            @click=${(evt: PointerEvent) => {
                              if (!(evt.target instanceof HTMLButtonElement)) {
                                return;
                              }

                              const bounds = evt.target.getBoundingClientRect();
                              this.#boardItemsOverflowMenuConfiguration = {
                                x: window.innerWidth - bounds.right,
                                y: bounds.bottom + 8,
                              };
                              this.showBoardItemsOverflowMenu = true;
                            }}
                          >
                            ${selectedItem}
                          </button>`
                        : nothing}
                      <button
                        id="toggle-overflow-menu"
                        @pointerover=${(evt: PointerEvent) => {
                          this.dispatchEvent(
                            new BreadboardUI.Events.ShowTooltipEvent(
                              Strings.from("COMMAND_ADDITIONAL_ITEMS"),
                              evt.clientX,
                              evt.clientY
                            )
                          );
                        }}
                        @pointerout=${() => {
                          this.dispatchEvent(
                            new BreadboardUI.Events.HideTooltipEvent()
                          );
                        }}
                        @click=${(evt: PointerEvent) => {
                          if (!(evt.target instanceof HTMLButtonElement)) {
                            return;
                          }

                          if (!this.tab) {
                            return;
                          }

                          const bounds = evt.target.getBoundingClientRect();
                          const x = window.innerWidth - bounds.right;
                          const y = bounds.bottom + 8;

                          this.#boardOverflowMenuConfiguration = {
                            tabId: this.tab.id,
                            x,
                            y,
                          };
                          this.showBoardOverflowMenu = true;
                        }}
                      >
                        Overflow
                      </button>`
                  : nothing
              }
              <button
                class=${classMap({ active: this.showSettingsOverlay })}
                id="toggle-settings"
                @pointerover=${(evt: PointerEvent) => {
                  this.dispatchEvent(
                    new BreadboardUI.Events.ShowTooltipEvent(
                      Strings.from("COMMAND_EDIT_SETTINGS"),
                      evt.clientX,
                      evt.clientY
                    )
                  );
                }}
                @pointerout=${() => {
                  this.dispatchEvent(
                    new BreadboardUI.Events.HideTooltipEvent()
                  );
                }}
                @click=${() => {
                  this.showSettingsOverlay = true;
                }}
              >
                Settings
              </button>
              ${
                signInAdapter.state === "valid" && signInAdapter.picture
                  ? html`<button
                      id="toggle-user-menu"
                      @click=${(evt: PointerEvent) => {
                        if (!(evt.target instanceof HTMLButtonElement)) {
                          return;
                        }

                        const btnBounds = evt.target.getBoundingClientRect();
                        const x = btnBounds.x + btnBounds.width - 145;
                        const y = btnBounds.y + btnBounds.height;

                        this.#userOverflowMenuConfiguration = {
                          x,
                          y,
                        };
                        this.showUserOverflowMenu = true;
                      }}
                    >
                      <img
                        id="user-pic"
                        crossorigin
                        .src=${signInAdapter.picture}
                        alt=${signInAdapter.name ?? "No name"}
                      />
                    </button>`
                  : nothing
              }

            </div>
          </div>
        </div>
      </header>
      <div id="content" ?inert=${showingOverlay}>
        <bb-ui-controller
              ${ref(this.#uiRef)}
              ?inert=${showingOverlay}
              .runStore=${this.#runStore}
              .sandbox=${sandbox}
              .fileSystem=${this.#fileSystem}
              .graphStore=${this.#graphStore}
              .mainGraphId=${this.tab?.mainGraphId}
              .readOnly=${this.tab?.readOnly ?? true}
              .graph=${this.tab?.graph ?? null}
              .editor=${this.#runtime.edit.getEditor(this.tab)}
              .subGraphId=${this.tab?.subGraphId ?? null}
              .moduleId=${this.tab?.moduleId ?? null}
              .runs=${runs ?? null}
              .topGraphResult=${topGraphResult}
              .boardServerKits=${this.tab?.boardServerKits ?? []}
              .loader=${this.#runtime.board.getLoader()}
              .status=${tabStatus}
              .boardId=${this.#boardId}
              .tabLoadStatus=${tabLoadStatus}
              .settings=${this.#settings}
              .boardServers=${this.#boardServers}
              .history=${this.#runtime.edit.getHistory(this.tab)}
              .version=${this.#version}
              .recentBoards=${this.#recentBoards}
              .inputsFromLastRun=${inputsFromLastRun}
              .tabURLs=${tabURLs}
              .selectionState=${this.#selectionState}
              .visualChangeId=${this.#lastVisualChangeId}
              .graphTopologyUpdateId=${this.graphTopologyUpdateId}
              .graphStoreUpdateId=${this.graphStoreUpdateId}
              .showBoardReferenceMarkers=${this.showBoardReferenceMarkers}
              .chatController=${observers?.chatController}
              .projectState=${projectState}
              .organizer=${projectState?.organizer}
              .signedIn=${signInAdapter.state === "valid"}
              .canRun=${this.canRun}
              @bbrun=${async () => {
                if (!this.canRun) return;
                await this.#attemptBoardStart();
              }}
              @bbstop=${(evt: BreadboardUI.Events.StopEvent) => {
                this.#attemptBoardStop(evt.clearLastRun);
              }}
              @bbinputenter=${async (
                event: BreadboardUI.Events.InputEnterEvent
              ) => {
                if (!this.#settings || !this.tab) {
                  return;
                }

                const isSecret = "secret" in event.data;
                const runner = this.#runtime.run.getRunner(this.tab.id);
                if (!runner) {
                  throw new Error("Can't send input, no runner");
                }
                if (isSecret) {
                  if (this.#secretsHelper) {
                    this.#secretsHelper.receiveSecrets(event);
                    if (
                      this.#secretsHelper.hasAllSecrets() &&
                      !runner?.running()
                    ) {
                      const secrets = this.#secretsHelper.getSecrets();
                      this.#secretsHelper = null;
                      runner?.run(secrets);
                    }
                  } else {
                    // This is the case when the "secret" event hasn't yet
                    // been received.
                    // Likely, this is a side effect of how the
                    // activity-log is built: it relies on the run observer
                    // for the events list, and the run observer updates the
                    // list of run events before the run API dispatches
                    // the "secret" event.
                    this.#secretsHelper = new SecretsHelper(this.#settings!);
                    this.#secretsHelper.receiveSecrets(event);
                  }
                } else {
                  const data = event.data as InputValues;
                  if (!runner.running()) {
                    runner.run(data);
                  }
                }
              }}
              @bbparamdelete=${async (
                evt: BreadboardUI.Events.ParamDeleteEvent
              ) => {
                await this.#attemptParamDelete(evt);
              }}
              @bbgraphboardserverloadrequest=${async (
                evt: BreadboardUI.Events.GraphBoardServerLoadRequestEvent
              ) => {
                this.#attemptBoardLoad(
                  new BreadboardUI.Events.StartEvent(evt.url)
                );
              }}
              @bbworkspaceselectionmove=${async (
                evt: BreadboardUI.Events.WorkspaceSelectionMoveEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                await this.#runtime.edit.moveToNewGraph(
                  this.tab,
                  evt.selections,
                  evt.targetGraphId,
                  evt.delta
                );
              }}
              @bbnodecreatereference=${async (
                evt: BreadboardUI.Events.NodeCreateReferenceEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                await this.#runtime.edit.createReference(
                  this.tab,
                  evt.graphId,
                  evt.nodeId,
                  evt.portId,
                  evt.value
                );
              }}
              @bbeditorpositionchange=${(
                evt: BreadboardUI.Events.EditorPointerPositionChangeEvent
              ) => {
                this.#lastPointerPosition.x = evt.x;
                this.#lastPointerPosition.y = evt.y;
              }}
              @bbworkspaceselectionstate=${(
                evt: BreadboardUI.Events.WorkspaceSelectionStateEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.select.processSelections(
                  this.tab.id,
                  evt.selectionChangeId,
                  evt.selections,
                  evt.replaceExistingSelections,
                  evt.moveToSelection
                );
              }}
              @bbworkspacevisualupdate=${(
                evt: BreadboardUI.Events.WorkspaceVisualUpdateEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.edit.processVisualChanges(
                  this.tab,
                  evt.visualChangeId,
                  evt.visualState
                );
              }}
              @bbworkspaceitemvisualupdate=${(
                evt: BreadboardUI.Events.WorkspaceItemVisualUpdateEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.edit.processVisualChange(
                  this.tab,
                  evt.visualChangeId,
                  evt.graphId,
                  evt.visual
                );
              }}
              @bbcommandsavailable=${(
                evt: BreadboardUI.Events.CommandsAvailableEvent
              ) => {
                this.#viewCommands.set(evt.namespace, evt.commands);
              }}
              @bbcommandssetswitch=${(
                evt: BreadboardUI.Events.CommandsSetSwitchEvent
              ) => {
                this.#viewCommandNamespace = evt.namespace;
              }}
              @bbinteraction=${() => {
                this.#clearBoardSave();
              }}
              @bbnodepartialupdate=${async (
                evt: BreadboardUI.Events.NodePartialUpdateEvent
              ) => {
                if (!this.tab) {
                  this.toast(
                    Strings.from("ERROR_GENERIC"),
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                if (!evt.debugging) {
                  this.#nodeConfiguratorData = null;
                  this.showNodeConfigurator = false;
                }

                await this.#runtime.edit.changeNodeConfigurationPart(
                  this.tab,
                  evt.id,
                  evt.configuration,
                  evt.subGraphId,
                  evt.metadata,
                  evt.ins
                );
              }}
              @bbworkspacenewitemcreaterequest=${() => {
                this.showNewWorkspaceItemOverlay = true;
              }}
              @bbboarditemcopy=${(
                evt: BreadboardUI.Events.BoardItemCopyEvent
              ) => {
                this.#runtime.edit.copyBoardItem(
                  this.tab,
                  evt.itemType,
                  evt.id,
                  evt.title
                );
              }}
              @bbsave=${() => {
                this.#attemptBoardSave();
              }}
              @bbsaveas=${() => {
                this.showSaveAsDialog = true;
              }}
              @bbstart=${(evt: BreadboardUI.Events.StartEvent) => {
                this.#attemptBoardLoad(evt);
              }}
              @bbgraphboardopenrequest=${() => {
                this.showOpenBoardOverlay = true;
              }}
              @bboverflowmenuaction=${async (
                evt: BreadboardUI.Events.OverflowMenuActionEvent
              ) => {
                switch (evt.action) {
                  case "edit-board-details": {
                    this.#showBoardEditOverlay(
                      this.tab,
                      evt.x ?? null,
                      evt.y ?? null,
                      evt.value,
                      null
                    );
                    break;
                  }

                  case "edit-module-details": {
                    this.#showBoardEditOverlay(
                      this.tab,
                      evt.x ?? null,
                      evt.y ?? null,
                      null,
                      evt.value
                    );
                    break;
                  }

                  default: {
                    this.toast(
                      Strings.from("ERROR_GENERIC"),
                      BreadboardUI.Events.ToastType.WARNING
                    );
                    break;
                  }
                }
              }}
              @dragover=${(evt: DragEvent) => {
                evt.preventDefault();
              }}
              @drop=${(evt: DragEvent) => {
                evt.preventDefault();
                this.#attemptLoad(evt);
              }}
              @bbinputerror=${(evt: BreadboardUI.Events.InputErrorEvent) => {
                this.toast(evt.detail, BreadboardUI.Events.ToastType.ERROR);
                return;
              }}
              @bbboardtitleupdate=${async (
                evt: BreadboardUI.Events.BoardTitleUpdateEvent
              ) => {
                await this.#runtime.edit.updateBoardTitle(this.tab, evt.title);
              }}
              @bbboarddescriptionupdate=${async (
                evt: BreadboardUI.Events.BoardDescriptionUpdateEvent
              ) => {
                await this.#runtime.edit.updateBoardDescription(
                  this.tab,
                  evt.description
                );
              }}
              @bbboardinfoupdate=${async (
                evt: BreadboardUI.Events.BoardInfoUpdateEvent
              ) => {
                await this.#handleBoardInfoUpdate(evt);
                if (evt.exported !== null) {
                  if (evt.subGraphId) {
                    await this.#attemptToggleExport(
                      evt.subGraphId,
                      "declarative"
                    );
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
                  this.tab,
                  evt.subGraphTitle
                );
                if (!result) {
                  this.toast(
                    Strings.from("ERROR_GENERIC"),
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                if (!this.tab) {
                  return;
                }
                this.tab.subGraphId = result;
                this.requestUpdate();
              }}
              @bbsubgraphdelete=${async (
                evt: BreadboardUI.Events.SubGraphDeleteEvent
              ) => {
                await this.#runtime.edit.deleteSubGraph(
                  this.tab,
                  evt.subGraphId
                );
                if (!this.tab) {
                  return;
                }

                this.#runtime.select.deselectAll(
                  this.tab.id,
                  this.#runtime.util.createWorkspaceSelectionChangeId()
                );
              }}
              @bbmodulechangelanguage=${(
                evt: BreadboardUI.Events.ModuleChangeLanguageEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.edit.changeModuleLanguage(
                  this.tab,
                  evt.moduleId,
                  evt.moduleLanguage
                );
              }}
              @bbmodulecreate=${(
                evt: BreadboardUI.Events.ModuleCreateEvent
              ) => {
                this.#attemptModuleCreate(evt.moduleId);
              }}
              @bbmoduledelete=${(
                evt: BreadboardUI.Events.ModuleDeleteEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.edit.deleteModule(this.tab, evt.moduleId);
              }}
              @bbmoduleedit=${(evt: BreadboardUI.Events.ModuleEditEvent) => {
                this.#runtime.edit.editModule(
                  this.tab,
                  evt.moduleId,
                  evt.code,
                  evt.metadata
                );
              }}
              @bbtoggleexport=${async (
                evt: BreadboardUI.Events.ToggleExportEvent
              ) => {
                await this.#attemptToggleExport(evt.exportId, evt.exportType);
              }}
              @bbthemechange=${async (
                evt: BreadboardUI.Events.ThemeChangeEvent
              ) => {
                await this.#runtime.edit.changeTheme(this.tab, evt.theme);
              }}
              @bbthemeupdate=${async (
                evt: BreadboardUI.Events.ThemeUpdateEvent
              ) => {
                await this.#runtime.edit.updateTheme(
                  this.tab,
                  evt.themeId,
                  evt.theme
                );
              }}
              @bbthemedelete=${async (
                evt: BreadboardUI.Events.ThemeUpdateEvent
              ) => {
                await this.#runtime.edit.deleteTheme(this.tab, evt.themeId);
              }}
              @bbthemecreate=${async (
                evt: BreadboardUI.Events.ThemeCreateEvent
              ) => {
                const projectState = this.#runtime.state.getOrCreate(
                  this.tab?.mainGraphId,
                  this.#runtime.edit.getEditor(this.tab)
                );

                const graphTheme: GraphTheme = {
                  template: "basic",
                  templateAdditionalOptions: {},
                  themeColors: {
                    primaryColor: evt.theme.primaryColor,
                    secondaryColor: evt.theme.secondaryColor,
                    backgroundColor: evt.theme.backgroundColor,
                    primaryTextColor: evt.theme.primaryTextColor,
                    textColor: evt.theme.textColor,
                  },
                };

                // TODO: Show some status.
                if (evt.theme.splashScreen) {
                  const data: LLMContent[] = [
                    {
                      role: "user",
                      parts: [evt.theme.splashScreen],
                    },
                  ];

                  // Convert inline data to stored asset.
                  if (isInlineData(evt.theme.splashScreen)) {
                    await projectState?.organizer.addGraphAsset({
                      path: "@@splash",
                      metadata: { title: "Splash", type: "file" },
                      data,
                    });

                    const splashScreen =
                      projectState?.graphAssets.get("@@splash")?.data[0]
                        ?.parts[0];
                    if (isStoredData(splashScreen)) {
                      graphTheme.splashScreen = splashScreen;
                    } else {
                      console.warn(
                        "Unable to save splash screen",
                        splashScreen
                      );
                    }

                    await projectState?.organizer.removeGraphAsset("@@splash");
                  }
                }

                await this.#runtime.edit.createTheme(this.tab, graphTheme);
              }}
              @bbnoderunrequest=${async (
                evt: BreadboardUI.Events.NodeRunRequestEvent
              ) => {
                await this.#attemptNodeRun(evt.id);
              }}
              @bbmovenodes=${async (
                evt: BreadboardUI.Events.MoveNodesEvent
              ) => {
                const { destinationGraphId } = evt;
                for (const [sourceGraphId, nodes] of evt.sourceNodes) {
                  await this.#runtime.edit.moveNodesToGraph(
                    this.tab,
                    nodes,
                    sourceGraphId === MAIN_BOARD_ID ? "" : sourceGraphId,
                    destinationGraphId === MAIN_BOARD_ID
                      ? ""
                      : destinationGraphId,
                    evt.positionDelta
                  );
                }

                if (!this.tab) {
                  return;
                }

                // Clear all selections.
                this.#runtime.select.processSelections(
                  this.tab.id,
                  this.#runtime.util.createWorkspaceSelectionChangeId(),
                  null,
                  true
                );
              }}
              @bbdroppedassets=${async (
                evt: BreadboardUI.Events.DroppedAssetsEvent
              ) => {
                const projectState = this.#runtime.state.getOrCreate(
                  this.tab?.mainGraphId,
                  this.#runtime.edit.getEditor(this.tab)
                );

                if (!projectState) {
                  this.toast(
                    "Unable to add",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                await Promise.all(
                  evt.assets.map((asset) => {
                    return projectState?.organizer.addGraphAsset({
                      path: asset.name,
                      metadata: {
                        title: asset.name,
                        type: "file",
                        visual: asset.visual,
                      },
                      data: [asset.content],
                    });
                  })
                );
              }}
              @bbedgeattachmentmove=${async (
                evt: BreadboardUI.Events.EdgeAttachmentMoveEvent
              ) => {
                const { graphId } = evt;
                await this.#runtime.edit.changeEdgeAttachmentPoint(
                  this.tab,
                  graphId === MAIN_BOARD_ID ? "" : graphId,
                  evt.edge,
                  evt.which,
                  evt.attachmentPoint
                );
              }}
              @bbedgechange=${async (
                evt: BreadboardUI.Events.EdgeChangeEvent
              ) => {
                await this.#runtime.edit.changeEdge(
                  this.tab,
                  evt.changeType,
                  evt.from,
                  evt.to,
                  evt.subGraphId
                );
              }}
              @bbassetedgechange=${async (
                evt: BreadboardUI.Events.AssetEdgeChangeEvent
              ) => {
                await this.#runtime.edit.changeAssetEdge(
                  this.tab,
                  evt.changeType,
                  evt.assetEdge,
                  evt.subGraphId
                );
              }}
              @bbnodemetadataupdate=${(
                evt: BreadboardUI.Events.NodeMetadataUpdateEvent
              ) => {
                this.#runtime.edit.updateNodeMetadata(
                  this.tab,
                  evt.id,
                  evt.metadata,
                  evt.subGraphId
                );
              }}
              @bbmultiedit=${async (
                evt: BreadboardUI.Events.MultiEditEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                await this.#runtime.edit.multiEdit(
                  this.tab,
                  evt.edits,
                  evt.description
                );

                const additions: string[] = evt.edits
                  .map((edit) =>
                    edit.type === "addnode" ? edit.node.id : null
                  )
                  .filter((item) => item !== null);
                if (additions.length === 0) {
                  return;
                }

                this.#runtime.select.selectNodes(
                  this.tab.id,
                  this.#runtime.select.generateId(),
                  evt.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
                  additions
                );
              }}
              @bbaddnodewithedge=${async (
                evt: BreadboardUI.Events.AddNodeWithEdgeEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                await this.#runtime.edit.addNodeWithEdge(
                  this.tab,
                  evt.node,
                  evt.edge,
                  evt.subGraphId
                );

                this.#runtime.select.selectNodes(
                  this.tab.id,
                  this.#runtime.select.generateId(),
                  evt.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
                  [evt.node.id]
                );
              }}
              @bbnodecreate=${async (
                evt: BreadboardUI.Events.NodeCreateEvent
              ) => {
                await this.#runtime.edit.createNode(
                  this.tab,
                  evt.id,
                  evt.nodeType,
                  evt.configuration,
                  evt.metadata,
                  evt.subGraphId,
                  evt.options
                );

                if (!this.tab) {
                  return;
                }

                this.#runtime.select.selectNode(
                  this.tab.id,
                  this.#runtime.select.generateId(),
                  evt.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
                  evt.id
                );
              }}
              @bbgraphreplace=${async (
                evt: BreadboardUI.Events.GraphReplaceEvent
              ) => {
                this.#runtime.edit.replaceGraph(
                  this.tab,
                  evt.replacement,
                  evt.creator
                );
              }}
              @bbnodeconfigurationupdaterequest=${async (
                evt: BreadboardUI.Events.NodeConfigurationUpdateRequestEvent
              ) => {
                const configuration = {
                  id: evt.id,
                  subGraphId: evt.subGraphId,
                  port: evt.port,
                  selectedPort: evt.selectedPort,
                  x: evt.x,
                  y: evt.y,
                  addHorizontalClickClearance: evt.addHorizontalClickClearance,
                  graphNodeLocation: evt.graphNodeLocation,
                };

                await this.#setNodeDataForConfiguration(configuration, null);
              }}
              @bbcommenteditrequest=${(
                evt: BreadboardUI.Events.CommentEditRequestEvent
              ) => {
                this.showCommentEditor = true;
                const value = this.#runtime.edit.getGraphComment(
                  this.tab,
                  evt.id,
                  evt.subGraphId
                );
                this.#commentValueData = {
                  x: evt.x,
                  y: evt.y,
                  value,
                  subGraphId: evt.subGraphId,
                };
              }}
              @bbnodeactivityselected=${(
                evt: BreadboardUI.Events.NodeActivitySelectedEvent
              ) => {
                this.#selectRun(evt);
              }}
              @bbcommentupdate=${(
                evt: BreadboardUI.Events.CommentUpdateEvent
              ) => {
                this.#runtime.edit.changeComment(
                  this.tab,
                  evt.id,
                  evt.text,
                  evt.subGraphId
                );
              }}
              @bbnodeupdate=${(evt: BreadboardUI.Events.NodeUpdateEvent) => {
                this.#runtime.edit.changeNodeConfiguration(
                  this.tab,
                  evt.id,
                  evt.configuration,
                  evt.subGraphId
                );
              }}
              @bbnodedelete=${(evt: BreadboardUI.Events.NodeDeleteEvent) => {
                this.#runtime.edit.deleteNode(this.tab, evt.id, evt.subGraphId);
              }}
              @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
                this.toast(toastEvent.message, toastEvent.toastType);
              }}
              @bbnodetyperetrievalerror=${() => {
                this.toast(
                  Strings.from("ERROR_UNABLE_TO_RETRIEVE_TYPE_INFO"),
                  BreadboardUI.Events.ToastType.ERROR
                );
              }}
              @bboutlinemodechange=${() => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.select.deselectAll(
                  this.tab?.id,
                  this.#runtime.util.createWorkspaceSelectionChangeId()
                );
              }}
            ></bb-ui-controller>
        ${
          this.showWelcomePanel
            ? html`<bb-project-listing
                .version=${this.#version}
                .gitCommitHash=${this.#gitCommitHash}
                .recentBoards=${this.#recentBoards}
                .selectedBoardServer=${this.selectedBoardServer}
                .selectedLocation=${this.selectedLocation}
                .boardServers=${this.#boardServers}
                .boardServerNavState=${this.boardServerNavState}
                .showAdditionalSources=${showAdditionalSources}
                @bbgraphboardserverblankboard=${() => {
                  this.#attemptBoardCreate(blank(), { role: "user" });
                }}
                @bbgraphboardservergeneratedboard=${(
                  evt: BreadboardUI.Events.GraphBoardServerGeneratedBoardEvent
                ) => {
                  this.#attemptBoardCreate(evt.graph, evt.creator);
                }}
                @bbgraphboardserveradd=${() => {
                  this.showBoardServerAddOverlay = true;
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
                  if (refreshed) {
                    this.toast(
                      Strings.from("STATUS_PROJECTS_REFRESHED"),
                      BreadboardUI.Events.ToastType.INFORMATION
                    );
                  } else {
                    this.toast(
                      Strings.from("ERROR_UNABLE_TO_REFRESH_PROJECTS"),
                      BreadboardUI.Events.ToastType.WARNING
                    );
                  }

                  this.boardServerNavState = globalThis.crypto.randomUUID();
                }}
                @bbgraphboardserverdisconnect=${async (
                  evt: BreadboardUI.Events.GraphBoardServerDisconnectEvent
                ) => {
                  await this.#runtime.board.disconnect(evt.location);
                  this.boardServerNavState = globalThis.crypto.randomUUID();
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

                  this.boardServerNavState = globalThis.crypto.randomUUID();
                }}
                @bbgraphboardserverloadrequest=${async (
                  evt: BreadboardUI.Events.GraphBoardServerLoadRequestEvent
                ) => {
                  this.showWelcomePanel = false;
                  this.#attemptBoardLoad(
                    new BreadboardUI.Events.StartEvent(evt.url)
                  );
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
                @bbgraphboardserverselectionchange=${(
                  evt: BreadboardUI.Events.GraphBoardServerSelectionChangeEvent
                ) => {
                  this.#persistBoardServerAndLocation(
                    evt.selectedBoardServer,
                    evt.selectedLocation
                  );
                }}
              ></bb-project-listing>`
            : nothing
        }
          </div>
      </div>`;
        const recentItemsKey =
          (this.graph?.url ?? "untitled-graph").replace(/[\W\s]/gim, "-") +
          `-${this.#viewCommandNamespace}`;
        const commands = [
          ...this.#globalCommands,
          ...(this.#viewCommands.get(this.#viewCommandNamespace) ?? []),
        ];
        const commandPalette = this.showCommandPalette
          ? html`<bb-command-palette
              .commands=${commands}
              .recentItemsKey=${recentItemsKey}
              .recencyType=${"local"}
              @pointerdown=${(evt: PointerEvent) => {
                evt.stopImmediatePropagation();
              }}
              @bbcommand=${(evt: BreadboardUI.Events.CommandEvent) => {
                this.#hideCommandPalette();

                const command = [
                  ...this.#globalCommands,
                  ...(this.#viewCommands.get(this.#viewCommandNamespace) ?? []),
                ].find((command) => command.name === evt.command);

                if (!command) {
                  console.warn(`Unable to find command "${evt.command}"`);
                  return;
                }

                if (!command.callback) {
                  console.warn(`No callback for command "${evt.command}"`);
                  return;
                }

                command.callback.call(
                  null,
                  evt.command,
                  command.secondaryAction
                );
              }}
              @bbpalettedismissed=${() => {
                this.#hideCommandPalette();
              }}
            ></bb-command-palette>`
          : nothing;

        const tabModules = Object.entries(this.tab?.graph.modules ?? {});

        // For standard, non-imperative graphs prepend the main board ID
        if (!this.tab?.graph.main) {
          tabModules.unshift([
            BreadboardUI.Constants.MAIN_BOARD_ID,
            { code: "" },
          ]);
        }

        const modules: BreadboardUI.Types.Command[] = tabModules
          .filter(([id]) => {
            if (this.tab?.moduleId) {
              return id !== this.tab?.moduleId;
            }

            return id !== BreadboardUI.Constants.MAIN_BOARD_ID;
          })
          .map(([id, module]): BreadboardUI.Types.Command => {
            if (id === BreadboardUI.Constants.MAIN_BOARD_ID) {
              return {
                title: `${Strings.from("COMMAND_OPEN")} ${Strings.from("LABEL_MAIN_PROJECT")}`,
                icon: "open",
                name: "open",
              };
            }
            return {
              title: `${Strings.from("COMMAND_OPEN")} ${module.metadata?.title ?? id}...`,
              icon: "open",
              name: "open",
              secondaryAction: id,
            };
          });

        const modulePalette = this.showModulePalette
          ? html`<bb-command-palette
              .commands=${modules}
              .recentItemsKey=${recentItemsKey}
              .recencyType=${"session"}
              @pointerdown=${(evt: PointerEvent) => {
                evt.stopImmediatePropagation();
              }}
              @bbcommand=${(evt: BreadboardUI.Events.CommandEvent) => {
                if (!this.tab) {
                  return;
                }

                this.#runtime.board.changeWorkspaceItem(
                  this.tab.id,
                  null,
                  evt.secondaryAction ?? null
                );
                this.#hideModulePalette();
              }}
              @bbpalettedismissed=${() => {
                this.#hideModulePalette();
              }}
            ></bb-command-palette>`
          : nothing;

        if (
          signInAdapter.state !== "anonymous" &&
          signInAdapter.state !== "valid"
        ) {
          return html`<bb-connection-entry-signin
            .adapter=${signInAdapter}
            @bbsignin=${async () => {
              window.location.reload();
            }}
          ></bb-connection-entry-signin>`;
        }

        return [
          ui,
          boardOverlay,
          settingsOverlay,
          firstRunOverlay,
          showNewWorkspaceItemOverlay,
          boardServerAddOverlay,
          nodeConfiguratorOverlay,
          commentOverlay,
          saveAsDialogOverlay,
          openDialogOverlay,
          commandPalette,
          modulePalette,
          boardOverflowMenu,
          userOverflowMenu,
          boardItemsOverflowMenu,
        ];
      });

    const tooltip = html`<bb-tooltip ${ref(this.#tooltipRef)}></bb-tooltip>`;
    return [until(uiController), tooltip, toasts];
  }
}
