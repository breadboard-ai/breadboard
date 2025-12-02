/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import { SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import type {
  AppScreenOutput,
  BoardServer,
  ConformsToNodeValue,
  RuntimeFlagManager,
} from "@breadboard-ai/types";
import {
  GraphDescriptor,
  hash,
  MutableGraphStore,
  ok,
} from "@google-labs/breadboard";
import { provide } from "@lit/context";
import { html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";

import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { RecentBoardStore } from "./data/recent-boards";
import { styles as mainStyles } from "./index.styles.js";
import * as Runtime from "./runtime/runtime.js";
import {
  TabId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "./runtime/types";

import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

import {
  canonicalizeOAuthScope,
  type OAuthScope,
} from "@breadboard-ai/shared-ui/connection/oauth-scopes.js";
import {
  GlobalConfig,
  globalConfigContext,
} from "@breadboard-ai/shared-ui/contexts";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import { consentManagerContext } from "@breadboard-ai/shared-ui/contexts/consent-manager.js";
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";
import { uiStateContext } from "@breadboard-ai/shared-ui/contexts/ui-state.js";
import { VESignInModal } from "@breadboard-ai/shared-ui/elements/elements.js";
import {
  EmbedHandler,
  embedState,
  EmbedState,
} from "@breadboard-ai/shared-ui/embed/embed.js";

import { CheckAppAccessResponse } from "@breadboard-ai/shared-ui/flow-gen/app-catalyst.js";
import {
  FlowGenerator,
  flowGeneratorContext,
} from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";
import { ReactiveAppScreen } from "@breadboard-ai/shared-ui/state/app-screen.js";
import { UserSignInResponse } from "@breadboard-ai/shared-ui/types/types.js";
import { ActionTracker } from "@breadboard-ai/shared-ui/utils/action-tracker";
import { ConsentManager } from "@breadboard-ai/shared-ui/utils/consent-manager.js";
import { EmailPrefsManager } from "@breadboard-ai/shared-ui/utils/email-prefs-manager.js";
import { opalShellContext } from "@breadboard-ai/shared-ui/utils/opal-shell-guest.js";
import {
  SigninAdapter,
  signinAdapterContext,
} from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { makeUrl, parseUrl } from "@breadboard-ai/shared-ui/utils/urls.js";
import {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { SignalWatcher } from "@lit-labs/signals";

import { Admin } from "./admin";
import { keyboardCommands } from "./commands/commands";
import { KeyboardCommandDeps } from "./commands/types";
import { eventRoutes } from "./event-routing/event-routing";

import { MainArguments } from "./types/types";

export { MainBase };

export type RenderValues = {
  canSave: boolean;
  saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS;
  projectState: BreadboardUI.State.Project | null;
  showingOverlay: boolean;
  showExperimentalComponents: boolean;
  themeHash: number;
  tabStatus: BreadboardUI.Types.STATUS;
};

const LOADING_TIMEOUT = 1250;
const BOARD_AUTO_SAVE_TIMEOUT = 1_500;
const UPDATE_HASH_KEY = "bb-main-update-hash";

const parsedUrl = parseUrl(window.location.href);

abstract class MainBase extends SignalWatcher(LitElement) {
  @provide({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig;

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  accessor settingsHelper: SettingsHelperImpl;

  @provide({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter;

  @provide({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient;

  @provide({ context: BreadboardUI.Contexts.embedderContext })
  accessor embedState!: EmbedState;

  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer;

  @provide({ context: uiStateContext })
  @state()
  accessor uiState: BreadboardUI.State.UI;

  @provide({ context: opalShellContext })
  accessor opalShell: OpalShellHostProtocol;

  @provide({ context: consentManagerContext })
  accessor #consentManager: ConsentManager;

  @state()
  protected accessor tab: Runtime.Types.Tab | null = null;

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
  protected accessor tosStatus: CheckAppAccessResponse | null = null;

  @state()
  protected set statusUpdates(
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
    this.statusUpdatesValues = values;

    if (
      values[0]?.type !== "info" &&
      this.uiState.showStatusUpdateChip === null
    ) {
      this.uiState.showStatusUpdateChip = true;
    }
  }
  get statusUpdates() {
    return this.statusUpdatesValues;
  }
  protected statusUpdatesValues: BreadboardUI.Types.VisualEditorStatusUpdate[] =
    [];

  // References.
  protected graphStore: MutableGraphStore;
  protected selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  protected lastVisualChangeId: WorkspaceVisualChangeId | null = null;
  protected runtime: Runtime.Runtime;

  protected snackbarElement: BreadboardUI.Elements.Snackbar | undefined =
    undefined;
  protected pendingSnackbarMessages: Array<{
    message: BreadboardUI.Types.SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  protected boardRunStatus = new Map<TabId, BreadboardUI.Types.STATUS>();
  protected recentBoardStore: RecentBoardStore;
  protected lastPointerPosition = { x: 0, y: 0 };
  protected tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  protected canvasControllerRef: Ref<BreadboardUI.Elements.CanvasController> =
    createRef();
  protected feedbackPanelRef: Ref<BreadboardUI.Elements.FeedbackPanel> =
    createRef();
  protected readonly embedHandler: EmbedHandler | undefined;
  protected readonly settings: SettingsStore;
  readonly emailPrefsManager: EmailPrefsManager;
  protected readonly hostOrigin: URL;

  // Configuration provided by shell host
  protected readonly guestConfiguration: GuestConfiguration;

  // Event Handlers.
  readonly #onShowTooltipBound = this.#onShowTooltip.bind(this);
  readonly #hideTooltipBound = this.#hideTooltip.bind(this);
  readonly #onKeyboardShortCut = this.#onKeyboardShortcut.bind(this);

  static styles = mainStyles;

  constructor(args: MainArguments) {
    super();

    // Static deployment config
    this.globalConfig = args.globalConfig;

    // Configuration provided by shell hos
    this.guestConfiguration = args.guestConfiguration;

    // User settings
    this.settings = args.settings;
    this.settingsHelper = new SettingsHelperImpl(this.settings);

    // Authentication
    this.opalShell = args.shellHost;
    this.hostOrigin = args.hostOrigin;

    this.runtime = new Runtime.Runtime({
      globalConfig: this.globalConfig,
      settings: this.settings,
      shellHost: this.opalShell,
      initialSignInState: args.initialSignInState,
      env: args.env,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
    });

    this.signinAdapter = this.runtime.signinAdapter;
    this.googleDriveClient = this.runtime.googleDriveClient;
    this.#consentManager = this.runtime.consentManager;
    this.recentBoardStore = this.runtime.recentBoardStore;

    // Asyncronously check if the user has a geo-restriction and sign out if so.
    if (this.signinAdapter.state === "signedin") {
      this.signinAdapter.checkAppAccess().then(async (access) => {
        if (!access.canAccess) {
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

    this.emailPrefsManager = this.runtime.emailPrefsManager;
    this.flowGenerator = this.runtime.flowGenerator;

    this.embedHandler = args.embedHandler;

    this.#addRuntimeEventHandlers();

    this.boardServer = this.runtime.googleDriveBoardServer;
    this.uiState = this.runtime.state.ui;

    if (this.globalConfig.ENABLE_EMAIL_OPT_IN) {
      this.emailPrefsManager.refreshPrefs().then(() => {
        if (
          this.emailPrefsManager.prefsValid &&
          !this.emailPrefsManager.hasStoredPreferences
        ) {
          this.uiState.show.add("WarmWelcome");
        }
      });
    }

    if (parsedUrl.page === "graph") {
      const shared = parsedUrl.page === "graph" ? !!parsedUrl.shared : false;
      ActionTracker.load(this.uiState.mode, shared);
    } else if (parsedUrl.page === "home") {
      ActionTracker.load("home", false);
    }
    this.graphStore = this.runtime.board.graphStore;

    // Admin.
    const admin = new Admin(
      args,
      this.globalConfig,
      this.googleDriveClient,
      this.signinAdapter
    );
    admin.runtime = this.runtime;
    admin.settingsHelper = this.settingsHelper;

    this.graphStore.addEventListener("update", (evt) => {
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

    // Once we've determined the sign-in status, relay it to an embedder.
    this.embedHandler?.sendToEmbedder({
      type: "home_loaded",
      isSignedIn: this.signinAdapter.state === "signedin",
    });

    this.#maybeNotifyAboutPreferredUrlForDomain();
    this.#maybeNotifyAboutDesktopModality();

    this.runtime.shell.startTrackUpdates();
    this.runtime.router.init();

    void this.#checkSubscriptionStatus(this.runtime.flags);

    console.log(`[${Strings.from("APP_NAME")} Visual Editor Initialized]`);
    this.doPostInitWork();
  }

  abstract doPostInitWork(): Promise<void>;

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.addEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.addEventListener("pointerdown", this.#hideTooltipBound);
    window.addEventListener("keydown", this.#onKeyboardShortCut);

    if (this.embedHandler) {
      this.embedState = embedState();
    }

    this.embedHandler?.addEventListener(
      "toggle_iterate_on_prompt",
      ({ message }) => {
        this.embedState.showIterateOnPrompt = message.on;
      }
    );
    this.embedHandler?.addEventListener("create_new_board", ({ message }) => {
      if (!message.prompt) {
        // If no prompt provided, generate an empty board.
        this.#generateBoardFromGraph(BreadboardUI.Utils.blankBoard());
      } else {
        void this.#generateGraph(message.prompt)
          .then((graph) => this.#generateBoardFromGraph(graph))
          .catch((error) => console.error("Error generating board", error));
      }
    });
    this.embedHandler?.sendToEmbedder({ type: "handshake_ready" });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.removeEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.removeEventListener("pointerdown", this.#hideTooltipBound);
    window.removeEventListener("keydown", this.#onKeyboardShortCut);
  }

  async #checkSubscriptionStatus(flagManager: RuntimeFlagManager) {
    try {
      const flags = await flagManager.flags();
      if (flags.googleOne) {
        console.log(`[Google One] Checking subscriber status`);
        const response = await this.runtime.apiClient.getG1SubscriptionStatus({
          include_credit_data: true,
        });
        this.uiState.subscriptionStatus = response.is_member
          ? "subscribed"
          : "not-subscribed";
        this.uiState.subscriptionCredits = response.remaining_credits;
      }
    } catch (err) {
      console.warn(err);
      this.uiState.subscriptionStatus = "error";
      this.uiState.subscriptionCredits = -2;
    }
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

    this.uiState.show.add("BetterOnDesktopModal");
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
        <a href="${url}" target="_blank">${new URL(url).hostname}</a>
      `,
      BreadboardUI.Types.SnackType.WARNING,
      [],
      true
    );
  }

  #addRuntimeEventHandlers() {
    if (!this.runtime) {
      console.error("No runtime found");
      return;
    }

    const currentUrl = new URL(window.location.href);

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeShareMissingEvent.eventName,
      () => {
        this.uiState.show.add("MissingShare");
      }
    );

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeRequestSignInEvent.eventName,
      () => this.askUserToSignInIfNeeded()
    );

    this.runtime.addEventListener(
      Runtime.Events.RuntimeToastEvent.eventName,
      (evt: Runtime.Events.RuntimeToastEvent) => {
        this.toast(evt.message, evt.toastType, evt.persistent, evt.toastId);
      }
    );

    this.runtime.addEventListener(
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

    this.runtime.addEventListener(
      Runtime.Events.RuntimeUnsnackbarEvent.eventName,
      () => {
        this.unsnackbar();
      }
    );

    this.runtime.addEventListener(
      Runtime.Events.RuntimeHostStatusUpdateEvent.eventName,
      (evt: Runtime.Events.RuntimeHostStatusUpdateEvent) => {
        this.statusUpdates = evt.updates;
      }
    );

    this.runtime.select.addEventListener(
      Runtime.Events.RuntimeSelectionChangeEvent.eventName,
      (evt: Runtime.Events.RuntimeSelectionChangeEvent) => {
        this.selectionState = {
          selectionChangeId: evt.selectionChangeId,
          selectionState: evt.selectionState,
          moveToSelection: evt.moveToSelection,
        };

        this.requestUpdate();
      }
    );

    this.runtime.edit.addEventListener(
      Runtime.Events.RuntimeVisualChangeEvent.eventName,
      (evt: Runtime.Events.RuntimeVisualChangeEvent) => {
        this.lastVisualChangeId = evt.visualChangeId;
        this.requestUpdate();
      }
    );

    this.runtime.edit.addEventListener(
      Runtime.Events.RuntimeBoardEditEvent.eventName,
      () => {
        this.runtime.board.save(
          this.tab?.id ?? null,
          BOARD_AUTO_SAVE_TIMEOUT,
          null
        );
      }
    );

    this.runtime.edit.addEventListener(
      Runtime.Events.RuntimeErrorEvent.eventName,
      (evt: Runtime.Events.RuntimeErrorEvent) => {
        // Wait a frame so we don't end up accidentally spamming the render.
        requestAnimationFrame(() => {
          this.toast(evt.message, BreadboardUI.Events.ToastType.ERROR);
        });
      }
    );

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeBoardLoadErrorEvent.eventName,
      () => {
        if (this.tab) {
          this.uiState.loadState = "Error";
        }

        this.toast(
          Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT"),
          BreadboardUI.Events.ToastType.ERROR
        );
      }
    );

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeErrorEvent.eventName,
      (evt: Runtime.Events.RuntimeErrorEvent) => {
        this.toast(evt.message, BreadboardUI.Events.ToastType.ERROR);
      }
    );

    this.runtime.board.addEventListener(
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

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeTabChangeEvent.eventName,
      async () => {
        this.tab = this.runtime.board.currentTab;
        this.#maybeShowWelcomePanel();

        if (this.tab) {
          if (this.tab.graph.title) {
            this.runtime.shell.setPageTitle(this.tab.graph.title);
          }

          const preparingNextRun = await this.runtime.prepareRun(
            this.tab,
            this.settings
          );
          if (!ok(preparingNextRun)) {
            console.warn(preparingNextRun.$error);
          }

          this.uiState.loadState = "Loaded";
          this.runtime.select.refresh(
            this.tab.id,
            this.runtime.util.createWorkspaceSelectionChangeId()
          );
        } else {
          this.runtime.router.clearFlowParameters();
          this.runtime.shell.setPageTitle(null);
        }
      }
    );

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeTabCloseEvent.eventName,
      async (evt: Runtime.Events.RuntimeTabCloseEvent) => {
        if (!evt.tabId) {
          return;
        }

        if (this.tab?.id !== evt.tabId) {
          return;
        }

        if (
          this.boardRunStatus.get(evt.tabId) ===
          BreadboardUI.Types.STATUS.STOPPED
        ) {
          return;
        }

        this.boardRunStatus.set(evt.tabId, BreadboardUI.Types.STATUS.STOPPED);
        this.runtime.run.getAbortSignal(evt.tabId)?.abort();
        this.requestUpdate();
      }
    );

    this.runtime.board.addEventListener(
      Runtime.Events.RuntimeBoardSaveStatusChangeEvent.eventName,
      () => {
        this.requestUpdate();
      }
    );

    this.runtime.run.addEventListener(
      Runtime.Events.RuntimeBoardRunEvent.eventName,
      (evt: Runtime.Events.RuntimeBoardRunEvent) => {
        if (this.tab && evt.tabId === this.tab.id) {
          this.requestUpdate();
        }

        switch (evt.runEvt.type) {
          case "start": {
            this.boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.RUNNING
            );
            break;
          }

          case "end": {
            this.boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.STOPPED
            );
            break;
          }

          case "error": {
            this.boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.STOPPED
            );
            break;
          }

          case "resume": {
            this.boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.RUNNING
            );
            break;
          }

          case "pause": {
            this.boardRunStatus.set(
              evt.tabId,
              BreadboardUI.Types.STATUS.PAUSED
            );
            break;
          }
        }
      }
    );

    this.runtime.router.addEventListener(
      Runtime.Events.RuntimeURLChangeEvent.eventName,
      async (evt: Runtime.Events.RuntimeURLChangeEvent) => {
        this.runtime.board.currentURL = evt.url;

        if (evt.mode) {
          this.uiState.mode = evt.mode;
        }

        const urlWithoutMode = new URL(evt.url);
        urlWithoutMode.searchParams.delete("mode");

        // Close tab, go to the home page.
        if (parseUrl(urlWithoutMode).page === "home") {
          if (this.tab) {
            this.runtime.board.closeTab(this.tab.id);
            return;
          }

          // This does a round-trip to clear out any tabs, after which it
          // will dispatch an event which will cause the welcome page to be
          // shown.
          this.runtime.board.createTabsFromURL(currentUrl);
        } else {
          // Load the tab.
          const boardUrl = this.runtime.board.getBoardURL(urlWithoutMode);
          if (!boardUrl || boardUrl === this.tab?.graph.url) {
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

            this.uiState.loadState = "Loading";
            await this.runtime.board.createTabFromURL(
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
    const generated = await this.flowGenerator.oneShot({ intent });
    if ("error" in generated) {
      throw new Error(generated.error);
    }
    return generated.flow;
  }

  async #generateBoardFromGraph(graph: GraphDescriptor) {
    const boardServerName = this.uiState.boardServer;
    const location = this.uiState.boardLocation;
    const fileName = `${globalThis.crypto.randomUUID()}.bgl.json`;

    const saveResult = await this.runtime.board.saveAs(
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

    if (this.embedHandler) {
      // When the board server is asked to create a new graph, it first makes a
      // very fast RPC just to allocate a drive file id, returns that file id,
      // and finishes initializing the graph in the background (uploading the
      // initial BGL file and setting some metadata). This allows us to show the
      // editor to the user very quickly, and the board server is smart about
      // knowing when it needs to wait for the background initialization to
      // complete (e.g. before saving if the user does an edit).
      //
      // However! When we are embedded, as soon as we broadcast the file id to
      // the embedder, there will be a hard reload of the page with that file
      // id. If we didn't get a chance to finish initialization, then that graph
      // will appear to not exist, and the user will get an error.
      //
      // So, we need to wait for full initialization before we broadcast.
      const { url } = saveResult;
      const boardServer = this.runtime.board.googleDriveBoardServer;
      await boardServer.flushSaveQueue(url.href);
      this.embedHandler.sendToEmbedder({
        type: "board_id_created",
        id: url.href,
      });
    }
  }

  #maybeShowWelcomePanel() {
    if (this.tab === null) {
      this.uiState.loadState = "Home";
    }

    if (this.uiState.loadState !== "Home") {
      return;
    }
    this.#hideAllOverlays();
    this.unsnackbar();
  }

  #hideAllOverlays() {
    this.uiState.show.delete("BoardEditModal");
    this.uiState.show.delete("BetterOnDesktopModal");
    this.uiState.show.delete("MissingShare");
    this.uiState.show.delete("StatusUpdateModal");
    this.uiState.show.delete("VideoModal");
  }

  #onShowTooltip(evt: Event) {
    const tooltipEvent = evt as BreadboardUI.Events.ShowTooltipEvent;
    if (!this.tooltipRef.value) {
      return;
    }

    const tooltips = this.settings.getItem(
      BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
      "Show Tooltips"
    );
    if (!tooltips?.value) {
      return;
    }

    this.tooltipRef.value.x = tooltipEvent.x;
    this.tooltipRef.value.y = tooltipEvent.y;
    this.tooltipRef.value.message = tooltipEvent.message;
    this.tooltipRef.value.status = tooltipEvent.extendedOptions.status;
    this.tooltipRef.value.visible = true;
  }

  #hideTooltip() {
    if (!this.tooltipRef.value) {
      return;
    }

    this.tooltipRef.value.visible = false;
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
      runtime: this.runtime,
      selectionState: this.selectionState,
      tab: this.tab,
      originalEvent: evt,
      pointerLocation: this.lastPointerPosition,
      settings: this.settings,
      graphStore: this.graphStore,
      strings: Strings,
    } as const;

    for (const [keys, command] of keyboardCommands) {
      if (keys.includes(key) && command.willHandle(this.tab, evt)) {
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
          this.uiState.blockingAction = true;
          await command.do(deps);
          this.uiState.blockingAction = false;

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
          this.uiState.blockingAction = false;
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

    this.uiState.toasts.delete(id);
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
    this.uiState.toasts.set(id, { message, type, persistent });
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
    if (!this.snackbarElement) {
      this.pendingSnackbarMessages.push({
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

    return this.snackbarElement.show(
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
    if (!this.snackbarElement) {
      if (!id) {
        this.pendingSnackbarMessages.length = 0;
      } else {
        this.pendingSnackbarMessages = this.pendingSnackbarMessages.filter(
          (message) => message.message.id !== id
        );
      }
      return;
    }

    this.snackbarElement.hide(id);
  }

  protected attemptImportFromDrop(evt: DragEvent) {
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
        this.runtime.board.createTabFromDescriptor(runData);
      } catch (err) {
        console.warn(err);
        this.toast(
          Strings.from("ERROR_LOAD_FAILED"),
          BreadboardUI.Events.ToastType.ERROR
        );
      }
    });
  }

  protected getRenderValues(): RenderValues {
    let tabStatus = BreadboardUI.Types.STATUS.STOPPED;
    if (this.tab) {
      tabStatus =
        this.boardRunStatus.get(this.tab.id) ??
        BreadboardUI.Types.STATUS.STOPPED;
    }

    let themeHash = 0;
    if (
      this.tab?.graph?.metadata?.visual?.presentation?.themes &&
      this.tab?.graph?.metadata?.visual?.presentation?.theme
    ) {
      const theme = this.tab.graph.metadata.visual.presentation.theme;
      const themes = this.tab.graph.metadata.visual.presentation.themes;

      if (themes[theme]) {
        themeHash = hash(themes[theme]);
      }
    }

    const projectState = this.runtime.state.project;

    if (projectState && this.tab?.finalOutputValues) {
      const current = new ReactiveAppScreen("", undefined);
      current.status = "complete";
      const last: AppScreenOutput = {
        output: this.tab.finalOutputValues,
        schema: {},
      };
      current.outputs.set("final", last);
      projectState.run.app.screens.set("final", current);
    }

    const showExperimentalComponents: boolean = this.settings
      .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
      .items.get("Show Experimental Components")?.value as boolean;

    const canSave = this.tab
      ? this.runtime.board.canSave(this.tab.id) && !this.tab.readOnly
      : false;

    const saveStatus = this.tab
      ? (this.runtime.board.saveStatus(this.tab.id) ??
        BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED)
      : BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;

    return {
      canSave,
      projectState,
      saveStatus,
      showingOverlay: this.uiState.show.size > 0,
      showExperimentalComponents,
      themeHash,
      tabStatus,
    } satisfies RenderValues;
  }

  protected collectEventRouteDeps(
    evt: BreadboardUI.Events.StateEvent<
      keyof BreadboardUI.Events.StateEventDetailMap
    >
  ) {
    return {
      originalEvent: evt,
      runtime: this.runtime,
      settings: this.settings,
      tab: this.tab,
      uiState: this.uiState,
      googleDriveClient: this.googleDriveClient,
      askUserToSignInIfNeeded: (scopes: OAuthScope[]) =>
        this.askUserToSignInIfNeeded(scopes),
      boardServer: this.boardServer,
      embedHandler: this.embedHandler,
    };
  }

  protected willUpdate(): void {
    if (!this.uiState) {
      return;
    }

    if (this.tosStatus && !this.tosStatus.canAccess) {
      this.uiState.show.add("TOS");
    } else {
      this.uiState.show.delete("TOS");
    }
  }

  protected renderTooltip() {
    return html`<bb-tooltip ${ref(this.tooltipRef)}></bb-tooltip>`;
  }

  protected async invokeRemixEventRouteWith(
    url: string,
    messages = {
      start: Strings.from("STATUS_REMIXING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_CREATED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    }
  ) {
    this.uiState.blockingAction = true;
    const remixRoute = eventRoutes.get("board.remix");
    const refresh = await remixRoute?.do(
      this.collectEventRouteDeps(
        new BreadboardUI.Events.StateEvent({
          eventType: "board.remix",
          messages,
          url,
        })
      )
    );
    this.uiState.blockingAction = false;
    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  protected async invokeDeleteEventRouteWith(url: string) {
    this.uiState.blockingAction = true;
    const deleteRoute = eventRoutes.get("board.delete");
    const refresh = await deleteRoute?.do(
      this.collectEventRouteDeps(
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
    this.uiState.blockingAction = false;

    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  protected renderSnackbar() {
    return html`<bb-snackbar
      ${ref((el: Element | undefined) => {
        if (!el) {
          this.snackbarElement = undefined;
          return;
        }

        this.snackbarElement = el as BreadboardUI.Elements.Snackbar;
        for (const pendingMessage of this.pendingSnackbarMessages) {
          const { message, id, persistent, type, actions } =
            pendingMessage.message;
          this.snackbar(message, type, actions, persistent, id);
        }

        this.pendingSnackbarMessages.length = 0;
      })}
      @bbsnackbaraction=${async (
        evt: BreadboardUI.Events.SnackbarActionEvent
      ) => {
        if ("callback" in evt && evt.callback) {
          await evt.callback();
        }

        switch (evt.action) {
          case "remix": {
            if (!evt.value || typeof evt.value !== "string") {
              return;
            }

            this.invokeRemixEventRouteWith(evt.value);
            break;
          }

          case "details": {
            this.uiState.lastSnackbarDetailsInfo = evt.value ?? null;
            this.uiState.show.add("SnackbarDetailsModal");
            break;
          }

          case "dismiss": {
            this.runtime.state.project?.run?.dismissError();
            break;
          }
        }
      }}
    ></bb-snackbar>`;
  }

  protected async askUserToSignInIfNeeded(
    scopes?: OAuthScope[]
  ): Promise<UserSignInResponse> {
    if (this.signinAdapter.state === "signedin") {
      if (!scopes?.length) {
        return "success";
      }
      const currentScopes = this.signinAdapter.scopes;
      if (
        currentScopes &&
        scopes.every((scope) =>
          currentScopes.has(canonicalizeOAuthScope(scope))
        )
      ) {
        return "success";
      }
    }
    this.uiState.show.add("SignInModal");
    await this.updateComplete;
    const signInModal = this.signInModalRef.value;
    if (!signInModal) {
      console.warn(`Could not find sign-in modal.`);
      return "failure";
    }
    return signInModal.openAndWaitForSignIn(scopes);
  }

  protected readonly signInModalRef = createRef<VESignInModal>();
  protected renderSignInModal() {
    return html`
      <bb-sign-in-modal
        ${ref(this.signInModalRef)}
        .consentMessage=${this.guestConfiguration.consentMessage}
        @bbmodaldismissed=${() => {
          this.uiState.show.delete("SignInModal");
        }}
      ></bb-sign-in-modal>
    `;
  }

  protected renderConsentRequests() {
    if (this.uiState.consentRequests[0]) {
      return html`
        <bb-consent-request-modal
          .consentRequest=${this.uiState.consentRequests[0]}
          @bbmodaldismissed=${() => {
            this.uiState.consentRequests.shift();
          }}
        ></bb-consent-request-modal>
      `;
    }
    return nothing;
  }

  protected async handleRoutedEvent(
    evt: BreadboardUI.Events.StateEvent<
      keyof BreadboardUI.Events.StateEventDetailMap
    >
  ) {
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
    const shouldRender = await eventRoute.do(this.collectEventRouteDeps(evt));

    // Some legacy actions require an update after running, so if the event
    // handler returns with a true, schedule an update.
    if (shouldRender) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }
}
