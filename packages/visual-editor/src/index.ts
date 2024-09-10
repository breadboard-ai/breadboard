/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HarnessProxyConfig,
  HarnessRunner,
  RunConfig,
  RunErrorEvent,
  RunSecretEvent,
} from "@google-labs/breadboard/harness";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { map } from "lit/directives/map.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  blankLLMContent,
  createRunObserver,
  GraphDescriptor,
  GraphProvider,
  InputValues,
  InspectableRun,
  Kit,
  SerializedRun,
} from "@google-labs/breadboard";
import { getDataStore, getRunStore } from "@breadboard-ai/data-store";
import { classMap } from "lit/directives/class-map.js";
import { loadKits } from "./utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import { FileSystemGraphProvider } from "./providers/file-system";
import BuildExampleKit from "./build-example-kit";
import { SettingsStore } from "./data/settings-store";
import { addNodeProxyServerConfig } from "./data/node-proxy-servers";
import { provide } from "@lit/context";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";
import { RecentBoardStore } from "./data/recent-boards";
import { SecretsHelper } from "./utils/secrets-helper";
import { SettingsHelperImpl } from "./utils/settings-helper";
import * as Runtime from "./runtime/runtime.js";

const STORAGE_PREFIX = "bb-main";

type MainArguments = {
  boards: BreadboardUI.Types.Board[];
  providers?: GraphProvider[];
  settings?: SettingsStore;
  proxy?: HarnessProxyConfig[];
  version?: string;
};

type SaveAsConfiguration = {
  title: string;
  graph: GraphDescriptor;
  isNewBoard: boolean;
};

const generatedUrls = new Set<string>();

const ENVIRONMENT: BreadboardUI.Contexts.Environment = {
  connectionServerUrl: import.meta.env.VITE_CONNECTION_SERVER_URL,
  connectionRedirectUrl: "/oauth/",
  plugins: {
    input: [
      BreadboardUI.Elements.googleDriveFileIdInputPlugin,
      BreadboardUI.Elements.googleDriveQueryInputPlugin,
    ],
  },
};

@customElement("bb-main")
export class Main extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @state()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = null;

  @state()
  run: InspectableRun | null = null;

  @state()
  kits: Kit[] = [];

  @state()
  embed = false;

  @state()
  showNav = false;

  @state()
  showProviderAddOverlay = false;

  @state()
  showOverflowMenu = false;

  @state()
  showHistory = false;

  @state()
  showFirstRun = false;

  @state()
  showWelcomePanel = false;

  @state()
  showSaveAsDialog = false;
  #saveAsState: SaveAsConfiguration | null = null;

  @state()
  showNodeConfigurator = false;
  #nodeConfiguratorData: BreadboardUI.Types.NodePortConfiguration | null = null;

  @state()
  boardEditOverlayInfo: {
    title: string;
    version: string;
    description: string;
    published: boolean | null;
    isTool: boolean | null;
    subGraphId: string | null;
  } | null = null;

  @state()
  showSettingsOverlay = false;

  @state()
  toasts = new Map<
    string,
    {
      message: string;
      type: BreadboardUI.Events.ToastType;
      persistent: boolean;
    }
  >();

  @state()
  providerOps = 0;

  @provide({ context: BreadboardUI.Contexts.environmentContext })
  environment = ENVIRONMENT;

  @provide({ context: BreadboardUI.Elements.tokenVendorContext })
  tokenVendor!: BreadboardUI.Elements.TokenVendor;

  @state()
  dataStore = getDataStore();

  @state()
  runStore = getRunStore();

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  settingsHelper!: SettingsHelperImpl;

  @state()
  selectedProvider = "IDBGraphProvider";

  @state()
  selectedLocation = "default";

  @state()
  previewOverlayURL: URL | null = null;

  @property()
  tab: Runtime.Types.VETab | null = null;

  #abortController: AbortController | null = null;
  #uiRef: Ref<BreadboardUI.Elements.UI> = createRef();
  #boardId = 0;
  #boardPendingSave = false;
  #status = BreadboardUI.Types.STATUS.STOPPED;
  #runner: HarnessRunner | null = null;
  #providers: GraphProvider[];
  #settings: SettingsStore | null;
  #secretsHelper: SecretsHelper | null = null;
  /**
   * Optional proxy configuration for the board.
   * This is used to provide additional proxied nodes.
   */
  #proxy: HarnessProxyConfig[];
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #downloadRunBound = this.#downloadRun.bind(this);
  #selectRunBound = this.#selectRun.bind(this);
  #confirmUnloadWithUserFirstIfNeededBound =
    this.#confirmUnloadWithUserFirstIfNeeded.bind(this);
  #failedGraphLoad = false;
  #version = "dev";
  #recentBoardStore: RecentBoardStore;
  #recentBoards: BreadboardUI.Types.RecentBoard[] = [];
  #isSaving = false;

  #runtime: Runtime.RuntimeInstance;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      flex: 1 0 auto;
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 12) auto;
    }

    bb-toast {
      z-index: 2000;
    }

    :host > header {
      display: grid;
      grid-template-columns: auto min-content;
      padding: calc(var(--bb-grid-size) * 6) calc(var(--bb-grid-size) * 8)
        calc(var(--bb-grid-size) * 0) calc(var(--bb-grid-size) * 8);
      font-size: var(--bb-text-default);
      grid-column: 1 / 3;
    }

    :host > header a {
      text-decoration: none;
      white-space: nowrap;
    }

    #show-nav {
      font-size: 0;
      width: 24px;
      height: 24px;
      background: var(--bb-icon-menu) center center no-repeat;
      border: none;
      margin-right: calc(var(--bb-grid-size) * 2);
      cursor: pointer;
    }

    #close-board {
      font-size: 0;
      width: 20px;
      height: 20px;
      background: var(--bb-icon-close) center center no-repeat;
      background-size: 16px 16px;
      border: 2px solid transparent;
      margin-left: calc(var(--bb-grid-size) * 2);
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      border-radius: 50%;
    }

    #close-board:not([disabled]) {
      cursor: pointer;
    }

    #close-board:not([disabled]):hover {
      transition-duration: 0.1s;
      opacity: 1;
      background-color: var(--bb-neutral-300);
      border: 2px solid var(--bb-neutral-300);
    }

    #new-board {
      font-size: var(--bb-text-nano);
    }

    #undo,
    #redo,
    #save-board,
    #toggle-preview,
    #toggle-settings,
    #toggle-overflow-menu {
      color: var(--bb-neutral-50);
      padding: 0 16px 0 42px;
      font-size: var(--bb-text-medium);
      margin: 0 calc(var(--bb-grid-size) * 3) 0 0;
      cursor: pointer;
      background: 12px center var(--bb-icon-download);
      background-repeat: no-repeat;
      height: calc(100% - var(--bb-grid-size) * 4);
      display: flex;
      align-items: center;
      text-decoration: none;
      border-radius: 20px;
      border: none;
    }

    #undo:not([disabled]):hover,
    #redo:not([disabled]):hover,
    #undo:not([disabled]):focus,
    #redo:not([disabled]):focus,
    #save-board:not([disabled]):hover,
    #toggle-preview:not([disabled]):hover,
    #toggle-settings:not([disabled]):hover,
    #toggle-overflow-menu:not([disabled]):hover,
    #save-board:not([disabled]):focus,
    #toggle-preview:not([disabled]):focus,
    #toggle-settings:not([disabled]):focus,
    #toggle-overflow-menu:not([disabled]):focus {
      background-color: rgba(0, 0, 0, 0.1);
    }

    #save-board {
      background: 12px center var(--bb-icon-save-inverted);
      background-repeat: no-repeat;
    }

    #toggle-preview {
      background: 12px center var(--bb-icon-preview);
      background-repeat: no-repeat;
    }

    #undo,
    #redo,
    #toggle-overflow-menu {
      padding: 8px;
      font-size: 0;
      margin-right: 0;
      background: center center var(--bb-icon-more-vert-inverted);
      background-repeat: no-repeat;
      width: 32px;
    }

    #undo {
      background-image: var(--bb-icon-undo-inverted);
    }

    #redo {
      background-image: var(--bb-icon-redo-inverted);
    }

    #undo[disabled],
    #redo[disabled] {
      opacity: 0.5;
    }

    #toggle-preview.active {
      background-color: var(--bb-ui-800);
    }

    #toggle-settings {
      padding: 8px;
      font-size: 0;
      margin-right: 0;
      background: center center var(--bb-icon-settings);
      background-repeat: no-repeat;
      width: 32px;
    }

    #toggle-settings.active {
      background-color: var(--bb-ui-800);
    }

    #new-board {
      font-size: var(--bb-text-small);
      text-decoration: underline;
    }

    #new-board:active {
      color: rgb(90, 64, 119);
    }

    #save-board[disabled],
    #get-log[disabled],
    #get-board[disabled],
    #toggle-preview[disabled],
    #save-board[disabled]:hover,
    #get-log[disabled]:hover,
    #get-board[disabled]:hover,
    #toggle-preview[disabled]:hover {
      opacity: 0.5;
      background-color: rgba(0, 0, 0, 0);
      pointer-events: none;
      cursor: auto;
    }

    bb-board-list {
      grid-column: 1 / 3;
    }

    #header-bar {
      background: var(--bb-ui-600);
      display: flex;
      align-items: center;
      color: var(--bb-neutral-50);
      z-index: 1;
      height: calc(var(--bb-grid-size) * 12);
      padding: 0 calc(var(--bb-grid-size) * 2);
    }

    #header-bar #tab-container {
      flex: 1;
      display: flex;
      align-items: flex-end;
      margin: 0;
      height: 100%;
      overflow: hidden;
    }

    #tab-container h1 {
      font-size: var(--bb-label-medium);
      font-weight: normal;
      background: var(--bb-neutral-0);
      color: var(--bb-neutral-800);
      margin: 0;
      height: calc(100% - var(--bb-grid-size) * 2);
      border-radius: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2)
        0 0;
      padding: 0 calc(var(--bb-grid-size) * 4);
      display: flex;
      align-items: center;
      user-select: none;
      margin-right: var(--bb-grid-size-2);
    }

    #tab-container .back-to-main-board {
      padding: 0;
      margin: 0;
      cursor: pointer;
      background: none;
      border: none;
      color: var(--bb-neutral-800);
      opacity: 0.6;
    }

    #tab-container .back-to-main-board:disabled {
      cursor: auto;
      color: var(--bb-neutral-800);
    }

    #tab-container .back-to-main-board.active {
      opacity: 1;
    }

    #tab-container .subgraph-name {
      display: flex;
      align-items: center;
    }

    #tab-container .subgraph-name::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-icon-next) center center no-repeat;
      background-size: 12px 12px;
    }

    #content {
      max-height: calc(100svh - var(--bb-grid-size) * 12);
      display: flex;
      flex-direction: column;
    }

    iframe {
      grid-row: 1 / 3;
      grid-column: 1 / 3;
      margin: 0;
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }

    bb-overlay iframe {
      width: 80vw;
      height: 80vh;
      border-radius: 8px;
    }

    #embed {
      grid-column: 1/3;
      grid-row: 1/3;
    }

    #embed iframe {
      margin: 0;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 0;
    }

    #embed header {
      display: flex;
      padding: 0 calc(var(--bb-grid-size) * 9);
      align-items: center;
    }
  `;
  proxyFromUrl: string | undefined;

  #load: Promise<void>;
  constructor(config: MainArguments) {
    super();

    const providerLocation = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-provider`
    );
    if (providerLocation) {
      const [provider, location] = providerLocation.split("::");

      if (provider && location) {
        this.selectedProvider = provider;
        this.selectedLocation = location;
      }
    }

    this.#recentBoardStore = RecentBoardStore.instance();
    this.#version = config.version || "dev";
    this.#providers = config.providers || [];
    this.#settings = config.settings || null;
    this.#proxy = config.proxy || [];
    if (this.#settings) {
      this.settingsHelper = new SettingsHelperImpl(this.#settings);
      this.tokenVendor = new BreadboardUI.Elements.TokenVendor(
        this.settingsHelper,
        ENVIRONMENT
      );
    }

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const embedFromUrl = currentUrl.searchParams.get("embed");
    const firstRunFromUrl = currentUrl.searchParams.get("firstrun");

    if (firstRunFromUrl && firstRunFromUrl === "true") {
      this.showFirstRun = true;
    }

    const proxyFromUrl = currentUrl.searchParams.get("python_proxy");
    if (proxyFromUrl) {
      console.log("Setting python_proxy: %s", proxyFromUrl);
      this.proxyFromUrl = proxyFromUrl;
    }

    this.embed = embedFromUrl !== null && embedFromUrl !== "false";

    this.#runtime = Runtime.create({
      providers: config.providers ?? [],
      runStore: this.runStore,
      dataStore: this.dataStore,
    });

    this.#runtime.edit.addEventListener(
      Runtime.Events.VEEditEvent.eventName,
      () => {
        this.#nodeConfiguratorData = null;
        this.showNodeConfigurator = false;
        this.requestUpdate();
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.VEBoardLoadErrorEvent.eventName,
      () => {
        this.#failedGraphLoad = true;
        this.toast("Unable to load board", BreadboardUI.Events.ToastType.ERROR);
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.VEErrorEvent.eventName,
      (evt: Runtime.Events.VEErrorEvent) => {
        this.toast(evt.message, BreadboardUI.Events.ToastType.ERROR);
      }
    );

    this.#runtime.board.addEventListener(
      Runtime.Events.VETabChangeEvent.eventName,
      async (evt: Runtime.Events.VETabChangeEvent) => {
        this.tab = this.#runtime.board.currentTab;
        this.showWelcomePanel = this.tab === null;

        if (this.tab) {
          // If there is a TGO in the tab change event, honor it and populate a
          // run with it before switching to the tab proper.
          if (evt.topGraphObserver) {
            this.#runtime.run.create(this.tab.id, evt.topGraphObserver);
          }

          if (this.tab.graph.url) {
            this.#setUrlParam("board", this.tab.graph.url);
            await this.#trackRecentBoard(this.tab.graph.url);

            const base = new URL(window.location.href);
            const decodedUrl = decodeURIComponent(base.href);
            window.history.replaceState({ path: decodedUrl }, "", decodedUrl);
          }

          if (this.tab.graph.title) {
            this.#setPageTitle(this.tab.graph.title);
          }
        }
      }
    );

    this.#runtime.run.addEventListener(
      Runtime.Events.VERunEvent.eventName,
      (evt: Runtime.Events.VERunEvent) => {
        if (!this.tab) {
          return;
        }

        // TODO: Figure out what to do here; if we change away from the run in
        // the middle we will lose track of where we are in the run.
        if (evt.tabId !== this.tab.id) {
          return;
        }

        switch (evt.runEvt.type) {
          case "next": {
            // TODO: Decide if the run needs to be stopped.
            this.requestUpdate();
            break;
          }

          case "graphstart": {
            this.requestUpdate();
            break;
          }

          case "start": {
            this.status = BreadboardUI.Types.STATUS.RUNNING;
            break;
          }

          case "end": {
            this.status = BreadboardUI.Types.STATUS.STOPPED;
            break;
          }

          case "error": {
            const runEvt = evt.runEvt as RunErrorEvent;
            this.toast(
              BreadboardUI.Utils.formatError(runEvt.data.error),
              BreadboardUI.Events.ToastType.ERROR
            );
            this.status = BreadboardUI.Types.STATUS.STOPPED;
            break;
          }

          case "resume": {
            this.status = BreadboardUI.Types.STATUS.RUNNING;
            break;
          }

          case "pause": {
            this.status = BreadboardUI.Types.STATUS.RUNNING;
            break;
          }

          case "secret": {
            const runEvt = evt.runEvt as RunSecretEvent;
            const { keys } = runEvt.data;
            const result: InputValues = {};
            const allKeysAreKnown = keys.every((key) => {
              const savedSecret =
                this.#settings
                  ?.getSection(BreadboardUI.Types.SETTINGS_TYPE.SECRETS)
                  .items.get(key) ?? null;
              if (savedSecret) {
                result[key] = savedSecret.value;
                return true;
              }
              return false;
            });
            if (allKeysAreKnown) {
              evt.harnessRunner?.run(result);
            } else {
              this.#secretsHelper = new SecretsHelper(this.#settings!, keys);
            }
          }
        }
      }
    );

    // Load the Recent Boards.
    this.#load = this.#recentBoardStore
      .restore()
      .then((boards) => {
        this.#recentBoards = boards;

        // Then Kits, Providers and Settings.
        return Promise.all([
          loadKits([
            GeminiKit,
            // TODO(aomarks) This is presumably not the right way to do this. How do
            // I get something into this.#providers?
            BuildExampleKit,
            PythonWasmKit,
            GoogleDriveKit,
          ]),
          ...this.#providers.map((provider) => provider.restore()),
          this.#settings?.restore(),
        ]);
      })
      .then(([kits]) => {
        // Process all.
        this.kits = kits;
        this.#providers.map((provider) => {
          if (provider.extendedCapabilities().watch) {
            provider.watch((change) => {
              const currentUrl = new URL(window.location.href);
              const boardFromUrl = currentUrl.searchParams.get("board");
              if (boardFromUrl?.endsWith(change.filename)) {
                this.#failedGraphLoad = false;
                this.#runtime.board.loadFromURL(boardFromUrl, this.kits);
              }
            });
          }
        });

        // Start the board or show the welcome panel.
        if (boardFromUrl) {
          this.#failedGraphLoad = false;
          this.#runtime.board.loadFromURL(boardFromUrl, this.kits);
          return;
        } else {
          this.showWelcomePanel = true;
        }
      });
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("bbrundownload", this.#downloadRunBound);
    window.addEventListener("bbrunselect", this.#selectRunBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("bbrundownload", this.#downloadRunBound);
    window.removeEventListener("bbrunselect", this.#selectRunBound);
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
      target instanceof HTMLCanvasElement
    );
  }

  #onKeyDown(evt: KeyboardEvent) {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    if (evt.key === "v" && isCtrlCommand && !this.tab?.graph) {
      // Only allow a paste when there's nothing else in the composed path that
      // would accept the paste first.
      if (
        evt
          .composedPath()
          .some((target) => this.#receivesInputPreference(target))
      ) {
        return;
      }

      evt.preventDefault();

      navigator.clipboard.readText().then((content) => {
        try {
          const descriptor = JSON.parse(content) as GraphDescriptor;
          if (!("edges" in descriptor && "nodes" in descriptor)) {
            return;
          }

          this.#failedGraphLoad = false;
          this.#runtime.board.loadFromDescriptor(descriptor, this.kits);
        } catch (err) {
          this.toast(
            "Unable to paste board",
            BreadboardUI.Events.ToastType.ERROR
          );
        }
      });
      return;
    }

    if (evt.key === "s" && isCtrlCommand) {
      evt.preventDefault();

      if (evt.shiftKey) {
        this.showSaveAsDialog = true;
        return;
      }

      this.#attemptBoardSave();
      return;
    }

    if (evt.key === "h" && !isCtrlCommand && !evt.shiftKey) {
      const isFocusedOnRenderer = evt
        .composedPath()
        .find(
          (target) => target instanceof BreadboardUI.Elements.GraphRenderer
        );
      if (!isFocusedOnRenderer) {
        return;
      }

      this.showHistory = !this.showHistory;
    }

    if (evt.key === "z" && isCtrlCommand) {
      const isFocusedOnRenderer = evt
        .composedPath()
        .find(
          (target) => target instanceof BreadboardUI.Elements.GraphRenderer
        );

      if (!isFocusedOnRenderer) {
        return;
      }

      if (!this.tab) {
        this.toast(
          "Unable to edit; no active graph",
          BreadboardUI.Events.ToastType.ERROR
        );
        return;
      }

      if (evt.shiftKey) {
        this.#runtime.edit.redo(this.tab, this.kits);
        return;
      }

      this.#runtime.edit.undo(this.tab, this.kits);
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

  async #selectRun(evt: Event) {
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

    const e = evt as BreadboardUI.Events.RunSelectEvent;
    const event = currentRun.getEventById(e.runId);

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
      this.#failedGraphLoad = false;
      this.#runtime.board.loadFromDescriptor(
        runGraph,
        this.kits,
        topGraphObserver
      );
    }
  }

  async #attemptBoardSave() {
    if (this.#isSaving) {
      return;
    }

    if (!this.tab) {
      return;
    }

    if (!this.#runtime.board.canSave(this.tab.id)) {
      this.showSaveAsDialog = true;
      return;
    }

    const id = this.toast(
      "Saving board...",
      BreadboardUI.Events.ToastType.PENDING,
      true
    );
    this.#isSaving = true;
    const { result } = await this.#runtime.board.save(this.tab.id);
    this.#isSaving = false;
    if (!result) {
      return;
    }

    this.#setBoardPendingSaveState(false);
    this.toast(
      "Board saved",
      BreadboardUI.Events.ToastType.INFORMATION,
      false,
      id
    );
  }

  async #attemptBoardSaveAs(
    providerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor
  ) {
    if (this.#isSaving) {
      return;
    }

    const id = this.toast(
      "Saving board...",
      BreadboardUI.Events.ToastType.PENDING,
      true
    );

    this.#isSaving = true;
    const { result, error, url } = await this.#runtime.board.saveAs(
      providerName,
      location,
      fileName,
      graph
    );
    this.#isSaving = false;

    if (!result || !url) {
      this.toast(
        error || "Unable to create board",
        BreadboardUI.Events.ToastType.ERROR
      );
      return;
    }

    this.#setBoardPendingSaveState(false);
    this.#persistProviderAndLocation(providerName, location);

    // Trigger a re-render.
    this.providerOps++;
    this.#changeBoard(url.href, false);
    this.toast(
      "Board saved",
      BreadboardUI.Events.ToastType.INFORMATION,
      false,
      id
    );
  }

  async #attemptBoardDelete(
    providerName: string,
    url: string,
    isActive: boolean
  ) {
    if (
      !confirm(
        "Are you sure you want to delete this board? This cannot be undone"
      )
    ) {
      return;
    }

    const id = this.toast(
      "Deleting board...",
      BreadboardUI.Events.ToastType.PENDING,
      true
    );

    const { result, error } = await this.#runtime.board.delete(
      providerName,
      url
    );
    if (result) {
      this.toast(
        "Board deleted",
        BreadboardUI.Events.ToastType.INFORMATION,
        false,
        id
      );
    } else {
      this.toast(
        error || "Unexpected error",
        BreadboardUI.Events.ToastType.ERROR,
        false,
        id
      );
    }

    if (this.tab && isActive) {
      this.#runtime.board.closeTab(this.tab.id);
      this.#removeRecentUrl(url);
    }

    // Trigger a re-render.
    this.providerOps++;
  }

  #attemptBoardCreate(graph: GraphDescriptor) {
    this.#saveAsState = {
      title: "Create new board",
      graph,
      isNewBoard: true,
    };

    this.showSaveAsDialog = true;
  }

  get status() {
    return this.#status;
  }

  set status(status: BreadboardUI.Types.STATUS) {
    this.#status = status;
    this.requestUpdate();
  }

  #setPageTitle(title: string | null) {
    const suffix = "Breadboard - Visual Editor";
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
        title: this.tab?.graph.title ?? "Untitled Board",
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

  // TODO: Allow this to run boards directly.
  async #runBoard(config: RunConfig) {
    if (!this.tab) {
      console.error("Unable to run board, no active tab");
      return;
    }

    this.#runtime.run.runBoard(this.tab.id, config);
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

  toast(
    message: string,
    type: BreadboardUI.Events.ToastType,
    persistent = false,
    id = globalThis.crypto.randomUUID()
  ) {
    this.toasts.set(id, { message, type, persistent });
    this.requestUpdate();

    return id;
  }

  #getProviderByName(name: string) {
    return this.#providers.find((provider) => provider.name === name) || null;
  }

  #getProviderForURL(url: URL) {
    return this.#providers.find((provider) => provider.canProvide(url)) || null;
  }

  async #getProxyURL(urlString: string): Promise<string | null> {
    const url = new URL(urlString, window.location.href);
    for (const provider of this.#providers) {
      const proxyURL = await provider.canProxy?.(url);
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
      const provider = this.#getProviderForURL(url);
      if (!provider) {
        return;
      }

      const capabilities = provider.canProvide(url);
      if (!capabilities || !capabilities.save) {
        return;
      }
    } catch (err) {
      // Likely an error with the URL.
      return;
    }

    if (
      !confirm("The current board isn't saved - would you like to save first?")
    ) {
      return;
    }

    return this.#attemptBoardSave();
  }

  #handleBoardInfoUpdate(evt: BreadboardUI.Events.BoardInfoUpdateEvent) {
    if (!this.tab) {
      this.toast(
        "Unable to edit; no active graph",
        BreadboardUI.Events.ToastType.ERROR
      );
      return;
    }

    if (evt.subGraphId) {
      this.#runtime.edit.updateSubBoardInfo(
        this.tab,
        this.kits,
        evt.subGraphId,
        evt.title,
        evt.version,
        evt.description,
        evt.status,
        evt.isTool
      );
    } else {
      this.#runtime.edit.updateBoardInfo(
        this.tab,
        evt.title,
        evt.version,
        evt.description,
        evt.status,
        evt.isTool
      );
    }
  }

  async #changeBoard(url: string, _newTab: boolean) {
    await this.#confirmSaveWithUserFirstIfNeeded();

    if (this.status !== BreadboardUI.Types.STATUS.STOPPED) {
      if (
        !confirm("A board is currently running. Do you want to load this file?")
      ) {
        return;
      }
    }

    try {
      this.#failedGraphLoad = false;
      this.#runtime.board.loadFromURL(url, this.kits, this.tab?.graph.url);
    } catch (err) {
      this.toast(
        `Unable to load file: ${url}`,
        BreadboardUI.Events.ToastType.ERROR
      );
    }
  }

  #persistProviderAndLocation(providerName: string, location: string) {
    this.selectedProvider = providerName;
    this.selectedLocation = location;

    globalThis.sessionStorage.setItem(
      `${STORAGE_PREFIX}-provider`,
      `${providerName}::${location}`
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

    const fileDropped = evt.dataTransfer.files[0];
    fileDropped.text().then((data) => {
      try {
        const runData = JSON.parse(data) as SerializedRun | GraphDescriptor;
        if (isSerializedRun(runData)) {
          const runObserver = createRunObserver({
            logLevel: "debug",
            dataStore: this.dataStore,
          });

          evt.preventDefault();

          runObserver.load(runData).then(async (result) => {
            if (result.success) {
              this.run = result.run;
              const topGraphObserver =
                await BreadboardUI.Utils.TopGraphObserver.fromRun(this.run);
              const descriptor = topGraphObserver?.current()?.graph ?? null;

              if (descriptor) {
                this.#runtime.board.loadFromDescriptor(
                  descriptor,
                  this.kits,
                  topGraphObserver
                );
              } else {
                this.toast(
                  "Unable to load run data",
                  BreadboardUI.Events.ToastType.ERROR
                );
              }
            } else {
              this.toast(
                "Unable to load run data",
                BreadboardUI.Events.ToastType.ERROR
              );
            }
          });
        } else {
          this.#runtime.board.loadFromDescriptor(runData, this.kits);
        }
      } catch (err) {
        console.warn(err);
        this.toast("Unable to load file", BreadboardUI.Events.ToastType.ERROR);
      }
    });
  }

  #attemptBoardStart(evt: BreadboardUI.Events.StartEvent) {
    if (this.status !== BreadboardUI.Types.STATUS.STOPPED) {
      if (
        !confirm("A board is currently running. Do you want to load this file?")
      ) {
        return;
      }
    }

    this.#failedGraphLoad = false;
    if (evt.url) {
      this.#runtime.board.loadFromURL(evt.url, this.kits);
    } else if (evt.descriptor) {
      this.#runtime.board.loadFromDescriptor(evt.descriptor, this.kits);
    }
  }

  render() {
    const toasts = html`${map(
      this.toasts,
      ([, { message, type, persistent }], idx) => {
        const offset = this.toasts.size - idx - 1;
        return html`<bb-toast
          .offset=${offset}
          .message=${message}
          .type=${type}
          .timeout=${persistent ? 0 : nothing}
        ></bb-toast>`;
      }
    )}`;

    let tmpl: HTMLTemplateResult | symbol = nothing;

    const observers = this.#runtime?.run.getObservers(this.tab?.id ?? null);
    const topGraphResult = observers?.topGraphObserver?.current() ?? null;

    let saveButton: HTMLTemplateResult | symbol = nothing;
    if (this.tab && this.tab.graph && this.tab.graph.url) {
      try {
        const url = new URL(this.tab.graph.url);
        const provider = this.#getProviderForURL(url);
        const capabilities = provider?.canProvide(url);
        if (provider && capabilities && capabilities.save) {
          saveButton = html`<button
            id="save-board"
            title="Save Board BGL"
            @click=${this.#attemptBoardSave}
          >
            Save
          </button>`;
        } else {
          saveButton = html`<button
            id="save-board"
            title="Save Board BGL"
            @click=${() => {
              this.showSaveAsDialog = true;
            }}
          >
            Save As...
          </button>`;
        }
      } catch (err) {
        // If there are any problems with the URL, etc, don't offer the save button.
      }
    }

    const showingOverlay =
      this.boardEditOverlayInfo !== null ||
      this.showSettingsOverlay ||
      this.showFirstRun ||
      this.showProviderAddOverlay ||
      this.showSaveAsDialog ||
      this.showOverflowMenu ||
      this.showNodeConfigurator;

    const nav = this.#load.then(() => {
      return html`<bb-nav
        .visible=${this.showNav}
        .url=${this.tab?.graph.url ?? null}
        .selectedProvider=${this.selectedProvider}
        .selectedLocation=${this.selectedLocation}
        .providers=${this.#providers}
        .providerOps=${this.providerOps}
        ?inert=${showingOverlay}
        @pointerdown=${(evt: Event) => evt.stopPropagation()}
        @bbreset=${() => {
          if (!this.tab) {
            return;
          }

          this.#runtime.board.closeTab(this.tab.id);
        }}
        @bbgraphprovideradd=${() => {
          this.showProviderAddOverlay = true;
        }}
        @bbgraphproviderblankboard=${() => {
          this.#attemptBoardCreate(blankLLMContent());
        }}
        @bbgraphproviderdeleterequest=${async (
          evt: BreadboardUI.Events.GraphProviderDeleteRequestEvent
        ) => {
          this.#attemptBoardDelete(evt.providerName, evt.url, evt.isActive);
        }}
        @bbstart=${(evt: BreadboardUI.Events.StartEvent) => {
          this.#attemptBoardStart(evt);
        }}
        @bbgraphproviderrefresh=${async (
          evt: BreadboardUI.Events.GraphProviderRefreshEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            return;
          }

          const refreshed = await provider.refresh(evt.location);
          if (refreshed) {
            this.toast(
              "Source files refreshed",
              BreadboardUI.Events.ToastType.INFORMATION
            );
          } else {
            this.toast(
              "Unable to refresh source files",
              BreadboardUI.Events.ToastType.WARNING
            );
          }

          // Trigger a re-render.
          this.providerOps++;
        }}
        @bbgraphproviderdisconnect=${async (
          evt: BreadboardUI.Events.GraphProviderDisconnectEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            return;
          }

          await provider.disconnect(evt.location);

          // Trigger a re-render.
          this.providerOps++;
        }}
        @bbgraphproviderrenewaccesssrequest=${async (
          evt: BreadboardUI.Events.GraphProviderRenewAccessRequestEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!(provider instanceof FileSystemGraphProvider)) {
            return;
          }

          await provider.renewAccessRequest(evt.location);

          // Trigger a re-render.
          this.providerOps++;
        }}
        @bbgraphproviderloadrequest=${async (
          evt: BreadboardUI.Events.GraphProviderLoadRequestEvent
        ) => {
          this.#changeBoard(evt.url, evt.newTab);
        }}
        @bbgraphproviderselectionchange=${(
          evt: BreadboardUI.Events.GraphProviderSelectionChangeEvent
        ) => {
          this.#persistProviderAndLocation(
            evt.selectedProvider,
            evt.selectedLocation
          );
        }}
      ></bb-nav> `;
    });

    tmpl = html`<div id="header-bar" ?inert=${showingOverlay}>
        <button
          id="show-nav"
          @click=${() => {
            this.showNav = !this.showNav;
            window.addEventListener(
              "pointerdown",
              () => {
                this.showNav = false;
              },
              { once: true }
            );
          }}
        ></button>
        <div id="tab-container">
          ${map(this.#runtime?.board.tabs ?? [], ([id, tab]) => {
            let subGraphTitle: string | undefined | null = null;
            if (tab.graph && tab.graph.graphs && tab.subGraphId) {
              subGraphTitle =
                tab.graph.graphs[tab.subGraphId].title || "Untitled Subgraph";
            }

            return html`<h1>
              <span
                ><button
                  class=${classMap({
                    "back-to-main-board": true,
                    active: this.tab?.id === tab.id,
                  })}
                  @click=${() => {
                    if (this.tab?.id === tab.id && tab.subGraphId !== null) {
                      tab.subGraphId = null;
                      return;
                    }

                    this.#runtime.board.changeTab(tab.id);
                  }}
                >
                  ${tab.graph.title}
                </button></span
              >${subGraphTitle
                ? html`<span class="subgraph-name">${subGraphTitle}</span>`
                : nothing}
              <button
                @click=${() => {
                  this.#runtime.board.closeTab(id);
                }}
                ?disabled=${tab.graph === null}
                id="close-board"
                title="Close Board"
              >
                Close
              </button>
            </h1>`;
          })}
        </div>
        <button
          id="undo"
          title="Undo last action"
          ?disabled=${this.tab?.graph === null || !this.#runtime.edit.canUndo(this.tab, this.kits)}
          @click=${() => {
            this.#runtime.edit.undo(this.tab, this.kits);
          }}
        >
          Preview
        </button>
        <button
          id="redo"
          title="Redo last action"
          ?disabled=${this.tab?.graph === null || !this.#runtime.edit.canRedo(this.tab, this.kits)}
          @click=${() => {
            this.#runtime.edit.redo(this.tab, this.kits);
          }}
        >
          Preview
        </button>
        ${saveButton}
        <button
          class=${classMap({ active: this.showOverflowMenu })}
          id="toggle-overflow-menu"
          title="Toggle Overflow Menu"
          @click=${() => {
            this.showOverflowMenu = !this.showOverflowMenu;
          }}
        >
          Toggle Overflow Menu
        </button>
      </div>
      <div id="content" ?inert=${showingOverlay}>
        <bb-ui-controller
              ${ref(this.#uiRef)}
              ?inert=${showingOverlay}
              .graph=${this.tab?.graph ?? null}
              .subGraphId=${this.tab?.subGraphId ?? null}
              .run=${this.run}
              .topGraphResult=${topGraphResult}
              .kits=${this.kits}
              .loader=${this.#runtime.board.loader}
              .status=${this.status}
              .boardId=${this.#boardId}
              .failedToLoad=${this.#failedGraphLoad}
              .settings=${this.#settings}
              .providers=${this.#providers}
              .providerOps=${this.providerOps}
              .history=${history}
              .version=${this.#version}
              .showWelcomePanel=${this.showWelcomePanel}
              .recentBoards=${this.#recentBoards}
              @bbstart=${(evt: BreadboardUI.Events.StartEvent) => {
                this.#attemptBoardStart(evt);
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
              @bbboardinfoupdate=${(
                evt: BreadboardUI.Events.BoardInfoUpdateEvent
              ) => {
                this.#handleBoardInfoUpdate(evt);
                this.requestUpdate();
              }}
              @bbgraphproviderblankboard=${() => {
                this.#attemptBoardCreate(blankLLMContent());
              }}
              @bbsubgraphcreate=${async (
                evt: BreadboardUI.Events.SubGraphCreateEvent
              ) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                const result = this.#runtime.edit.createSubGraph(
                  this.tab,
                  this.kits,
                  evt.subGraphTitle
                );
                if (!result) {
                  this.toast(
                    "Unable to create sub board",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.tab.subGraphId = result;
              }}
              @bbsubgraphdelete=${async (
                evt: BreadboardUI.Events.SubGraphDeleteEvent
              ) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.deleteSubGraph(
                  this.tab,
                  this.kits,
                  evt.subGraphId
                );
              }}
              @bbsubgraphchosen=${(
                evt: BreadboardUI.Events.SubGraphChosenEvent
              ) => {
                if (!this.tab) {
                  return;
                }

                this.tab.subGraphId =
                  evt.subGraphId !== BreadboardUI.Constants.MAIN_BOARD_ID
                    ? evt.subGraphId
                    : null;
                this.requestUpdate();
              }}
              @bbrunboard=${async () => {
                if (!this.tab?.graph?.url) {
                  return;
                }

                const graph = this.tab?.graph;

                this.#abortController = new AbortController();

                this.#runBoard(
                  addNodeProxyServerConfig(
                    this.#proxy,
                    {
                      url: this.tab?.graph.url,
                      runner: graph,
                      diagnostics: true,
                      kits: this.kits,
                      loader: this.#runtime.board.loader,
                      store: this.dataStore,
                      signal: this.#abortController?.signal,
                      inputs: BreadboardUI.Data.inputsFromSettings(
                        this.#settings
                      ),
                      interactiveSecrets: true,
                    },
                    this.#settings,
                    this.proxyFromUrl,
                    await this.#getProxyURL(this.tab?.graph.url)
                  )
                );
              }}
              @bbstopboard=${() => {
                if (!this.#abortController) {
                  return;
                }

                this.#abortController.abort("Stopped board");
                this.#runner?.run();
                this.requestUpdate();
              }}
              @bbedgechange=${(evt: BreadboardUI.Events.EdgeChangeEvent) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.changeEdge(
                  this.tab,
                  this.kits,
                  evt.changeType,
                  evt.from,
                  evt.to,
                  evt.subGraphId
                );
              }}
              @bbnodemetadataupdate=${(
                evt: BreadboardUI.Events.NodeMetadataUpdateEvent
              ) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.updateNodeMetadata(
                  this.tab,
                  this.kits,
                  evt.id,
                  evt.metadata,
                  evt.subGraphId
                );
              }}
              @bbmultiedit=${(evt: BreadboardUI.Events.MultiEditEvent) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.multiEdit(
                  this.tab,
                  this.kits,
                  evt.edits,
                  evt.description,
                  evt.subGraphId
                );
              }}
              @bbnodecreate=${(evt: BreadboardUI.Events.NodeCreateEvent) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.createNode(
                  this.tab,
                  this.kits,
                  evt.id,
                  evt.nodeType,
                  evt.configuration,
                  evt.metadata,
                  evt.subGraphId
                );
              }}
              @bbnodeconfigurationupdaterequest=${(
                evt: BreadboardUI.Events.NodeConfigurationUpdateRequestEvent
              ) => {
                this.showNodeConfigurator = evt.port !== null;
                this.#nodeConfiguratorData = { ...evt };
              }}
              @bbcommentupdate=${(
                evt: BreadboardUI.Events.CommentUpdateEvent
              ) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.changeComment(
                  this.tab,
                  this.kits,
                  evt.id,
                  evt.text,
                  evt.subGraphId
                );
              }}
              @bbnodeupdate=${(evt: BreadboardUI.Events.NodeUpdateEvent) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                this.#runtime.edit.changeNodeConfiguration(
                  this.tab,
                  this.kits,
                  evt.id,
                  evt.configuration,
                  evt.subGraphId
                );
              }}
              @bbnodedelete=${(evt: BreadboardUI.Events.NodeDeleteEvent) => {
                if (!this.tab) {
                  this.toast(
                    "Unable to edit; no active graph",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }
                this.#runtime.edit.deleteNode(
                  this.tab,
                  this.kits,
                  evt.id,
                  evt.subGraphId
                );
              }}
              @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
                if (!this.#uiRef.value) {
                  return;
                }

                this.toast(toastEvent.message, toastEvent.toastType);
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
                  if (!this.#secretsHelper) {
                    throw new Error("No secrets helper to handle secret input");
                  }
                  this.#secretsHelper.receiveSecrets(event);
                  if (
                    this.#secretsHelper.hasAllSecrets() &&
                    !this.#runner?.running()
                  ) {
                    const secrets = this.#secretsHelper.getSecrets();
                    this.#secretsHelper = null;
                    this.#runner?.run(secrets);
                  }
                } else {
                  const data = event.data as InputValues;
                  if (runner.running()) {
                    throw new Error(
                      "The runner is already running, cannot send input"
                    );
                  }
                  runner.run(data);
                }
                this.requestUpdate();
              }}
            ></bb-ui-controller>
          </div>
        ${until(nav)}
      </div>`;

    if (this.embed) {
      tmpl = html`<iframe
        src="/preview.html?board=${this.url}&embed=true"
      ></iframe>`;
    }

    let boardOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.boardEditOverlayInfo) {
      boardOverlay = html`<bb-board-edit-overlay
        .boardTitle=${this.boardEditOverlayInfo.title}
        .boardVersion=${this.boardEditOverlayInfo.version}
        .boardDescription=${this.boardEditOverlayInfo.description}
        .boardPublished=${this.boardEditOverlayInfo.published}
        .boardIsTool=${this.boardEditOverlayInfo.isTool}
        .subGraphId=${this.boardEditOverlayInfo.subGraphId}
        @bboverlaydismissed=${() => {
          this.boardEditOverlayInfo = null;
        }}
        @bbboardinfoupdate=${(
          evt: BreadboardUI.Events.BoardInfoUpdateEvent
        ) => {
          this.#handleBoardInfoUpdate(evt);
          this.boardEditOverlayInfo = null;
          this.requestUpdate();
        }}
      ></bb-board-edit-overlay>`;
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
              "Saved settings",
              BreadboardUI.Events.ToastType.INFORMATION
            );
          } catch (err) {
            console.warn(err);
            this.toast(
              "Unable to save settings",
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

    let firstRunOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showFirstRun) {
      const currentUrl = new URL(window.location.href);
      const boardServerUrl = currentUrl.searchParams.get("boardserver");

      firstRunOverlay = html`<bb-first-run-overlay
        class="settings"
        .settings=${this.#settings?.values || null}
        .boardServerUrl=${boardServerUrl}
        @bbgraphproviderconnectrequest=${async (
          evt: BreadboardUI.Events.GraphProviderConnectRequestEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider || !provider.extendedCapabilities().connect) {
            return;
          }

          try {
            await provider.connect(evt.location, evt.apiKey);
          } catch (err) {
            return;
          }
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
              "Welcome to Breadboard!",
              BreadboardUI.Events.ToastType.INFORMATION
            );
          } catch (err) {
            console.warn(err);
            this.toast(
              "Unable to save settings",
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

    let providerAddOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showProviderAddOverlay) {
      providerAddOverlay = html`<bb-provider-overlay
        .providers=${this.#providers}
        .providerOps=${this.providerOps}
        @bboverlaydismissed=${() => {
          this.showProviderAddOverlay = false;
        }}
        @bbgraphproviderconnectrequest=${async (
          evt: BreadboardUI.Events.GraphProviderConnectRequestEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider || !provider.extendedCapabilities().connect) {
            return;
          }

          let success = false;
          try {
            success = await provider.connect(evt.location, evt.apiKey);
          } catch (err) {
            this.toast(
              "Unable to connect to provider",
              BreadboardUI.Events.ToastType.ERROR
            );
          }

          if (!success) {
            return;
          }

          // Trigger a re-render.
          this.showProviderAddOverlay = false;
          this.providerOps++;
        }}
      ></bb-provider-overlay>`;
    }

    let historyOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showHistory) {
      const history = this.#runtime.edit.getHistory(this.tab, this.kits);
      if (history) {
        historyOverlay = html`<bb-graph-history
          .entries=${history.entries()}
          .canRedo=${history.canRedo()}
          .canUndo=${history.canUndo()}
          .count=${history.entries().length}
          .idx=${history.index()}
          @bbundo=${() => {
            if (!history.canUndo()) {
              return;
            }

            history.undo();
            this.requestUpdate();
          }}
          @bbredo=${() => {
            if (!history.canRedo()) {
              return;
            }

            history.redo();
            this.requestUpdate();
          }}
        ></bb-graph-history>`;
      }
    }

    let saveAsDialogOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showSaveAsDialog) {
      saveAsDialogOverlay = html`<bb-save-as-overlay
        .panelTitle=${this.#saveAsState?.title ?? "Save As..."}
        .providers=${this.#providers}
        .providerOps=${this.providerOps}
        .selectedProvider=${this.selectedProvider}
        .selectedLocation=${this.selectedLocation}
        .graph=${structuredClone(this.#saveAsState?.graph ?? this.tab?.graph)}
        .isNewBoard=${this.#saveAsState?.isNewBoard ?? false}
        @bboverlaydismissed=${() => {
          this.showSaveAsDialog = false;
        }}
        @bbgraphprovidersaveboard=${async (
          evt: BreadboardUI.Events.GraphProviderSaveBoardEvent
        ) => {
          this.showSaveAsDialog = false;

          const { providerName, location, fileName, graph } = evt;
          await this.#attemptBoardSaveAs(
            providerName,
            location,
            fileName,
            graph
          );
        }}
      ></bb-save-as-overlay>`;

      this.#saveAsState = null;
    }

    let nodeConfiguratorOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showNodeConfigurator) {
      nodeConfiguratorOverlay = html`<bb-node-configuration-overlay
        .configuration=${this.#nodeConfiguratorData}
        .graph=${this.tab?.graph}
        .providers=${this.#providers}
        .providerOps=${this.providerOps}
        .showTypes=${false}
        @bboverlaydismissed=${() => {
          this.showNodeConfigurator = false;
        }}
        @bbnodepartialupdate=${async (
          evt: BreadboardUI.Events.NodePartialUpdateEvent
        ) => {
          if (!this.tab) {
            this.toast(
              "Unable to edit; no active graph",
              BreadboardUI.Events.ToastType.ERROR
            );
            return;
          }

          this.#runtime.edit.changeNodeConfigurationPart(
            this.tab,
            this.kits,
            evt.id,
            evt.configuration,
            evt.subGraphId
          );
        }}
      ></bb-node-configuration-overlay>`;
    }

    let overflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showOverflowMenu) {
      const actions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
      }> = [
        {
          title: "Download Board",
          name: "download",
          icon: "download",
        },
      ];

      if (this.tab?.graph && this.tab?.graph.url) {
        try {
          const url = new URL(this.tab?.graph.url);
          const provider = this.#getProviderForURL(url);
          const capabilities = provider?.canProvide(url);
          if (provider && capabilities) {
            if (capabilities.save) {
              actions.push({
                title: "Save As...",
                name: "save-as",
                icon: "save-as",
              });
            }

            if (capabilities.delete) {
              actions.push({
                title: "Delete Board",
                name: "delete",
                icon: "delete",
              });
            }

            const extendedCapabilities = provider?.extendedCapabilities();
            actions.push({
              title: "Preview Board",
              name: "preview",
              icon: "preview",
              disabled: !extendedCapabilities.preview,
            });
          }
        } catch (err) {
          // If there are any problems with the URL, etc, don't offer the save button.
        }
      }

      actions.push({
        title: "Copy Board URL",
        name: "copy-to-clipboard",
        icon: "copy",
      });

      actions.push({
        title: "Settings",
        name: "settings",
        icon: "settings",
      });

      overflowMenu = html`<bb-overflow-menu
        .actions=${actions}
        .disabled=${this.tab?.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showOverflowMenu = false;
        }}
        @bboverflowmenuaction=${async (
          evt: BreadboardUI.Events.OverflowMenuActionEvent
        ) => {
          switch (evt.action) {
            case "copy-to-clipboard": {
              if (!this.tab?.graph || !this.tab?.graph.url) {
                this.toast(
                  "Unable to copy board URL",
                  BreadboardUI.Events.ToastType.ERROR
                );
                break;
              }

              await navigator.clipboard.writeText(this.tab?.graph.url);
              this.toast(
                "Board URL copied",
                BreadboardUI.Events.ToastType.INFORMATION
              );
              break;
            }
            case "download": {
              if (!this.tab?.graph) {
                break;
              }

              const board = structuredClone(this.tab?.graph);
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

              let fileName = `${board.title ?? "Untitled Board"}.json`;
              if (this.url) {
                try {
                  const boardUrl = new URL(this.url, window.location.href);
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

            case "save": {
              await this.#attemptBoardSave();
              break;
            }

            case "delete": {
              if (!this.tab?.graph || !this.tab?.graph.url) {
                return;
              }

              const provider = this.#getProviderForURL(
                new URL(this.tab?.graph.url)
              );
              if (!provider) {
                return;
              }

              this.#attemptBoardDelete(
                provider.name,
                this.tab?.graph.url,
                true
              );
              break;
            }

            case "save-as": {
              this.showSaveAsDialog = true;
              break;
            }

            case "settings": {
              this.showSettingsOverlay = true;
              break;
            }

            case "preview": {
              if (!this.tab?.graph || !this.tab?.graph.url) {
                return;
              }

              const provider = this.#getProviderForURL(
                new URL(this.tab?.graph.url)
              );
              if (!provider) {
                return;
              }

              try {
                this.previewOverlayURL = await provider.preview(
                  new URL(this.tab?.graph.url)
                );
              } catch (err) {
                this.toast(
                  "Unable to create preview",
                  BreadboardUI.Events.ToastType.ERROR
                );
              }
              break;
            }

            default: {
              this.toast(
                "Unknown action",
                BreadboardUI.Events.ToastType.WARNING
              );
              break;
            }
          }

          this.showOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    let previewOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.previewOverlayURL) {
      previewOverlay = html`<bb-overlay @bboverlaydismissed=${() => {
        this.previewOverlayURL = null;
      }}><iframe src=${this.previewOverlayURL.href}></bb-overlay>`;
    }

    return [
      tmpl,
      boardOverlay,
      settingsOverlay,
      firstRunOverlay,
      historyOverlay,
      providerAddOverlay,
      saveAsDialogOverlay,
      overflowMenu,
      previewOverlay,
      nodeConfiguratorOverlay,
      toasts,
    ];
  }
}
