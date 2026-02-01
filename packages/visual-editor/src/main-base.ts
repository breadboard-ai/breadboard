/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "./ui/index.js";
const Strings = BreadboardUI.Strings.forSection("Global");

import type { AppScreenOutput, BoardServer } from "@breadboard-ai/types";
import { GraphDescriptor } from "@breadboard-ai/types";
import { provide } from "@lit/context";
import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { SettingsHelperImpl } from "./ui/data/settings-helper.js";
import { SettingsStore } from "./ui/data/settings-store.js";

import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { styles as mainStyles } from "./index.styles.js";
import "./ui/lite/step-list-view/step-list-view.js";
import "./ui/lite/input/editor-input-lite.js";
import * as Runtime from "./runtime/runtime.js";
import {
  RuntimeConfig,
  WorkspaceSelectionStateWithChangeId,
} from "./runtime/types.js";

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

import {
  canonicalizeOAuthScope,
  type OAuthScope,
} from "./ui/connection/oauth-scopes.js";
import { boardServerContext } from "./ui/contexts/board-server.js";
import { GlobalConfig, globalConfigContext } from "./ui/contexts/contexts.js";
import { googleDriveClientContext } from "./ui/contexts/google-drive-client-context.js";
import { VESignInModal } from "./ui/elements/elements.js";
import { EmbedHandler, embedState, EmbedState } from "./ui/embed/embed.js";

import type {
  CheckAppAccessResult,
  GuestConfiguration,
  OpalShellHostProtocol,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { SignalWatcher } from "@lit-labs/signals";
import { effect } from "signal-utils/subtle/microtask-effect";
import { CheckAppAccessResponse } from "./ui/flow-gen/app-catalyst.js";
import {
  FlowGenerator,
  flowGeneratorContext,
} from "./ui/flow-gen/flow-generator.js";
import { ReactiveAppScreen } from "./ui/state/app-screen.js";
import {
  ActionTracker,
  RecentBoard,
  UserSignInResponse,
} from "./ui/types/types.js";
import { opalShellContext } from "./ui/utils/opal-shell-guest.js";
import { makeUrl, OAUTH_REDIRECT, parseUrl } from "./ui/utils/urls.js";

import { Admin } from "./admin.js";
import { keyboardCommands } from "./commands/commands.js";
import { KeyboardCommandDeps } from "./commands/types.js";
import { eventRoutes } from "./event-routing/event-routing.js";

import { hash } from "@breadboard-ai/utils";
import { MainArguments } from "./types/types.js";
import { actionTrackerContext } from "./ui/contexts/action-tracker-context.js";
import { guestConfigurationContext } from "./ui/contexts/guest-configuration.js";

import { sca, SCA } from "./sca/sca.js";
import { Utils } from "./sca/utils.js";
import { scaContext } from "./sca/context/context.js";
import { GraphUtils } from "./utils/graph-utils.js";

export { MainBase };

export type RenderValues = {
  canSave: boolean;
  saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS;
  projectState: BreadboardUI.State.Project | null;
  showingOverlay: boolean;
  themeHash: number;
  tabStatus: BreadboardUI.Types.STATUS;
};

const LOADING_TIMEOUT = 1250;

const SIGN_IN_CONSENT_KEY = "bb-has-sign-in-consent";
abstract class MainBase extends SignalWatcher(LitElement) {
  @provide({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig;

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  accessor settingsHelper: SettingsHelperImpl;

  @provide({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient;

  @provide({ context: BreadboardUI.Contexts.embedderContext })
  accessor embedState!: EmbedState;

  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer;

  @provide({ context: opalShellContext })
  accessor opalShell: OpalShellHostProtocol;

  @provide({ context: guestConfigurationContext })
  protected accessor guestConfiguration: GuestConfiguration;

  @provide({ context: actionTrackerContext })
  protected accessor actionTracker: ActionTracker;

  @provide({ context: scaContext })
  protected accessor sca: SCA;

  // Computed from SCA controller - no longer stored
  protected get tab(): Runtime.Types.Tab | null {
    return this.sca.controller.editor.graph.asTab();
  }

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

  @state()
  protected accessor tosStatus: CheckAppAccessResponse | null = null;

  // References.
  protected selectionState: WorkspaceSelectionStateWithChangeId | null = null;
  protected runtime: Runtime.Runtime;
  protected readonly snackbarRef = createRef<BreadboardUI.Elements.Snackbar>();

  // Run status now tracked by this.sca.controller.run.main
  protected lastPointerPosition = { x: 0, y: 0 };
  protected tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  protected canvasControllerRef: Ref<BreadboardUI.Elements.CanvasController> =
    createRef();
  protected feedbackPanelRef: Ref<BreadboardUI.Elements.FeedbackPanel> =
    createRef();
  protected readonly embedHandler: EmbedHandler | undefined;
  protected readonly settings: SettingsStore;
  protected readonly hostOrigin: URL;
  protected readonly logger: ReturnType<typeof Utils.Logging.getLogger> =
    Utils.Logging.getLogger();

  readonly #onShowTooltipBound = this.#onShowTooltip.bind(this);
  readonly #hideTooltipBound = this.#hideTooltip.bind(this);
  readonly #onKeyboardShortCut = this.#onKeyboardShortcut.bind(this);
  #urlEffectDisposer: (() => void) | null = null;
  #lastHandledUrl: string | null = null;

  static styles = mainStyles;

  constructor(args: MainArguments) {
    super();

    // Static deployment config
    this.globalConfig = args.globalConfig;

    // Configuration provided by shell host
    this.guestConfiguration = args.guestConfiguration;

    // User settings
    this.settings = args.settings;
    this.settingsHelper = new SettingsHelperImpl(this.settings);

    // Authentication
    this.opalShell = args.shellHost;
    this.hostOrigin = args.hostOrigin;

    // Controller
    const config: RuntimeConfig = {
      globalConfig: this.globalConfig,
      guestConfig: this.guestConfiguration,
      settings: this.settings,
      shellHost: this.opalShell,
      env: args.env,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
    };
    this.sca = sca(config, args.globalConfig.flags);
    this.sca.controller.global.debug.isHydrated.then(() => {
      this.sca.controller.global.debug.enabled = true;
    });
    Utils.Logging.setDebuggableAppController(this.sca.controller);

    // Append SCA to the config.
    config.sca = this.sca;
    this.runtime = new Runtime.Runtime(config);

    this.googleDriveClient = this.sca.services.googleDriveClient;

    // Asyncronously check if the user has an access restriction (e.g. geo) and
    // if they are signed in with all required scopes.
    this.sca.services.signinAdapter.state.then((state) => {
      if (state === "signedin") {
        this.actionTracker.updateSignedInStatus(true);
        this.sca.services.signinAdapter
          .checkAppAccess()
          .then(this.handleAppAccessCheckResult.bind(this));
        this.opalShell
          .validateScopes()
          .then(this.handleValidateScopesResult.bind(this));
      }
    });

    this.flowGenerator = this.sca.services.flowGenerator;
    this.actionTracker = this.sca.services.actionTracker;

    this.embedHandler = args.embedHandler;

    this.#addRuntimeEventHandlers();

    this.boardServer = this.sca.services.googleDriveBoardServer;

    if (this.globalConfig.ENABLE_EMAIL_OPT_IN) {
      this.sca.services.emailPrefsManager.refreshPrefs().then(() => {
        if (
          this.sca.services.emailPrefsManager.prefsValid &&
          !this.sca.services.emailPrefsManager.hasStoredPreferences
        ) {
          this.sca.controller.global.main.show.add("WarmWelcome");
        }
      });
    }

    // Admin.
    const admin = new Admin(
      args,
      this.globalConfig,
      this.googleDriveClient,
      this.sca.services.signinAdapter
    );
    admin.runtime = this.runtime;
    admin.settingsHelper = this.settingsHelper;

    this.sca.services.graphStore.addEventListener("update", (evt) => {
      const { mainGraphId } = evt;
      const current = this.tab?.mainGraphId;
      if (
        !current ||
        (mainGraphId !== current && !evt.affectedGraphs.includes(current))
      ) {
        return;
      }
      this.graphTopologyUpdateId++;
    });

    // Once we've determined the sign-in status, relay it to an embedder.
    this.sca.services.signinAdapter.state.then((state) =>
      this.embedHandler?.sendToEmbedder({
        type: "home_loaded",
        isSignedIn: state === "signedin",
      })
    );

    // Status updates polling is now handled by StatusUpdatesService in SCA
    // Router init is now handled by SCA trigger (registerInitTrigger)

    this.#checkSubscriptionStatus();

    this.logger.log(
      Utils.Logging.Formatter.info("Visual Editor Initialized"),
      Strings.from("APP_NAME"),
      false
    );

    // Handle initial URL (replaces RuntimeURLChangeEvent from router.init())
    this.#handleUrlChange();

    // Now create the effect to watch for SUBSEQUENT URL changes (back/forward)
    // This must come AFTER initial handling to avoid race conditions
    this.#urlEffectDisposer = effect(() => {
      this.#handleUrlChange();
    });

    this.doPostInitWork();
  }

  abstract handleAppAccessCheckResult(
    result: CheckAppAccessResult
  ): Promise<void>;

  async handleValidateScopesResult(result: ValidateScopesResult) {
    if (
      !result.ok &&
      (await this.sca.services.signinAdapter.state) === "signedin"
    ) {
      console.log(
        "[signin] oauth scopes were missing or the user revoked access, " +
          "forcing signin.",
        result
      );
      await this.sca.services.signinAdapter.signOut();
      window.location.href = makeUrl({
        page: "landing",
        redirect: parseUrl(window.location.href),
        missingScopes: result.code === "missing-scopes",
        oauthRedirect:
          new URL(window.location.href).searchParams.get(OAUTH_REDIRECT) ??
          undefined,
        guestPrefixed: true,
      });
    }
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

    // Dispose URL change effect
    if (this.#urlEffectDisposer) {
      this.#urlEffectDisposer();
      this.#urlEffectDisposer = null;
    }
  }

  async #checkSubscriptionStatus() {
    try {
      await this.sca.controller.isHydrated;
      const flags = await this.sca.controller.global.flags.flags();
      if (flags.googleOne) {
        this.logger.log(
          Utils.Logging.Formatter.verbose(`Checking subscriber status`),
          "Google One"
        );
        const response =
          await this.sca.services.apiClient.getG1SubscriptionStatus({
            include_credit_data: true,
          });
        this.sca.controller.global.main.subscriptionStatus = response.is_member
          ? "subscribed"
          : "not-subscribed";
        this.sca.controller.global.main.subscriptionCredits =
          response.remaining_credits;
      }
    } catch (err) {
      console.warn(err);
      this.sca.controller.global.main.subscriptionStatus = "error";
      this.sca.controller.global.main.subscriptionCredits = -2;
    }
  }

  #addRuntimeEventHandlers() {
    if (!this.runtime) {
      console.error("No runtime found");
      return;
    }

    this.runtime.select.addEventListener(
      Runtime.Events.RuntimeSelectionChangeEvent.eventName,
      (evt: Runtime.Events.RuntimeSelectionChangeEvent) => {
        // TODO: Consider plumbing project state directly into Select and
        // calling it from there directly.
        this.runtime.state.project?.stepEditor.updateSelection(
          evt.selectionState
        );
        this.selectionState = {
          selectionChangeId: evt.selectionChangeId,
          selectionState: evt.selectionState,
          moveToSelection: evt.moveToSelection,
        };

        this.requestUpdate();
      }
    );

    // Note: runtime.board and runtime.edit listeners removed - these classes
    // are now empty EventTargets. Functionality migrated to SCA:
    // - RuntimeShareMissingEvent: handled elsewhere
    // - RuntimeRequestSignInEvent: handled elsewhere
    // - RuntimeVisualChangeEvent: handled by SCA triggers
    // - RuntimeBoardLoadErrorEvent: handled by SCA
    // - RuntimeErrorEvent: handled by SCA

    // Note: RuntimeNewerSharedVersionEvent listener moved to
    // SCA trigger: Board.registerNewerVersionTrigger()

    // Note: RuntimeTabChangeEvent listener removed - logic moved to
    // #handleBoardStateChanged() which is called directly after load/close

    // Note: RuntimeTabCloseEvent listener removed - stop-run logic moved to
    // before close() call in route handler

    // Note: RuntimeBoardRunEvent listener removed -
    // run status now tracked by runner event listeners
    // set up in sca.actions.run.prepare() which updates
    // controller.run.main.status directly
  }

  /**
   * Reactive URL change handler (replaces RuntimeURLChangeEvent listener).
   *
   * This method is called by the effect created in init() and reacts to
   * changes in the parsedUrl signal (e.g., back/forward navigation).
   *
   * TODO: Remove this handler when runtime.state.syncProjectState() is
   * migrated to SCA and #handleBoardStateChanged no longer depends on Runtime.
   */
  async #handleUrlChange() {
    // Reading parsedUrl registers it as a signal dependency for the effect
    const parsedUrl = this.sca.controller.router.parsedUrl;

    // Serialize URL for deduplication - skip if we already handled this URL.
    // This prevents race conditions when the effect fires with the same URL
    // we just handled (e.g., during deep link initialization).
    const currentUrl = window.location.href;
    if (currentUrl === this.#lastHandledUrl) {
      return;
    }
    this.#lastHandledUrl = currentUrl;

    // Update mode from URL (only graph page URLs have mode)
    if ("mode" in parsedUrl && parsedUrl.mode) {
      this.sca.controller.global.main.mode = parsedUrl.mode;
    }

    // Track action
    const shared = parsedUrl.page === "graph" ? !!parsedUrl.shared : false;
    if (parsedUrl.page === "home") {
      this.sca.services.actionTracker.load("home", false);
    } else {
      this.sca.services.actionTracker.load(
        this.sca.controller.global.main.mode,
        shared
      );
    }

    // Close tab, go to the home page.
    if (parsedUrl.page === "home") {
      // Stop any running board before closing
      const closingTabId = this.tab?.id;
      if (closingTabId) {
        this.sca.controller.run.main.setStatus(
          BreadboardUI.Types.STATUS.STOPPED
        );
        this.sca.controller.run.main.abortController?.abort();
      }

      this.sca.actions.board.close();
      await this.#handleBoardStateChanged();
      return;
    } else {
      // Load the tab.
      const boardUrl = parsedUrl.page === "graph" ? parsedUrl.flow : undefined;
      if (!boardUrl || boardUrl === this.tab?.graph.url) {
        return;
      }

      let snackbarId: BreadboardUI.Types.SnackbarUUID | undefined;
      const loadingTimeout = setTimeout(() => {
        snackbarId = globalThis.crypto.randomUUID();
        this.sca.controller.global.snackbars.snackbar(
          Strings.from("STATUS_GENERIC_LOADING"),
          BreadboardUI.Types.SnackType.PENDING,
          [],
          true,
          snackbarId,
          true
        );
      }, LOADING_TIMEOUT);

      this.sca.controller.global.main.loadState = "Loading";
      const loadResult = await this.sca.actions.board.load(boardUrl);
      clearTimeout(loadingTimeout);
      if (snackbarId) {
        this.sca.controller.global.snackbars.unsnackbar(snackbarId);
      }
      if (!loadResult.success) {
        this.logger.log(
          Utils.Logging.Formatter.warning(
            `Failed to load board: ${loadResult.reason}`
          ),
          "Main Base"
        );

        // Handle different failure reasons with appropriate UI feedback
        switch (loadResult.reason) {
          case "load-failed": {
            // Check if this is a non-shared graph URL (should show MissingShare dialog)
            const currentUrlParsed = this.sca.controller.router.parsedUrl;
            if (
              currentUrlParsed &&
              "flow" in currentUrlParsed &&
              !currentUrlParsed.shared
            ) {
              // Show MissingShare dialog for permission/access issues
              this.sca.controller.global.main.show.add("MissingShare");
              this.sca.controller.global.main.loadState = "Error";
              // Set viewError for lite mode
              this.runtime.state.lite.viewError = Strings.from(
                "ERROR_UNABLE_TO_LOAD_PROJECT"
              );
            } else {
              // Generic load error
              this.sca.controller.global.main.loadState = "Error";
              // Set viewError for lite mode
              this.runtime.state.lite.viewError = Strings.from(
                "ERROR_UNABLE_TO_LOAD_PROJECT"
              );
              this.sca.controller.global.snackbars.snackbar(
                Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT"),
                BreadboardUI.Types.SnackType.WARNING,
                [],
                true,
                globalThis.crypto.randomUUID(),
                true
              );
            }
            break;
          }
          case "invalid-url":
            this.sca.controller.global.main.loadState = "Home";
            break;
          case "auth-required":
          case "race-condition":
            // These are handled internally or require no action
            break;
        }
      } else {
        await this.#handleBoardStateChanged();
      }
    }
  }

  async #generateGraph(intent: string): Promise<GraphDescriptor> {
    const generated = await this.flowGenerator.oneShot({ intent });
    if ("error" in generated) {
      throw new Error(generated.error);
    }
    return generated.flow;
  }

  async #generateBoardFromGraph(graph: GraphDescriptor) {
    const saveResult = await this.sca.actions.board.saveAs(graph, {
      start: Strings.from("STATUS_CREATING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_CREATED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    });

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
      const boardServer = this.sca.services.googleDriveBoardServer;
      await boardServer.flushSaveQueue(url.href);
      this.embedHandler.sendToEmbedder({
        type: "board_id_created",
        id: url.href,
      });
    }
  }

  /**
   * Handles post-load/close state changes.
   * Calls syncProjectState directly instead of event dispatch.
   */
  async #handleBoardStateChanged(): Promise<void> {
    // Sync project state (creates the Project object for the loaded graph)
    this.runtime.state.syncProjectState();

    const tab = this.tab;
    this.#maybeShowWelcomePanel();

    if (tab) {
      // Page title is now handled by the page title trigger in SCA

      const url = tab.graph.url;
      if (url) {
        this.sca.actions.run.prepare({
          graph: tab.graph,
          url,
          settings: this.settings,
          fetchWithCreds: this.sca.services.fetchWithCreds,
          flags: this.sca.controller.global.flags,
          getProjectRunState: () => this.runtime.state.project?.run,
          connectToProject: (runner, fileSystem, abortSignal) => {
            const project = this.runtime.state.project;
            if (project) {
              project.connectHarnessRunner(runner, fileSystem, abortSignal);
            }
          },
        });
      }

      if (tab.graph.url && tab.graphIsMine) {
        const board: RecentBoard = { url: tab.graph.url };
        if (tab.graph.title) board.title = tab.graph.title;
        this.sca.controller.home.recent.add(board);
      }

      this.sca.controller.global.main.loadState = "Loaded";
      this.runtime.select.refresh(
        tab.id,
        GraphUtils.createWorkspaceSelectionChangeId()
      );
    } else {
      this.sca.controller.router.clearFlowParameters();
      // Page title is now handled by the page title trigger in SCA
    }
  }

  #maybeShowWelcomePanel() {
    if (this.tab === null) {
      this.sca.controller.global.main.loadState = "Home";
    }

    if (this.sca.controller.global.main.loadState !== "Home") {
      return;
    }
    this.#hideAllOverlays();
    this.sca.controller.global.snackbars.unsnackbar();
  }

  #hideAllOverlays() {
    this.sca.controller.global.main.show.delete("BoardEditModal");
    this.sca.controller.global.main.show.delete("BetterOnDesktopModal");
    this.sca.controller.global.main.show.delete("MissingShare");
    this.sca.controller.global.main.show.delete("StatusUpdateModal");
    this.sca.controller.global.main.show.delete("VideoModal");
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
      sca: this.sca,
      selectionState: this.selectionState,
      tab: this.tab,
      originalEvent: evt,
      pointerLocation: this.lastPointerPosition,
      settings: this.settings,
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
          toastId = this.sca.controller.global.toasts.toast(
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
          this.sca.controller.global.main.blockingAction = true;
          await command.do(deps);
          this.sca.controller.global.main.blockingAction = false;

          // Replace the toast.
          if (toastId) {
            this.sca.controller.global.toasts.toast(
              command.messageComplete ?? Strings.from("STATUS_GENERIC_WORKING"),
              command.messageType ?? BreadboardUI.Events.ToastType.INFORMATION,
              false,
              toastId
            );
          }
        } catch (err) {
          const commandErr = err as { message: string };
          this.sca.controller.global.toasts.toast(
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
          this.sca.controller.global.main.blockingAction = false;
        }

        this.#handlingShortcut = false;
        break;
      }
    }
  }

  /**
   * @deprecated File drop to create new tab is no longer supported
   */
  protected attemptImportFromDrop(_evt: DragEvent) {
    // No-op: createTabFromDescriptor functionality removed
  }

  protected getRenderValues(): RenderValues {
    const tabStatus = this.sca.controller.run.main.status;

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

    // Inline canSave logic - use services directly
    let canSave = false;
    if (this.tab && !this.tab.readOnly) {
      const graphUrl = this.sca.controller.editor.graph.url;
      if (graphUrl) {
        const boardServer = this.sca.services.googleDriveBoardServer;
        const capabilities = boardServer?.canProvide(new URL(graphUrl));
        canSave = capabilities !== false && !!capabilities?.save;
      }
    }

    // Get saveStatus from controller and map to enum
    let saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS =
      BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;
    if (this.tab) {
      const status = this.sca.controller.editor.graph.saveStatus;
      switch (status) {
        case "saving":
          saveStatus = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING;
          break;
        case "saved":
          saveStatus = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED;
          break;
        case "unsaved":
          saveStatus = BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED;
          break;
        case "error":
          saveStatus = BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;
          break;
      }
    }

    return {
      canSave,
      projectState,
      saveStatus,
      showingOverlay: this.sca.controller.global.main.show.size > 0,
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
      googleDriveClient: this.googleDriveClient,
      askUserToSignInIfNeeded: (scopes: OAuthScope[]) =>
        this.askUserToSignInIfNeeded(scopes),
      boardServer: this.boardServer,
      actionTracker: this.actionTracker,
      embedHandler: this.embedHandler,
      sca: this.sca,
    };
  }

  protected willUpdate(): void {
    if (!this.sca.controller.global.main) {
      return;
    }

    if (this.tosStatus && !this.tosStatus.canAccess) {
      this.sca.controller.global.main.show.add("TOS");
    } else {
      this.sca.controller.global.main.show.delete("TOS");
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
    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  protected async invokeDeleteEventRouteWith(url: string) {
    this.sca.controller.global.main.blockingAction = true;
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
    this.sca.controller.global.main.blockingAction = false;

    if (refresh) {
      requestAnimationFrame(() => {
        this.requestUpdate();
      });
    }
  }

  protected renderSnackbar() {
    return html`<bb-snackbar
      ${ref(this.snackbarRef)}
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
            this.sca.controller.global.snackbars.lastDetailsInfo =
              evt.value ?? null;
            this.sca.controller.global.main.show.add("SnackbarDetailsModal");
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
    const verifyScopes = async (): Promise<boolean> => {
      if (!scopes?.length) {
        return true;
      }
      const currentScopes = await this.sca.services.signinAdapter.scopes;
      if (
        currentScopes &&
        scopes.every((scope) =>
          currentScopes.has(canonicalizeOAuthScope(scope))
        )
      ) {
        return true;
      }
      return false;
    };

    if ((await this.sca.services.signinAdapter.state) === "signedin") {
      if (await verifyScopes()) {
        if (!this.guestConfiguration.consentMessage) {
          return "success";
        }
        if (checkSignInConsent()) {
          return "success";
        } else {
          this.sca.controller.global.main.show.add("SignInModal");
          await this.updateComplete;
          const signInModal = this.signInModalRef.value;
          if (!signInModal) {
            console.warn(`Could not find sign-in modal.`);
            return "failure";
          }
          const result = await signInModal.openAndWaitForConsent();
          if (result === "success") {
            storeSignInConsent();
            return "success";
          } else {
            return "failure";
          }
        }
      }
    }
    this.sca.controller.global.main.show.add("SignInModal");
    await this.updateComplete;
    const signInModal = this.signInModalRef.value;
    if (!signInModal) {
      console.warn(`Could not find sign-in modal.`);
      return "failure";
    }
    const result = await signInModal.openAndWaitForSignIn(scopes);
    if (result === "success") {
      storeSignInConsent();
    }
    return result;
  }

  protected readonly signInModalRef = createRef<VESignInModal>();
  protected renderSignInModal(blurBackground = true) {
    return html`
      <bb-sign-in-modal
        ${ref(this.signInModalRef)}
        .consentMessage=${this.guestConfiguration.consentMessage}
        .blurBackground=${blurBackground}
        @bbmodaldismissed=${() => {
          this.sca.controller.global.main.show.delete("SignInModal");
        }}
      ></bb-sign-in-modal>
    `;
  }

  protected renderSnackbarDetailsModal() {
    return html`<bb-snackbar-details-modal
      .details=${this.sca.controller.global.snackbars.lastDetailsInfo}
      @bbmodaldismissed=${() => {
        this.sca.controller.global.snackbars.lastDetailsInfo = null;
        this.sca.controller.global.main.show.delete("SnackbarDetailsModal");
      }}
    ></bb-snackbar-details-modal>`;
  }

  protected renderConsentRequests() {
    if (this.sca.controller.global.consent.pendingModal.length === 0)
      return nothing;

    return html`
      <bb-consent-request-modal
        .consentRequest=${this.sca.controller.global.consent.pendingModal[0]}
      ></bb-consent-request-modal>
    `;
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

function checkSignInConsent(): boolean {
  const consent = localStorage.getItem(SIGN_IN_CONSENT_KEY);
  if (consent === "true") {
    return true;
  }
  return false;
}

function storeSignInConsent() {
  localStorage.setItem(SIGN_IN_CONSENT_KEY, "true");
}
