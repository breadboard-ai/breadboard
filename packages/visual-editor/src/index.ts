/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HarnessProxyConfig,
  RunConfig,
  RunErrorEvent,
  RunSecretEvent,
} from "@google-labs/breadboard/harness";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { map } from "lit/directives/map.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, HTMLTemplateResult, nothing } from "lit";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  blankLLMContent,
  createRunObserver,
  GraphDescriptor,
  GraphProvider,
  InputValues,
  InspectableRun,
  SerializedRun,
} from "@google-labs/breadboard";
import { getDataStore, getRunStore } from "@breadboard-ai/data-store";
import { classMap } from "lit/directives/class-map.js";
import { FileSystemGraphProvider } from "./providers/file-system";
import { SettingsStore } from "./data/settings-store";
import { addNodeProxyServerConfig } from "./data/node-proxy-servers";
import { provide } from "@lit/context";
import { RecentBoardStore } from "./data/recent-boards";
import { SecretsHelper } from "./utils/secrets-helper";
import { SettingsHelperImpl } from "./utils/settings-helper";
import { styles as mainStyles } from "./index.styles.js";
import * as Runtime from "./runtime/runtime.js";
import { TabId } from "./runtime/types";
import { createPastRunObserver } from "./utils/past-run-observer";

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

const BOARD_AUTO_SAVE_TIMEOUT = 1_500;

@customElement("bb-main")
export class Main extends LitElement {
  @state()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = null;

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
  #nodeConfiguratorRef: Ref<BreadboardUI.Elements.NodeConfigurationOverlay> =
    createRef();

  @state()
  showCommentEditor = false;
  #commentValueData: BreadboardUI.Types.CommentConfiguration | null = null;

  @state()
  showEdgeValue = false;
  #edgeValueData: BreadboardUI.Types.EdgeValueConfiguration | null = null;

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

  @provide({ context: BreadboardUI.Contexts.settingsHelperContext })
  settingsHelper!: SettingsHelperImpl;

  @state()
  selectedProvider = "IDBGraphProvider";

  @state()
  selectedLocation = "default";

  @state()
  previewOverlayURL: URL | null = null;

  @property()
  tab: Runtime.Types.Tab | null = null;

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
  #providers: GraphProvider[];
  #settings: SettingsStore | null;
  #secretsHelper: SecretsHelper | null = null;
  /**
   * Optional proxy configuration for the board.
   * This is used to provide additional proxied nodes.
   */
  #proxy: HarnessProxyConfig[];
  #onShowTooltipBound = this.#onShowTooltip.bind(this);
  #onHideTooltipBound = this.#onHideTooltip.bind(this);
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #downloadRunBound = this.#downloadRun.bind(this);
  #confirmUnloadWithUserFirstIfNeededBound =
    this.#confirmUnloadWithUserFirstIfNeeded.bind(this);
  #version = "dev";
  #recentBoardStore = RecentBoardStore.instance();
  #recentBoards: BreadboardUI.Types.RecentBoard[] = [];
  #isSaving = false;
  #dataStore = getDataStore();
  #runStore = getRunStore();

  #runtime!: Runtime.RuntimeInstance;

  static styles = mainStyles;
  proxyFromUrl: string | undefined;

  #initialize: Promise<void>;
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

    this.#version = config.version || "dev";
    this.#providers = [];
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
    //  1. Recent boards.
    //  2. Settings.
    //  3. Runtime.
    //
    // Note: the runtime loads the kits and the initializes the providers.
    this.#initialize = this.#recentBoardStore
      .restore()
      .then((boards) => {
        this.#recentBoards = boards;
        return this.#settings?.restore();
      })
      .then(() => {
        return Runtime.create({
          providers: config.providers ?? [],
          runStore: this.#runStore,
          dataStore: this.#dataStore,
          experiments: {
            projectStores:
              this.#settings?.getItem(
                BreadboardUI.Types.SETTINGS_TYPE.GENERAL,
                "Use Experimental Project Store"
              )?.value === true,
          },
        });
      })
      .then((runtime) => {
        this.#runtime = runtime;
        this.#providers = runtime.board.getProviders() || [];

        this.#runtime.edit.addEventListener(
          Runtime.Events.RuntimeBoardEditEvent.eventName,
          () => {
            this.#nodeConfiguratorData = null;
            this.showNodeConfigurator = false;

            this.#commentValueData = null;
            this.showCommentEditor = false;

            this.requestUpdate();

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
              "Saving board",
              false,
              false,
              BOARD_AUTO_SAVE_TIMEOUT
            );
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
              "Unable to load board",
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
            this.tab = this.#runtime.board.currentTab;
            this.showWelcomePanel = this.tab === null;

            if (this.tab) {
              // If there is a TGO in the tab change event, honor it and populate a
              // run with it before switching to the tab proper.
              if (evt.topGraphObserver) {
                this.#runtime.run.create(
                  this.tab.id,
                  evt.topGraphObserver,
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
            } else {
              this.#clearTabParams();
              this.#setPageTitle(null);
            }
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
                const runEvt = evt.runEvt as RunSecretEvent;
                const { keys } = runEvt.data;
                const result: InputValues = {};
                if (this.#secretsHelper) {
                  this.#secretsHelper.setKeys(keys);
                  if (this.#secretsHelper.hasAllSecrets()) {
                    evt.harnessRunner?.run(this.#secretsHelper.getSecrets());
                  }
                } else {
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
                    this.#secretsHelper = new SecretsHelper(this.#settings!);
                    this.#secretsHelper.setKeys(keys);
                  }
                }
              }
            }
          }
        );

        return this.#runtime.board.createTabsFromURL(currentUrl);
      });
  }

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.addEventListener("bbhidetooltip", this.#onHideTooltipBound);
    window.addEventListener("pointerdown", this.#onHideTooltipBound);
    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("bbrundownload", this.#downloadRunBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("bbshowtooltip", this.#onShowTooltipBound);
    window.removeEventListener("bbhidetooltip", this.#onHideTooltipBound);
    window.removeEventListener("pointerdown", this.#onHideTooltipBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("bbrundownload", this.#downloadRunBound);
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
    this.#tooltipRef.value.x = Math.max(tooltipEvent.x, 100);
    this.#tooltipRef.value.y = Math.max(tooltipEvent.y, 100);
    this.#tooltipRef.value.message = tooltipEvent.message;
    this.#tooltipRef.value.visible = true;
  }

  #onHideTooltip() {
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

          this.#runtime.board.createTabFromDescriptor(descriptor);
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

      let saveMessage = "Board saved";
      if (this.#nodeConfiguratorRef.value) {
        this.#nodeConfiguratorRef.value.processData();
        saveMessage = "Board and configuration saved";
      }

      this.#attemptBoardSave(saveMessage);
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

  async #attemptBoardSave(
    message = "Board saved",
    ackUser = true,
    showSaveAsIfNeeded = true,
    timeout = 0
  ) {
    if (!this.tab) {
      return;
    }

    const tabToSave = this.tab;
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
        "Saving board...",
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

  async #runBoard(config: RunConfig) {
    if (!this.tab) {
      console.error("Unable to run board, no active tab");
      return;
    }

    this.#runtime.run.runBoard(this.tab.id, config);
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

  async #changeBoard(url: string, createNewTab = false) {
    try {
      this.#runtime.board.createTabFromURL(
        url,
        this.tab?.graph.url,
        createNewTab
      );
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
            dataStore: this.#dataStore,
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
          this.#runtime.board.createTabFromDescriptor(runData);
        }
      } catch (err) {
        console.warn(err);
        this.toast("Unable to load file", BreadboardUI.Events.ToastType.ERROR);
      }
    });
  }

  #attemptBoardStart(evt: BreadboardUI.Events.StartEvent) {
    if (evt.url) {
      this.#runtime.board.createTabFromURL(evt.url);
    } else if (evt.descriptor) {
      this.#runtime.board.createTabFromDescriptor(evt.descriptor);
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
      this.showNodeConfigurator ||
      this.showEdgeValue ||
      this.showCommentEditor;

    const nav = this.#initialize.then(() => {
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

    const tmpl = this.#initialize
      .then(() => {
        const observers = this.#runtime?.run.getObservers(this.tab?.id ?? null);
        if (observers && observers.runObserver) {
          return observers.runObserver?.runs();
        }

        return [];
      })
      .then((runs: InspectableRun[]) => {
        const observers = this.#runtime?.run.getObservers(this.tab?.id ?? null);
        const topGraphResult = observers?.topGraphObserver?.current() ?? null;

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

        const inputsFromLastRun = runs[1]?.inputs() ?? null;
        return html`<header>
          <div id="header-bar" ?inert=${showingOverlay}>
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

              const canSave = this.#runtime.board.canSave(id) && !tab.readOnly;
              const saveStatus = this.#tabSaveStatus.get(id) ?? "saved";
              const remote = tab.graph.url?.startsWith("http") ?? false;
              const readonly = tab.readOnly;

              let saveTitle = "Saved";
              switch (saveStatus) {
                case BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING: {
                  saveTitle = "Saving";
                  break;
                }

                case BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED: {
                  saveTitle = remote
                    ? "Saved on Board Server"
                    : "Saved on device";

                  if (readonly) {
                    saveTitle += " - read-only";
                  }
                  break;
                }

                case BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR: {
                  saveTitle = "Error saving board";
                  break;
                }
              }

              return html`<h1
                class=${classMap({
                  active: this.tab?.id === tab.id,
                })}
              >
                <span
                  ><button
                    class=${classMap({
                      "back-to-main-board": true,
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
                <div
                  class=${classMap({
                    "save-status": true,
                    "can-save": canSave,
                    remote,
                    [saveStatus]: true,
                    readonly,
                  })}
                  title=${saveTitle}
                ></div>
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
            ?disabled=${this.tab?.graph === null || !this.#runtime.edit.canUndo(this.tab)}
            @click=${() => {
              this.#runtime.edit.undo(this.tab);
            }}
          >
            Preview
          </button>
          <button
            id="redo"
            title="Redo last action"
            ?disabled=${this.tab?.graph === null || !this.#runtime.edit.canRedo(this.tab)}
            @click=${() => {
              this.#runtime.edit.redo(this.tab);
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
      </header>
      <div id="content" ?inert=${showingOverlay}>
        <bb-ui-controller
              ${ref(this.#uiRef)}
              ?inert=${showingOverlay}
              .readOnly=${this.tab?.readOnly ?? true}
              .graph=${this.tab?.graph ?? null}
              .subGraphId=${this.tab?.subGraphId ?? null}
              .run=${runs[0] ?? null}
              .topGraphResult=${topGraphResult}
              .kits=${this.#runtime.kits}
              .loader=${this.#runtime.board.getLoader()}
              .status=${tabStatus}
              .boardId=${this.#boardId}
              .tabLoadStatus=${tabLoadStatus}
              .settings=${this.#settings}
              .providers=${this.#providers}
              .providerOps=${this.providerOps}
              .history=${history}
              .version=${this.#version}
              .showWelcomePanel=${this.showWelcomePanel}
              .recentBoards=${this.#recentBoards}
              .inputsFromLastRun=${inputsFromLastRun}
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
                const result = this.#runtime.edit.createSubGraph(
                  this.tab,
                  evt.subGraphTitle
                );
                if (!result) {
                  this.toast(
                    "Unable to create sub board",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                if (!this.tab) {
                  return;
                }
                this.tab.subGraphId = result;
              }}
              @bbsubgraphdelete=${async (
                evt: BreadboardUI.Events.SubGraphDeleteEvent
              ) => {
                this.#runtime.edit.deleteSubGraph(this.tab, evt.subGraphId);
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

                this.#runBoard(
                  addNodeProxyServerConfig(
                    this.#proxy,
                    {
                      url: this.tab?.graph.url,
                      runner: graph,
                      diagnostics: true,
                      kits: [], // The kits are added by the runtime.
                      loader: this.#runtime.board.getLoader(),
                      store: this.#dataStore,
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
                const tabId = this.tab?.id ?? null;
                const abortController = this.#runtime.run.getAbortSignal(tabId);
                if (!abortController) {
                  this.toast(
                    "Unable to stop run - no abort controller found",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                  return;
                }

                abortController.abort("Stopped board");
                const runner = this.#runtime.run.getRunner(tabId);
                runner?.run();
                this.requestUpdate();
              }}
              @bbedgechange=${(evt: BreadboardUI.Events.EdgeChangeEvent) => {
                this.#runtime.edit.changeEdge(
                  this.tab,
                  evt.changeType,
                  evt.from,
                  evt.to,
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
              @bbmultiedit=${(evt: BreadboardUI.Events.MultiEditEvent) => {
                this.#runtime.edit.multiEdit(
                  this.tab,
                  evt.edits,
                  evt.description,
                  evt.subGraphId
                );
              }}
              @bbnodecreate=${(evt: BreadboardUI.Events.NodeCreateEvent) => {
                this.#runtime.edit.createNode(
                  this.tab,
                  evt.id,
                  evt.nodeType,
                  evt.configuration,
                  evt.metadata,
                  evt.subGraphId
                );
              }}
              @bbnodeconfigurationupdaterequest=${async (
                evt: BreadboardUI.Events.NodeConfigurationUpdateRequestEvent
              ) => {
                const title = this.#runtime.edit.getNodeTitle(this.tab, evt.id);
                const ports = await this.#runtime.edit.getNodePorts(
                  this.tab,
                  evt.id
                );

                if (!ports) {
                  return;
                }

                const metadata = this.#runtime.edit.getNodeMetadata(
                  this.tab,
                  evt.id
                );

                this.showNodeConfigurator = true;
                this.#nodeConfiguratorData = {
                  id: evt.id,
                  x: evt.x,
                  y: evt.y,
                  title,
                  selectedPort: evt.port?.name ?? null,
                  subGraphId: evt.subGraphId,
                  ports,
                  metadata,
                  addHorizontalClickClearance: evt.addHorizontalClickClearance,
                };
              }}
              @bbcommenteditrequest=${(
                evt: BreadboardUI.Events.CommentEditRequestEvent
              ) => {
                this.showCommentEditor = true;
                const value = this.#runtime.edit.getGraphComment(
                  this.tab,
                  evt.id
                );
                this.#commentValueData = {
                  x: evt.x,
                  y: evt.y,
                  value,
                  subGraphId: evt.subGraphId,
                };
              }}
              @bbedgevalueselected=${(
                evt: BreadboardUI.Events.EdgeValueSelectedEvent
              ) => {
                this.showEdgeValue = evt.value !== null;
                this.#edgeValueData = { ...evt };
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
                  if (runner.running()) {
                    throw new Error(
                      "The runner is already running, cannot send input"
                    );
                  }
                  runner.run(data);
                }
                this.requestUpdate();
              }}
              @bbnodetyperetrievalerror=${(
                evt: BreadboardUI.Events.NodeTypeRetrievalErrorEvent
              ) => {
                this.toast(
                  `Error retrieving type information for ${evt.id}; try removing the component from the board`,
                  BreadboardUI.Events.ToastType.ERROR
                );
              }}
            ></bb-ui-controller>
          </div>
        ${until(nav)}
      </div>`;
      });

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
      const history = this.#runtime.edit.getHistory(this.tab);
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
        ${ref(this.#nodeConfiguratorRef)}
        .value=${this.#nodeConfiguratorData}
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
            evt.id,
            evt.configuration,
            evt.subGraphId,
            evt.metadata
          );
        }}
      ></bb-node-configuration-overlay>`;
    }

    let edgeValueOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showEdgeValue) {
      edgeValueOverlay = html`<bb-edge-value-overlay
        .edgeValue=${this.#edgeValueData}
        @bboverlaydismissed=${() => {
          this.showEdgeValue = false;
        }}
      ></bb-edge-value-overlay>`;
    }

    let commentOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showCommentEditor) {
      commentOverlay = html`<bb-comment-overlay
        .commentValue=${this.#commentValueData}
        @bbcommentupdate=${(evt: BreadboardUI.Events.CommentUpdateEvent) => {
          this.#runtime.edit.changeComment(
            this.tab,
            evt.id,
            evt.text,
            evt.subGraphId
          );
        }}
        @bboverlaydismissed=${() => {
          this.showCommentEditor = false;
        }}
      ></bb-comment-overlay>`;
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
        title: "Copy Tab URL",
        name: "copy-tab-to-clipboard",
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

              await navigator.clipboard.writeText(this.tab.graph.url);
              this.toast(
                "Board URL copied",
                BreadboardUI.Events.ToastType.INFORMATION
              );
              break;
            }

            case "copy-tab-to-clipboard": {
              if (!this.tab?.graph || !this.tab?.graph.url) {
                this.toast(
                  "Unable to copy board URL",
                  BreadboardUI.Events.ToastType.ERROR
                );
                break;
              }

              const url = new URL(window.location.href);
              url.search = `?tab0=${this.tab.graph.url}`;

              await navigator.clipboard.writeText(url.href);
              this.toast(
                "Tab URL copied",
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
              if (this.tab.graph.url) {
                try {
                  const boardUrl = new URL(
                    this.tab.graph.url,
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

    const tooltip = html`<bb-tooltip ${ref(this.#tooltipRef)}></bb-tooltip>`;

    return [
      until(tmpl),
      boardOverlay,
      settingsOverlay,
      firstRunOverlay,
      historyOverlay,
      providerAddOverlay,
      saveAsDialogOverlay,
      overflowMenu,
      previewOverlay,
      nodeConfiguratorOverlay,
      edgeValueOverlay,
      commentOverlay,
      tooltip,
      toasts,
    ];
  }
}
