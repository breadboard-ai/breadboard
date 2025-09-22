/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import {
  createTokenVendor,
  TokenVendor,
} from "@breadboard-ai/connection-client";
import {
  createFileSystemBackend,
  createFlagManager,
} from "@breadboard-ai/data-store";
import { SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import type {
  BoardServer,
  ConformsToNodeValue,
  RunSecretEvent,
} from "@breadboard-ai/types";
import {
  addRunModule,
  composeFileSystemBackends,
  createEphemeralBlobStore,
  createFileSystem,
  GraphDescriptor,
  hash,
  MutableGraphStore,
  ok,
  PersistentBackend,
  SandboxedRunnableModuleFactory,
} from "@google-labs/breadboard";
import { provide } from "@lit/context";
import { html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { RecentBoardStore } from "./data/recent-boards";
import { styles as mainStyles } from "./index.styles.js";
import * as Runtime from "./runtime/runtime.js";
import {
  TabId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "./runtime/types";
import { SecretsHelper } from "./utils/secrets-helper";

import { createA2Server } from "@breadboard-ai/a2";
import { getGoogleDriveBoardService } from "@breadboard-ai/board-server-management";
import {
  CreateNewBoardMessage,
  EmbedHandler,
  embedState,
  EmbedState,
  IterateOnPromptMessage,
  ToggleIterateOnPromptMessage,
} from "@breadboard-ai/embed";
import { FileSystemPersistentBackend } from "@breadboard-ai/filesystem-board-server";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { McpManager } from "@breadboard-ai/mcp";
import {
  GlobalConfig,
  globalConfigContext,
} from "@breadboard-ai/shared-ui/contexts";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";
import { sideBoardRuntime } from "@breadboard-ai/shared-ui/contexts/side-board-runtime.js";
import { uiStateContext } from "@breadboard-ai/shared-ui/contexts/ui-state.js";
import { IterateOnPromptEvent } from "@breadboard-ai/shared-ui/events/events.js";
import {
  AppCatalystApiClient,
  CheckAppAccessResponse,
} from "@breadboard-ai/shared-ui/flow-gen/app-catalyst.js";
import {
  FlowGenerator,
  flowGeneratorContext,
} from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";
import { SideBoardRuntime } from "@breadboard-ai/shared-ui/sideboards/types.js";
import { ReactiveAppScreen } from "@breadboard-ai/shared-ui/state/app-screen.js";
import { type AppScreenOutput } from "@breadboard-ai/shared-ui/state/types.js";
import {
  ActionTracker,
  createActionTrackerBackend,
} from "@breadboard-ai/shared-ui/utils/action-tracker";
import {
  SIGN_IN_CONNECTION_ID,
  SigninAdapter,
  signinAdapterContext,
} from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { SignalWatcher } from "@lit-labs/signals";
import { classMap } from "lit/directives/class-map.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { Admin } from "./admin";
import { keyboardCommands } from "./commands/commands";
import { KeyboardCommandDeps } from "./commands/types";
import { eventRoutes } from "./event-routing/event-routing";
import { RuntimeBoardServerChangeEvent } from "./runtime/events.js";
import { sandbox } from "./sandbox";
import { MainArguments } from "./types/types";
import { envFromFlags } from "./utils/env-from-flags";
import { envFromSettings } from "./utils/env-from-settings";
import {
  makeUrl,
  type MakeUrlInit,
  parseUrl,
} from "@breadboard-ai/shared-ui/utils/urls.js";
import { VESignInModal } from "@breadboard-ai/shared-ui/elements/elements.js";
import {
  canonicalizeOAuthScope,
  type OAuthScope,
} from "@breadboard-ai/connection-client/oauth-scopes.js";
import { builtInMcpClients } from "./mcp-clients";

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
const UPDATE_HASH_KEY = "bb-main-update-hash";

const parsedUrl = parseUrl(window.location.href);

@customElement("bb-main")
export class Main extends SignalWatcher(LitElement) {
  @provide({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig;

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  accessor settingsHelper: SettingsHelperImpl;

  @provide({ context: BreadboardUI.Elements.tokenVendorContext })
  accessor tokenVendor: TokenVendor;

  @provide({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter;

  @provide({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient;

  @provide({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime;

  @provide({ context: BreadboardUI.Contexts.embedderContext })
  accessor embedState!: EmbedState;

  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer | undefined;

  @provide({ context: uiStateContext })
  @state()
  accessor #uiState!: BreadboardUI.State.UI;

  @state()
  accessor #tab: Runtime.Types.Tab | null = null;

  @state()
  accessor #boardServers: BoardServer[] = [];

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

  @state()
  set #statusUpdates(
    values: ConformsToNodeValue<BreadboardUI.Types.VisualEditorStatusUpdate>[]
  ) {
    values.sort((a, b) => {
      const aDate = new Date(a.date);
      const bDate = new Date(b.date);
      return bDate.getTime() - aDate.getTime();
    });

    const lastUpdateHash =
      globalThis.localStorage.getItem(UPDATE_HASH_KEY) ?? "0";
    const updateHash = hash(values).toString();
    if (lastUpdateHash === updateHash) {
      return;
    }

    globalThis.localStorage.setItem(UPDATE_HASH_KEY, updateHash);
    this.#statusUpdatesValues = values;

    if (
      values[0]?.type !== "info" &&
      this.#uiState.showStatusUpdateChip === null
    ) {
      this.#uiState.showStatusUpdateChip = true;
    }
  }
  get #statusUpdates() {
    return this.#statusUpdatesValues;
  }
  #statusUpdatesValues: BreadboardUI.Types.VisualEditorStatusUpdate[] = [];

  // References.
  readonly #canvasControllerRef: Ref<BreadboardUI.Elements.CanvasController> =
    createRef();
  readonly #tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  readonly #feedbackPanelRef: Ref<BreadboardUI.Elements.FeedbackPanel> =
    createRef();

  // The snackbar is not held as a Ref because we need to track pending snackbar
  // messages as they are coming in and, once the snackbar has rendered, we add
  // them. This means we use the ref callback to handle this case instead of
  // using to create and store the reference itself.
  #snackbar: BreadboardUI.Elements.Snackbar | undefined = undefined;
  #pendingSnackbarMessages: Array<{
    message: BreadboardUI.Types.SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  // Created or set up in the constructor / #init.
  #graphStore!: MutableGraphStore;
  #selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  #lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  #runtime!: Runtime.Runtime;

  // Various bits of state.
  readonly #boardRunStatus = new Map<TabId, BreadboardUI.Types.STATUS>();
  readonly #recentBoardStore = RecentBoardStore.instance();
  readonly #lastPointerPosition = { x: 0, y: 0 };
  readonly #embedHandler?: EmbedHandler;
  readonly #apiClient: AppCatalystApiClient;
  readonly #secretsHelper: SecretsHelper;
  readonly #settings: SettingsStore;

  // Event Handlers.
  readonly #onShowTooltipBound = this.#onShowTooltip.bind(this);
  readonly #hideTooltipBound = this.#hideTooltip.bind(this);
  readonly #onKeyboardShortCut = this.#onKeyboardShortcut.bind(this);

  static styles = mainStyles;

  constructor(args: MainArguments) {
    super();

    // Static deployment config
    this.globalConfig = args.globalConfig;

    // User settings
    this.#settings = args.settings;
    this.settingsHelper = new SettingsHelperImpl(this.#settings);
    this.#secretsHelper = new SecretsHelper(this.#settings);

    // Authentication
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
      this.globalConfig
    );

    this.signinAdapter = new SigninAdapter(
      this.tokenVendor,
      this.globalConfig,
      this.settingsHelper,
      (scopes?: OAuthScope[]) => this.#askUserToSignInIfNeeded(scopes)
    );

    // Asyncronously check if the user has a geo-restriction and sign out if so.
    if (this.signinAdapter.state !== "anonymous") {
      this.signinAdapter.token().then(async (result) => {
        if (
          result.state === "valid" &&
          (await this.signinAdapter.userHasGeoRestriction(
            result.grant.access_token
          ))
        ) {
          await this.signinAdapter.signOut();
          window.history.pushState(
            undefined,
            "",
            makeUrl({
              page: "landing",
              geoRestriction: true,
              redirect: { page: "home" },
            })
          );
          window.location.reload();
        }
      });
    }

    // API Clients
    let backendApiEndpoint = this.globalConfig.BACKEND_API_ENDPOINT;
    if (!backendApiEndpoint) {
      console.warn(`No BACKEND_API_ENDPOINT in ClientDeploymentConfiguration`);
      // Supply some value, so that we fail while calling the API, rather
      // than at initialization.
      // TODO: Come up with a more elegant solution.
      backendApiEndpoint = window.location.href;
    }

    this.#apiClient = new AppCatalystApiClient(
      this.signinAdapter,
      backendApiEndpoint
    );

    this.flowGenerator = new FlowGenerator(this.#apiClient);

    const proxyApiBaseUrl = new URL("/api/drive-proxy/", window.location.href)
      .href;
    const apiBaseUrl =
      this.signinAdapter.state === "anonymous"
        ? proxyApiBaseUrl
        : "https://www.googleapis.com";
    this.googleDriveClient = new GoogleDriveClient({
      apiBaseUrl,
      proxyApiBaseUrl,
      getUserAccessToken: async (scopes?: OAuthScope[]) => {
        const token = await this.signinAdapter.token(scopes);
        if (token.state === "valid") {
          return token.grant.access_token;
        }
        throw new Error(`User is signed out`);
      },
    });

    this.#embedHandler = args.embedHandler;

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
    const flagManager = createFlagManager(this.globalConfig.flags);
    const flags = await flagManager.flags();

    const mcp = new McpManager(
      builtInMcpClients,
      async (scopes) => {
        const token = await this.signinAdapter.token(scopes);
        if (token.state === "valid") {
          return token.grant.access_token;
        }
        // This will fail, and that's okay. We'll get the "Unauthorized"
        // error.
        return "";
      },
      this.globalConfig.BACKEND_API_ENDPOINT
    );

    const fileSystem = createFileSystem({
      env: [
        ...envFromSettings(this.#settings),
        ...(args.env || []),
        ...envFromFlags(flags),
      ],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(
        new Map<string, PersistentBackend>([
          [
            "fs",
            new FileSystemPersistentBackend(async (callback) => {
              return new Promise((resolve) => {
                // TOOD: Make this less terrible.
                const b = document.createElement("button");
                b.textContent = "Allow Access";
                b.style.cssText = `position:absolute;left:0;top:0;z-index:10000`;
                document.body.appendChild(b);
                b.addEventListener("click", () => {
                  resolve(callback());
                  b.remove();
                });
              });
            }),
          ],
          ["track", createActionTrackerBackend()],
          ["mcp", mcp.fileSystemBackend],
        ])
      ),
    });

    const moduleFactory = new SandboxedRunnableModuleFactory(sandbox);

    this.#runtime = await Runtime.create({
      recentBoardStore: this.#recentBoardStore,
      graphStore: this.#graphStore,
      experiments: {},
      globalConfig: this.globalConfig,
      tokenVendor: this.tokenVendor,
      sandbox: moduleFactory,
      settings: this.#settings,
      proxy: [],
      fileSystem,
      builtInBoardServers: [createA2Server()],
      kits: addRunModule(
        moduleFactory,
        args.kits || [],
        args.moduleInvocationFilter
      ),
      googleDriveClient: this.googleDriveClient,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
      flags: flagManager,
      mcpClientManager: mcp.clientManager,
    });
    this.#addRuntimeEventHandlers();

    this.#boardServers = this.#runtime.board.getBoardServers() || [];
    this.#uiState = this.#runtime.state.getOrCreateUIState();
    if (parsedUrl.page === "graph") {
      const shared = parsedUrl.page === "graph" ? !!parsedUrl.shared : false;
      ActionTracker.load(this.#uiState.mode, shared);
    } else if (parsedUrl.page === "home") {
      ActionTracker.load("home", false);
    }
    this.#graphStore = this.#runtime.board.getGraphStore();

    const hasMountedBoardServer = this.#findSelectedBoardServer(args);
    if (!hasMountedBoardServer && args.boardServerUrl) {
      console.log(`[Status] Mounting server "${args.boardServerUrl.href}" ...`);
      const connecting = await this.#runtime.board.connect(
        args.boardServerUrl.href
      );
      if (connecting?.success) {
        this.#findSelectedBoardServer(args);
        console.log(`[Status] Connected to server`);

        // Since we late-mounted the server we have to add it to the state
        // manager so it can be used by the Reactive Project.
        const mountedServer = this.#runtime.board.getBoardServerForURL(
          new URL(args.boardServerUrl.href)
        );

        this.#runtime.state.appendServer(mountedServer);
      }
    }

    if (
      args.boardServerUrl &&
      args.boardServerUrl.protocol === GoogleDriveBoardServer.PROTOCOL
    ) {
      const gdrive = await getGoogleDriveBoardService();
      if (gdrive) {
        args.boardServerUrl = new URL(gdrive.url);
      }
    }

    // Admin.
    const admin = new Admin(
      args,
      this.globalConfig,
      this.googleDriveClient,
      this.signinAdapter,
      this.tokenVendor
    );
    admin.runtime = this.#runtime;
    admin.settingsHelper = this.settingsHelper;

    // This is currently used only for legacy graph kits (Agent,
    // Google Drive).
    args.graphStorePreloader?.(this.#graphStore);

    this.sideBoardRuntime = this.#runtime.sideboards;
    this.sideBoardRuntime.addEventListener("empty", () => {
      this.#uiState.canRunMain = true;
    });
    this.sideBoardRuntime.addEventListener("running", () => {
      this.#uiState.canRunMain = false;
    });

    if (this.signinAdapter.state === "signedout") {
      return;
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

    // Once we've determined the sign-in status, relay it to an embedder.
    this.#embedHandler?.sendToEmbedder({
      type: "home_loaded",
      isSignedIn: this.signinAdapter.state === "signedin",
    });

    this.#maybeNotifyAboutPreferredUrlForDomain();
    this.#maybeNotifyAboutDesktopModality();

    this.#runtime.shell.startTrackUpdates();
    await this.#runtime.router.init();
  }

  #findSelectedBoardServer(args: MainArguments) {
    let hasMountedBoardServer = false;
    for (const server of this.#boardServers) {
      if (server.url.href === args.boardServerUrl?.href) {
        hasMountedBoardServer = true;
        this.#uiState.boardServer = server.name;
        this.#uiState.boardLocation = server.url.href;
        this.boardServer = server;
        break;
      }
    }
    return hasMountedBoardServer;
  }

  #maybeNotifyAboutDesktopModality() {
    if (
      parsedUrl.page !== "graph" ||
      !parsedUrl.shared ||
      parsedUrl.mode !== "canvas"
    ) {
      return;
    }

    // There's little point in attempting to differentiate between "mobile" and
    // "desktop" here for any number of reasons, but as a reasonable proxy we
    // will check that there's some screen estate available to show both the
    // editor and the app preview before we show the modal.
    if (window.innerWidth > 1280) {
      return;
    }

    this.#uiState.show.add("BetterOnDesktopModal");
  }

  async #maybeNotifyAboutPreferredUrlForDomain() {
    const domain = this.signinAdapter.domain;
    if (!domain) {
      return;
    }
    const url = this.globalConfig.domains?.[domain]?.preferredUrl;
    if (!url) {
      return;
    }

    this.snackbar(
      html`
        Users from ${domain} should prefer
        <a href="${url}">${new URL(url).hostname}</a>
      `,
      BreadboardUI.Types.SnackType.WARNING,
      [],
      true
    );
  }

  #addRuntimeEventHandlers() {
    if (!this.#runtime) {
      console.error("No runtime found");
      return;
    }

    const currentUrl = new URL(window.location.href);

    this.#runtime.board.addEventListener(
      RuntimeBoardServerChangeEvent.eventName,
      () => {
        this.#boardServers = this.#runtime.board.getBoardServers() || [];
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeShareMissingEvent.eventName,
      () => {
        this.#uiState.show.add("MissingShare");
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.RuntimeRequestSignInEvent.eventName,
      () => this.#askUserToSignInIfNeeded()
    );

    this.#runtime.addEventListener(
      Runtime.Events.RuntimeToastEvent.eventName,
      (evt: Runtime.Events.RuntimeToastEvent) => {
        this.toast(evt.message, evt.toastType, evt.persistent, evt.toastId);
      }
    );

    this.#runtime.addEventListener(
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

    this.#runtime.addEventListener(
      Runtime.Events.RuntimeUnsnackbarEvent.eventName,
      () => {
        this.unsnackbar();
      }
    );

    this.#runtime.addEventListener(
      Runtime.Events.RuntimeHostStatusUpdateEvent.eventName,
      (evt: Runtime.Events.RuntimeHostStatusUpdateEvent) => {
        this.#statusUpdates = evt.updates;
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
      Runtime.Events.RuntimeNewerSharedVersionEvent.eventName,
      () => {
        this.snackbar(
          Strings.from("STATUS_NEWER_VERSION"),
          BreadboardUI.Types.SnackType.INFORMATION,
          [],
          true,
          globalThis.crypto.randomUUID(),
          true
        );
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
          // TODO: Remove. This no longer happens.
          if (evt.topGraphObserver) {
            this.#runtime.run.create(this.#tab, evt.topGraphObserver);
          }

          if (this.#tab.graph.title) {
            this.#runtime.shell.setPageTitle(this.#tab.graph.title);
          }

          const preparingNextRun = await this.#runtime.prepareRun(
            this.#tab,
            this.#settings
          );
          if (!ok(preparingNextRun)) {
            console.warn(preparingNextRun.$error);
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
              this.signinAdapter.token().then((token) => {
                if (!runner?.running()) {
                  runner?.run({
                    [signInKey]:
                      token.state === "valid"
                        ? token.grant.access_token
                        : undefined,
                  });
                }
              });
              return;
            }

            this.#secretsHelper.setKeys(keys);
            if (this.#secretsHelper.hasAllSecrets()) {
              runner?.run(this.#secretsHelper.getSecrets());
            } else {
              const result = SecretsHelper.allKeysAreKnown(
                this.#settings,
                keys
              );
              if (result) {
                runner?.run(result);
              } else {
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
        if (parseUrl(urlWithoutMode).page === "home") {
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
            let snackbarId: BreadboardUI.Types.SnackbarUUID | undefined;
            const loadingTimeout = setTimeout(() => {
              snackbarId = globalThis.crypto.randomUUID();
              this.snackbar(
                Strings.from("STATUS_GENERIC_LOADING"),
                BreadboardUI.Types.SnackType.PENDING,
                [],
                true,
                snackbarId,
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
              evt.creator,
              evt.resultsFileId
            );
            clearTimeout(loadingTimeout);
            if (snackbarId) {
              this.unsnackbar(snackbarId);
            }
          }
        }
      }
    );
  }

  async #generateGraph(intent: string): Promise<GraphDescriptor> {
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
    this.#uiState.show.delete("BoardServerAddOverlay");
    this.#uiState.show.delete("BetterOnDesktopModal");
    this.#uiState.show.delete("MissingShare");
    this.#uiState.show.delete("StatusUpdateModal");
    this.#uiState.show.delete("VideoModal");
  }

  #onShowTooltip(evt: Event) {
    const tooltipEvent = evt as BreadboardUI.Events.ShowTooltipEvent;
    if (!this.#tooltipRef.value) {
      return;
    }

    const tooltips = this.#settings.getItem(
      BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
      "Show Tooltips"
    );
    if (!tooltips?.value) {
      return;
    }

    this.#tooltipRef.value.x = tooltipEvent.x;
    this.#tooltipRef.value.y = tooltipEvent.y;
    this.#tooltipRef.value.message = tooltipEvent.message;
    this.#tooltipRef.value.status = tooltipEvent.extendedOptions.status;
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
    // command. This is often something like the text inputs which have
    // preference over these more general keyboard commands.
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
      graphStore: this.#graphStore,
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
            command.messageTimeout ?? 500
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
          this.#uiState.blockingAction = false;
        }

        this.#handlingShortcut = false;
        break;
      }
    }
  }

  untoast(id?: string) {
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

    console.warn(message);
    this.#uiState.toasts.set(id, { message, type, persistent });
    return id;
  }

  snackbar(
    message: string | HTMLTemplateResult,
    type: BreadboardUI.Types.SnackType,
    actions: BreadboardUI.Types.SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbar) {
      this.#pendingSnackbarMessages.push({
        message: {
          id,
          message,
          type,
          persistent,
          actions,
        },
        replaceAll,
      });
      return;
    }

    return this.#snackbar.show(
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

  unsnackbar(id?: BreadboardUI.Types.SnackbarUUID) {
    if (!this.#snackbar) {
      return;
    }

    this.#snackbar.hide(id);
  }

  #attemptImportFromDrop(evt: DragEvent) {
    if (
      !evt.dataTransfer ||
      !evt.dataTransfer.files ||
      !evt.dataTransfer.files.length
    ) {
      return;
    }

    const fileDropped = evt.dataTransfer.files[0];
    fileDropped.text().then((data) => {
      try {
        const runData = JSON.parse(data) as GraphDescriptor;
        this.#runtime.board.createTabFromDescriptor(runData);
      } catch (err) {
        console.warn(err);
        this.toast(
          Strings.from("ERROR_LOAD_FAILED"),
          BreadboardUI.Events.ToastType.ERROR
        );
      }
    });
  }

  #getRenderValues(): RenderValues {
    const observers = this.#runtime?.run.getObservers(this.#tab?.id ?? null);
    const topGraphResult =
      observers?.topGraphObserver?.current() ??
      BreadboardUI.Utils.TopGraphObserver.entryResult();

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
      const current = new ReactiveAppScreen("", undefined);
      const last: AppScreenOutput = {
        output: this.#tab.finalOutputValues,
        schema: {},
      };
      current.outputs.set("final", last);
      projectState.run.app.screens.set("final", current);
    }

    const showExperimentalComponents: boolean = this.#settings
      .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
      .items.get("Show Experimental Components")?.value as boolean;

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
      showingOverlay: this.#uiState.show.size > 0,
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
    return {
      originalEvent: evt,
      runtime: this.#runtime,
      settings: this.#settings,
      secretsHelper: this.#secretsHelper,
      tab: this.#tab,
      uiState: this.#uiState,
      googleDriveClient: this.googleDriveClient,
      askUserToSignInIfNeeded: (scopes: OAuthScope[]) =>
        this.#askUserToSignInIfNeeded(scopes),
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

    if (this.signinAdapter.state === "signedout") {
      return html`<bb-connection-entry-signin
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
      ${this.#uiState.show.has("TOS") || this.#uiState.show.has("MissingShare")
        ? nothing
        : [
            this.#renderCanvasController(renderValues),
            this.#renderAppController(renderValues),
            this.#renderWelcomePanel(),
            this.#uiState.showStatusUpdateChip
              ? this.#renderStatusUpdateBar()
              : nothing,
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
      @bbunsnackbar=${(evt: BreadboardUI.Events.UnsnackbarEvent) => {
        this.unsnackbar(evt.snackbarId);
        console.log("Removing", evt.snackbarId);
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
        this.#uiState.show.has("MissingShare")
          ? this.#renderMissingShareDialog()
          : nothing,
        this.#uiState.show.has("TOS") ? this.#renderTosDialog() : nothing,
        this.#uiState.show.has("BoardServerAddOverlay")
          ? this.#renderBoardServerAddOverlay()
          : nothing,
        this.#uiState.show.has("BoardEditModal")
          ? this.#renderBoardEditModal()
          : nothing,
        this.#uiState.show.has("SnackbarDetailsModal")
          ? this.#renderSnackbarDetailsModal()
          : nothing,
        this.#uiState.show.has("BetterOnDesktopModal")
          ? this.#renderBetterOnDesktopModal()
          : nothing,
        this.#uiState.show.has("VideoModal")
          ? this.#renderVideoModal()
          : nothing,
        this.#uiState.show.has("StatusUpdateModal")
          ? this.#renderStatusUpdateModal()
          : nothing,
        this.#uiState.show.has("RuntimeFlags")
          ? this.#renderRuntimeFlagsModal()
          : nothing,
        this.#uiState.show.has("MCPServersModal")
          ? this.#renderMCPServersModal(renderValues)
          : nothing,
        this.#uiState.show.has("SignInModal")
          ? this.#renderSignInModal()
          : nothing,
        this.#renderTooltip(),
        this.#renderToasts(),
        this.#renderSnackbar(),
        this.#renderFeedbackPanel(),
      ]}
    </div>`;
  }

  #renderWelcomePanel() {
    if (this.#uiState.loadState !== "Home") {
      return nothing;
    }

    return html`<bb-project-listing
      .recentBoards=${this.#runtime.board.getRecentBoards()}
      .filter=${this.#uiState.projectFilter}
    ></bb-project-listing>`;
  }

  #renderAppController(renderValues: RenderValues) {
    const graphIsEmpty = BreadboardUI.Utils.isEmpty(this.#tab?.graph ?? null);
    const active =
      this.#uiState.mode === "app" && this.#uiState.loadState !== "Home";

    return html` <bb-app-controller
      class=${classMap({ active })}
      .graph=${this.#tab?.graph ?? null}
      .graphIsEmpty=${graphIsEmpty}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      .isMine=${this.#tab?.graphIsMine ?? false}
      .projectRun=${renderValues.projectState?.run}
      .readOnly=${true}
      .settings=${this.#settings}
      .showGDrive=${this.signinAdapter.state === "signedin"}
      .status=${renderValues.tabStatus}
      .themeHash=${renderValues.themeHash}
    >
    </bb-app-controller>`;
  }

  #renderCanvasController(renderValues: RenderValues) {
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
      @bbshowvideomodal=${() => {
        this.#uiState.show.add("VideoModal");
      }}
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

  #renderBetterOnDesktopModal() {
    return html`<bb-better-on-desktop-modal
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("BetterOnDesktopModal");
      }}
    ></bb-better-on-desktop-modal>`;
  }

  #renderSnackbarDetailsModal() {
    return html`<bb-snackbar-details-modal
      .details=${this.#uiState.lastSnackbarDetailsInfo}
      @bbmodaldismissed=${() => {
        this.#uiState.lastSnackbarDetailsInfo = null;
        this.#uiState.show.delete("SnackbarDetailsModal");
      }}
    ></bb-snackbar-details-modal>`;
  }

  #renderVideoModal() {
    return html`<bb-video-modal
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("VideoModal");
      }}
    ></bb-video-modal>`;
  }

  #renderStatusUpdateBar() {
    const classes: Record<string, boolean> = { "md-body-medium": true };
    const newestUpdate = this.#statusUpdates.at(0);
    if (!newestUpdate) {
      return nothing;
    }

    classes[newestUpdate.type] = true;
    let icon;
    switch (newestUpdate.type) {
      case "info":
        icon = html`info`;
        break;
      case "warning":
        icon = html`warning`;
        break;
      case "urgent":
        icon = html`error`;
        break;
      default:
        icon = nothing;
        break;
    }

    return html`<div
      id="status-update-bar"
      class=${classMap(classes)}
      aria-role="button"
      @click=${() => {
        this.#uiState.show.add("StatusUpdateModal");
        this.#uiState.showStatusUpdateChip = false;
      }}
    >
      <div>
        <span class="g-icon round filled">${icon}</span>
        <p>${newestUpdate.text}</p>
      </div>
      <button
        class="close"
        @click=${(evt: Event) => {
          evt.preventDefault();
          evt.stopImmediatePropagation();
          this.#uiState.showStatusUpdateChip = false;
        }}
      >
        <span class="g-icon round filled">close</span>
      </button>
    </div>`;
  }

  #renderStatusUpdateModal() {
    return html`<bb-status-update-modal
      .updates=${this.#statusUpdates}
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("StatusUpdateModal");
        this.#uiState.showStatusUpdateChip = false;
      }}
    ></bb-status-update-modal>`;
  }

  #renderMCPServersModal(renderValues: RenderValues) {
    return html`<bb-mcp-servers-modal
      .project=${renderValues.projectState}
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("MCPServersModal");
      }}
    ></bb-mcp-servers-modal>`;
  }

  #renderRuntimeFlagsModal() {
    return html`<bb-runtime-flags-modal
      .flags=${this.#runtime.flags.flags()}
      @bbmodaldismissed=${() => {
        this.#uiState.show.delete("RuntimeFlags");
      }}
    ></bb-runtime-flags-modal>`;
  }

  #renderMissingShareDialog() {
    return html`<dialog
      id="missing-share-dialog"
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }

        evt.preventDefault();
      }}
      ${ref((el: Element | undefined) => {
        const showModalIfNeeded = () => {
          if (el && this.#uiState.show.has("MissingShare") && el.isConnected) {
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
        <h1>Oops, something went wrong</h1>
        <p class="share-content">
          It has not been possible to open this app. Please ask the author to
          check that the app was published successfully and then try again.
        </p>
      </form>
    </dialog>`;
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
      ${ref((el: Element | undefined) => {
        if (!el) {
          this.#snackbar = undefined;
        }

        this.#snackbar = el as BreadboardUI.Elements.Snackbar;
        for (const pendingMessage of this.#pendingSnackbarMessages) {
          const { message, id, persistent, type, actions } =
            pendingMessage.message;
          this.snackbar(message, type, actions, persistent, id);
        }

        this.#pendingSnackbarMessages.length = 0;
      })}
      @bbsnackbaraction=${async (
        evt: BreadboardUI.Events.SnackbarActionEvent
      ) => {
        evt.callback?.();
        switch (evt.action) {
          case "remix": {
            if (!evt.value || typeof evt.value !== "string") {
              return;
            }

            this.#invokeRemixEventRouteWith(evt.value);
            break;
          }

          case "details": {
            this.#uiState.lastSnackbarDetailsInfo = evt.value ?? null;
            this.#uiState.show.add("SnackbarDetailsModal");
            break;
          }

          case "dismiss": {
            this.#runtime.state
              .getOrCreateProjectState(this.#tab?.mainGraphId)
              ?.run?.dismissError();
            break;
          }
        }
      }}
    ></bb-snackbar>`;
  }

  #renderHeader(renderValues: RenderValues) {
    return html`<bb-ve-header
      ?inert=${renderValues.showingOverlay || this.#uiState.blockingAction}
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
        await this.signinAdapter.signOut();
        ActionTracker.signOutSuccess();
        window.location.href = new URL("/", window.location.href).href;
      }}
      @bbclose=${() => {
        if (!this.#tab) {
          return;
        }
        this.#embedHandler?.sendToEmbedder({
          type: "back_clicked",
        });
        const homepage: MakeUrlInit = {
          page: "home",
          mode: this.#uiState.mode,
          dev: parsedUrl.dev,
        };
        if (this.signinAdapter.state === "signedin") {
          this.#runtime.router.go(homepage);
        } else {
          // Note that router.go() can't navigate to the landing page, because
          // it's a totally different entrypoint.
          window.location.assign(
            makeUrl({
              page: "landing",
              dev: parsedUrl.dev,
              redirect: homepage,
            })
          );
        }
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

            ActionTracker.remixApp(this.#tab.graph.url, "editor");
            this.#invokeRemixEventRouteWith(this.#tab.graph.url, {
              start: Strings.from("STATUS_GENERIC_WORKING"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_GENERIC"),
            });
            break;
          }

          case "feedback": {
            if (this.globalConfig.ENABLE_GOOGLE_FEEDBACK) {
              if (this.#feedbackPanelRef.value) {
                this.#feedbackPanelRef.value.open();
              } else {
                console.error(`Feedback panel was not rendered!`);
              }
            } else {
              const feedbackLink = this.globalConfig.FEEDBACK_LINK;
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

          case "demo-video": {
            this.#uiState.show.add("VideoModal");
            break;
          }

          case "history": {
            if (!this.#canvasControllerRef.value) {
              return;
            }

            this.#canvasControllerRef.value.sideNavItem = "edit-history";
            break;
          }

          case "show-runtime-flags": {
            this.#uiState.show.add("RuntimeFlags");
            break;
          }

          case "status-update": {
            this.#uiState.show.add("StatusUpdateModal");
            this.#uiState.showStatusUpdateChip = false;
            break;
          }

          case "show-mcp-servers": {
            this.#uiState.show.add("MCPServersModal");
            break;
          }

          case "copy-board-contents": {
            if (!this.#tab) {
              return;
            }

            await navigator.clipboard.writeText(
              JSON.stringify(this.#tab.graph, null, 2)
            );
            this.toast(
              Strings.from("STATUS_PROJECT_CONTENTS_COPIED"),
              BreadboardUI.Events.ToastType.INFORMATION
            );
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

  async #askUserToSignInIfNeeded(scopes?: OAuthScope[]): Promise<boolean> {
    if (this.signinAdapter.state === "signedin") {
      if (!scopes?.length) {
        return true;
      }
      const currentScopes = this.signinAdapter.scopes;
      if (
        currentScopes &&
        scopes.every((scope) =>
          currentScopes.has(canonicalizeOAuthScope(scope))
        )
      ) {
        return true;
      }
    }
    this.#uiState.show.add("SignInModal");
    await this.updateComplete;
    const signInModal = this.#signInModalRef.value;
    if (!signInModal) {
      console.warn(`Could not find sign-in modal.`);
      return false;
    }
    return signInModal.openAndWaitForSignIn(scopes);
  }

  readonly #signInModalRef = createRef<VESignInModal>();
  #renderSignInModal() {
    return html`
      <bb-sign-in-modal
        ${ref(this.#signInModalRef)}
        @bbmodaldismissed=${() => {
          this.#uiState.show.delete("SignInModal");
        }}
      ></bb-sign-in-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-main": Main;
  }
}
