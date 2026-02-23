/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "./ui/index.js";
const Strings = BreadboardUI.Strings.forSection("Global");

import { GraphDescriptor } from "@breadboard-ai/types";
import { provide } from "@lit/context";
import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";

import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { styles as mainStyles } from "./index.styles.js";
import "./ui/lite/step-list-view/step-list-view.js";
import "./ui/lite/input/editor-input-lite.js";
import "./ui/elements/notebooklm-picker/notebooklm-picker.js";
import { RuntimeConfig } from "./utils/graph-types.js";

import {
  canonicalizeOAuthScope,
  type OAuthScope,
} from "./ui/connection/oauth-scopes.js";

import { VESignInModal } from "./ui/elements/elements.js";
import { embedState, EmbedState } from "./ui/embed/embed.js";

import type {
  CheckAppAccessResult,
  ValidateScopesResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { SignalWatcher } from "@lit-labs/signals";
import { reactive } from "./sca/reactive.js";
import { CheckAppAccessResponse } from "./ui/flow-gen/app-catalyst.js";

import { RecentBoard, UserSignInResponse } from "./sca/types.js";
import { makeUrl, OAUTH_REDIRECT, parseUrl } from "./ui/navigation/urls.js";

import { Admin } from "./admin.js";

import { MainArguments } from "./types/types.js";

import { sca, SCA } from "./sca/sca.js";
import { Utils } from "./sca/utils.js";
import { scaContext } from "./sca/context/context.js";

export { MainBase };

export type RenderValues = {
  canSave: boolean;
  saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS;
  showingOverlay: boolean;
  runStatus: BreadboardUI.Types.STATUS;
};

const LOADING_TIMEOUT = 1250;
const SIGN_IN_CONSENT_KEY = "bb-has-sign-in-consent";

abstract class MainBase extends SignalWatcher(LitElement) {
  @provide({ context: BreadboardUI.Contexts.embedderContext })
  accessor embedState!: EmbedState;

  @provide({ context: scaContext })
  protected accessor sca: SCA;

  /**
   * @deprecated Use sca.controller.editor.graph.topologyVersion instead.
   * Kept as a @state() only to avoid breaking sub-components that still
   * receive it as a @property().
   */
  get graphTopologyUpdateId(): number {
    return this.sca.controller.editor.graph.topologyVersion;
  }

  @state()
  protected accessor tosStatus: CheckAppAccessResponse | null = null;

  // References.
  // NOTE: selectionState field removed. Selection is now managed
  // entirely by SelectionController via SCA.

  protected readonly snackbarRef = createRef<BreadboardUI.Elements.Snackbar>();

  // Run status now tracked by this.sca.controller.run.main
  protected lastPointerPosition = { x: 0, y: 0 };
  protected tooltipRef: Ref<BreadboardUI.Elements.Tooltip> = createRef();
  protected canvasControllerRef: Ref<BreadboardUI.Elements.CanvasController> =
    createRef();
  protected feedbackPanelRef: Ref<BreadboardUI.Elements.FeedbackPanel> =
    createRef();

  protected readonly hostOrigin: URL;
  protected readonly logger: ReturnType<typeof Utils.Logging.getLogger> =
    Utils.Logging.getLogger();

  readonly #onShowTooltipBound = this.#onShowTooltip.bind(this);
  readonly #hideTooltipBound = this.#hideTooltip.bind(this);
  #urlEffectDisposer: (() => void) | null = null;
  #lastHandledUrl: string | null = null;

  static styles = mainStyles;

  constructor(args: MainArguments) {
    super();

    // Static deployment config
    const globalConfig = args.globalConfig;

    // Configuration provided by shell host
    const guestConfiguration = args.guestConfiguration;

    // Authentication
    const opalShell = args.shellHost;
    this.hostOrigin = args.hostOrigin;

    // Controller
    const config: RuntimeConfig = {
      globalConfig,
      guestConfig: guestConfiguration,
      shellHost: opalShell,
      embedHandler: args.embedHandler,
      env: args.env,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
      askUserToSignInIfNeeded: (scopes) => this.askUserToSignInIfNeeded(scopes),
    };
    this.sca = sca(config, args.globalConfig.flags);

    // If the router encountered an invalid URL (e.g. unsupported flow ID),
    // show a warning snackbar once the controllers are hydrated.
    if (this.sca.controller.router.urlError) {
      this.sca.controller.isHydrated.then(() => {
        this.sca.controller.global.snackbars.snackbar(
          Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT"),
          BreadboardUI.Types.SnackType.WARNING,
          [],
          true,
          globalThis.crypto.randomUUID(),
          true
        );
        this.sca.controller.router.urlError = null;
      });
    }

    this.sca.services.signinAdapter.state.then((state) => {
      if (state === "signedin") {
        this.sca.services.actionTracker.updateSignedInStatus(true);
        this.sca.services.signinAdapter
          .checkAppAccess()
          .then(this.handleAppAccessCheckResult.bind(this));
        this.sca.services.shellHost
          .validateScopes()
          .then(this.handleValidateScopesResult.bind(this));
      }
    });

    if (this.sca.services.globalConfig.ENABLE_EMAIL_OPT_IN) {
      this.sca.services.emailPrefsManager.refreshPrefs().then(() => {
        if (
          this.sca.services.emailPrefsManager.prefsValid &&
          !this.sca.services.emailPrefsManager.hasStoredPreferences
        ) {
          this.sca.controller.global.main.show.add("WarmWelcome");
        }
      });
    }

    // Admin — side-effect: exposes `window.o` when URL has #owner-tools.
    new Admin(
      args,
      this.sca.services.globalConfig,
      this.sca.services.googleDriveClient,
      this.sca.services.signinAdapter
    );

    // Once we've determined the sign-in status, relay it to an embedder.
    this.sca.services.signinAdapter.state.then((state) =>
      this.sca.services.embedHandler?.sendToEmbedder({
        type: "home_loaded",
        isSignedIn: state === "signedin",
      })
    );

    // Status updates polling is now handled by StatusUpdatesService in SCA
    // Router init is now handled by SCA trigger (registerInitTrigger)

    this.#checkSubscriptionStatus();

    this.logger.log(
      Utils.Logging.Formatter.info("Visual Editor Initialized"),
      Strings.from("APP_NAME")
    );

    // Handle initial URL (replaces RuntimeURLChangeEvent from router.init())
    this.#handleUrlChange();

    // Now create the effect to watch for SUBSEQUENT URL changes (back/forward)
    // This must come AFTER initial handling to avoid race conditions
    this.#urlEffectDisposer = reactive(() => {
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

    if (this.sca.services.embedHandler) {
      this.embedState = embedState();
    }

    this.sca.services.embedHandler?.addEventListener(
      "toggle_iterate_on_prompt",
      ({ message }) => {
        this.embedState.showIterateOnPrompt = message.on;
      }
    );
    this.sca.services.embedHandler?.addEventListener(
      "create_new_board",
      ({ message }) => {
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
    this.sca.services.embedHandler?.sendToEmbedder({ type: "handshake_ready" });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.removeEventListener("bbhidetooltip", this.#hideTooltipBound);
    window.removeEventListener("pointerdown", this.#hideTooltipBound);

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

      if (this.sca.services.signinAdapter.stateSignal?.status === "signedin") {
        if (
          this.sca.services.signinAdapter.stateSignal.authuser === undefined
        ) {
          this.sca.controller.global.main.subscriptionStatus = "not-subscribed";
          return;
        }
      }

      if (flags.googleOne) {
        this.logger.log(
          Utils.Logging.Formatter.verbose(`Checking subscriber status`),
          "Google One"
        );
        const response =
          await this.sca.services.apiClient.getG1SubscriptionStatus({
            include_credit_data: true,
          });
        this.sca.controller.global.main.subscriptionStatus = response.isMember
          ? "subscribed"
          : "not-subscribed";
        this.sca.controller.global.main.subscriptionCredits =
          response.remainingCredits;
      }
    } catch (err) {
      console.warn(err);
      this.sca.controller.global.main.subscriptionStatus = "error";
      this.sca.controller.global.main.subscriptionCredits = -2;
    }
  }

  /**
   * Reactive URL change handler (replaces RuntimeURLChangeEvent listener).
   *
   * This method is called by the effect created in init() and reacts to
   * changes in the parsedUrl signal (e.g., back/forward navigation).
   *
   * TODO: Remove this handler when runtime.syncProjectState() is
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

    if (parsedUrl.page === "home") {
      this.sca.services.actionTracker.load("home");
    } else {
      this.sca.services.actionTracker.load(
        this.sca.controller.global.main.mode
      );
    }

    // Close board, go to the home page.
    if (parsedUrl.page === "home") {
      // Stop any running board before closing
      if (this.sca.controller.editor.graph.graph) {
        this.sca.controller.run.main.setStatus(
          BreadboardUI.Types.STATUS.STOPPED
        );
        this.sca.controller.run.main.abortController?.abort();
      }

      this.sca.actions.board.close();
      await this.#handleBoardStateChanged();
      return;
    } else {
      // Load the board.
      const boardUrl = parsedUrl.page === "graph" ? parsedUrl.flow : undefined;
      if (!boardUrl || boardUrl === this.sca.controller.editor.graph.url) {
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
      const loadResult = await this.sca.actions.board.load(boardUrl, {
        resultsFileId:
          parsedUrl.page === "graph" ? parsedUrl.results : undefined,
      });
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
            const currentUrlParsed = this.sca.controller.router.parsedUrl;
            if (currentUrlParsed.page === "graph") {
              this.sca.controller.global.main.show.add("MissingShare");
            } else {
              this.sca.controller.global.snackbars.snackbar(
                Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT"),
                BreadboardUI.Types.SnackType.WARNING,
                [],
                true,
                globalThis.crypto.randomUUID(),
                true
              );
            }
            this.sca.controller.global.main.loadState = "Error";
            // Set viewError for lite mode
            this.sca.controller.global.main.viewError = Strings.from(
              "ERROR_UNABLE_TO_LOAD_PROJECT"
            );
            break;
          }
          case "invalid-url":
            this.sca.controller.global.main.loadState = "Home";
            break;
          case "auth-required": {
            // Prompt the user to sign in
            const signInResult = await this.askUserToSignInIfNeeded();
            if (signInResult === "success") {
              // Reset URL tracking so we retry the load
              this.#lastHandledUrl = null;
              await this.#handleUrlChange();
            } else {
              // User declined to sign in - go home
              this.sca.controller.global.main.loadState = "Home";
            }
            break;
          }
          case "race-condition":
            // Handled internally - no action needed
            break;
        }
      } else {
        await this.#handleBoardStateChanged();
      }
    }
  }

  async #generateGraph(intent: string): Promise<GraphDescriptor> {
    const generated = await this.sca.services.flowGenerator.oneShot({ intent });
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

    if (this.sca.services.embedHandler) {
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
      await boardServer.graphIsFullyCreated(url.href);
      this.sca.services.embedHandler.sendToEmbedder({
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
    const gc = this.sca.controller.editor.graph;
    this.#maybeShowWelcomePanel();

    if (gc.graph) {
      // Page title is now handled by the page title trigger in SCA

      const url = gc.url;
      if (url) {
        this.sca.actions.run.prepare();
      }

      if (url && !gc.readOnly) {
        const board: RecentBoard = { url };
        if (gc.title) board.title = gc.title;
        this.sca.controller.home.recent.add(board);
      }

      this.sca.controller.global.main.loadState = "Loaded";
    } else {
      this.sca.controller.router.clearFlowParameters();
      // Page title is now handled by the page title trigger in SCA
    }
  }

  #maybeShowWelcomePanel() {
    if (this.sca.controller.editor.graph.graph === null) {
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

    this.tooltipRef.value.x = tooltipEvent.x;
    this.tooltipRef.value.y = tooltipEvent.y;
    this.tooltipRef.value.message = tooltipEvent.message;
    this.tooltipRef.value.status = tooltipEvent.extendedOptions.status;
    this.tooltipRef.value.isMultiLine =
      tooltipEvent.extendedOptions?.isMultiLine || false;
    this.tooltipRef.value.visible = true;
  }

  #hideTooltip() {
    if (!this.tooltipRef.value) {
      return;
    }

    this.tooltipRef.value.visible = false;
  }

  /**
   * @deprecated File drop to create new tab is no longer supported
   */
  protected attemptImportFromDrop(_evt: DragEvent) {
    // No-op: createTabFromDescriptor functionality removed
  }

  protected getRenderValues(): RenderValues {
    const runStatus = this.sca.controller.run.main.status;
    const gc = this.sca.controller.editor.graph;

    // Inline canSave logic - use services directly
    let canSave = false;
    if (gc.graph && !gc.readOnly) {
      const graphUrl = gc.url;
      if (graphUrl) {
        const boardServer = this.sca.services.googleDriveBoardServer;
        const capabilities = boardServer?.canProvide(new URL(graphUrl));
        canSave = capabilities !== false && !!capabilities?.save;
      }
    }

    // Get saveStatus from controller and map to enum
    let saveStatus: BreadboardUI.Types.BOARD_SAVE_STATUS =
      BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR;
    if (gc.graph) {
      const status = gc.saveStatus;
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
      saveStatus,
      showingOverlay: this.sca.controller.global.main.show.size > 0,
      runStatus,
    } satisfies RenderValues;
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

  protected invokeRemixEventRouteWith(
    url: string,
    messages = {
      start: Strings.from("STATUS_REMIXING_PROJECT"),
      end: Strings.from("STATUS_PROJECT_CREATED"),
      error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
    }
  ) {
    this.sca.services.stateEventBus.dispatchEvent(
      new BreadboardUI.Events.StateEvent({
        eventType: "board.remix",
        messages,
        url,
      })
    );
  }

  protected invokeDeleteEventRouteWith(url: string) {
    this.sca.services.stateEventBus.dispatchEvent(
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
    );
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
            this.sca.controller.run.main.dismissError();
            break;
          }
        }
      }}
    ></bb-snackbar>`;
  }

  protected renderNotebookLmPicker() {
    if (
      Utils.Helpers.isHydrating(
        () => this.sca.controller.global.flags?.enableNotebookLm
      )
    ) {
      return nothing;
    }
    if (!this.sca.controller.global.flags?.enableNotebookLm) {
      return nothing;
    }
    return html`<bb-notebooklm-picker></bb-notebooklm-picker>`;
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
        if (!this.sca.services.guestConfig.consentMessage) {
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
        .consentMessage=${this.sca.services.guestConfig.consentMessage}
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
    // Bridge: re-dispatch onto stateEventBus so SCA eventTrigger actions fire.
    // The event type must match the trigger's eventType (e.g. "node.change"),
    // not the DOM-level "bbevent" type that StateEvent uses.
    this.sca.services.stateEventBus.dispatchEvent(
      new BreadboardUI.Events.StateEvent(evt.detail)
    );
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
