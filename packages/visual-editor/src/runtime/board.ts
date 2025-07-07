/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createLoader,
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  InspectableRunObserver,
  isLLMContentArray,
  isStoredData,
  Kit,
  MutableGraphStore,
} from "@google-labs/breadboard";
import type {
  BoardServer,
  BoardServerExtension,
  BoardServerExtensionNamespace,
  BoardServerSaveEventStatus,
  GraphLoader,
  GraphProvider,
} from "@breadboard-ai/types";
import { RuntimeConfigBoardServers, Tab, TabId, TabType } from "./types";
import {
  RuntimeHostAPIEvent,
  RuntimeBoardLoadErrorEvent,
  RuntimeErrorEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
  RuntimeBoardServerChangeEvent,
  RuntimeWorkspaceItemChangeEvent,
  RuntimeBoardSaveStatusChangeEvent,
  RuntimeSnackbarEvent,
} from "./events";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  connectToBoardServer,
  disconnectFromBoardServer,
  getBoardServers,
} from "@breadboard-ai/board-server-management";
import { TokenVendor } from "@breadboard-ai/connection-client";
import {
  GraphIdentifier,
  GraphTheme,
  ModuleIdentifier,
} from "@breadboard-ai/types";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "@breadboard-ai/theme";
import * as idb from "idb";
import { BOARD_SAVE_STATUS } from "@breadboard-ai/shared-ui/types/types.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { loadImage } from "@breadboard-ai/shared-ui/utils/image";
import { RecentBoardStore } from "../data/recent-boards";

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${string}` | `--${string}`;

const USER_REGEX = /\/@[^/]+\//;

const LOCAL_EDIT_HISTORY_KEY = "revision-history";
const LOCAL_EDIT_HISTORY_VERSION = 1;
interface LocalEditHistoryDBSchema extends idb.DBSchema {
  revisions: {
    key: string;
    value: EditHistoryEntry[];
  };
}

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return 0xff00ff;
  }
  return valueAsNumber;
}

export class Board extends EventTarget {
  #tabs = new Map<TabId, Tab>();
  #currentTabId: TabId | null = null;

  constructor(
    /** @deprecated */
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader,
    /**
     * Extra Kits, supplied by the board server.
     * */
    public readonly boardServerKits: Kit[],
    public readonly boardServers: RuntimeConfigBoardServers,
    public readonly recentBoardStore: RecentBoardStore,
    protected recentBoards: BreadboardUI.Types.RecentBoard[],
    public readonly tokenVendor?: TokenVendor,
    public readonly googleDriveClient?: GoogleDriveClient
  ) {
    super();
    boardServers.servers.forEach((server) => {
      if (server.capabilities.events) {
        // install event listeners
        server.addEventListener("savestatuschange", ({ url, status }) => {
          if (!this.#currentTabId) {
            return;
          }

          const currentTab = this.#tabs.get(this.#currentTabId);
          if (!currentTab || currentTab.graph?.url !== url) {
            return;
          }

          this.#tabSaveStatus.set(this.#currentTabId, toSaveStatus(status));
          this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
        });
      }
    });
  }

  currentURL: URL | null = null;

  getRecentBoards(): readonly BreadboardUI.Types.RecentBoard[] {
    return this.recentBoards;
  }

  async #trackRecentBoard(url?: string) {
    if (!this.currentTab || !url) {
      return;
    }

    url = url.replace(window.location.origin, "");
    const currentIndex = this.recentBoards.findIndex(
      (board) => board.url === url
    );
    if (currentIndex === -1) {
      this.recentBoards.unshift({
        title: this.currentTab.graph.title ?? "Untitled",
        url,
      });
    } else {
      const [item] = this.recentBoards.splice(currentIndex, 1);
      if (this.currentTab.graph.title) {
        item.title = this.currentTab.graph.title;
      }
      this.recentBoards.unshift(item);
    }

    if (this.recentBoards.length > 50) {
      this.recentBoards.length = 50;
    }

    await this.recentBoardStore.store(this.recentBoards);
  }

  async #removeRecentUrl(url: string) {
    url = url.replace(window.location.origin, "");
    const count = this.recentBoards.length;

    this.recentBoards = this.recentBoards.filter((board) => board.url !== url);

    if (count === this.recentBoards.length) {
      return;
    }

    await this.recentBoardStore.store(this.recentBoards);
  }

  #canParse(url: string, base?: string) {
    // TypeScript assumes that if `canParse` does not exist, then URL is
    // `never`. However, in older browsers that's not true. We therefore take a
    // temporary copy of the URL constructor here.
    const UrlCtor = URL;
    if ("canParse" in URL) {
      return URL.canParse(url, base);
    }

    try {
      new UrlCtor(url, base);
      return true;
    } catch {
      return false;
    }
  }

  #makeRelativeToCurrentBoard(
    boardUrl: string | null,
    currentUrl: string | null
  ) {
    // An inability to parse the URL below likely means it's an example board,
    // which doesn't carry a protocol, etc. In such cases we just return the
    // URL as-is.
    if (boardUrl && this.#canParse(boardUrl)) {
      if (currentUrl) {
        try {
          const base = new URL(currentUrl);
          const newUrl = new URL(boardUrl, base);
          return newUrl.href;
        } catch {
          console.warn("Unable to parse URL from current board: ", currentUrl);
        }
      }
    }
    return boardUrl;
  }

  async connect(
    location?: string,
    apiKey?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.tokenVendor) {
      return { success: false, error: "Can't connect without a token vendor" };
    }

    const boardServerInfo = await connectToBoardServer(
      location,
      apiKey,
      this.tokenVendor,
      this.googleDriveClient
    );
    if (!boardServerInfo) {
      this.dispatchEvent(
        new RuntimeErrorEvent(`Unable to connect to Server "${location}"`)
      );

      // We return true here because we don't need the toast from the Visual
      // Editor. Instead we use the above RuntimeErrorEvent to ensure that
      // the user is notified.
      return { success: false };
    } else {
      this.boardServers.servers = [
        ...(await getBoardServers(this.tokenVendor, this.googleDriveClient)),
        ...this.boardServers.builtInBoardServers,
      ];
      this.boardServers.loader = createLoader(this.boardServers.servers);
      this.dispatchEvent(
        new RuntimeBoardServerChangeEvent(
          boardServerInfo.title,
          boardServerInfo.url
        )
      );
      return { success: true };
    }

    return { success: false };
  }

  async disconnect(location: string) {
    const success = await disconnectFromBoardServer(location);
    if (!success) {
      this.dispatchEvent(
        new RuntimeErrorEvent("Unable to disconnect from Board Server")
      );

      // We return true here because we don't need the toast from the Visual
      // Editor. Instead we use the above RuntimeErrorEvent to ensure that
      // the user is notified.
      return { success: false };
    }
    this.boardServers.servers = [
      ...(await getBoardServers(this.tokenVendor, this.googleDriveClient)),
      ...this.boardServers.builtInBoardServers,
    ];
    this.boardServers.loader = createLoader(this.boardServers.servers);
    this.dispatchEvent(new RuntimeBoardServerChangeEvent());
  }

  getBoardServerByName(name: string) {
    return (
      this.boardServers.servers.find((server) => server.name === name) || null
    );
  }

  getBoardServerForURL(url: URL) {
    return (
      this.boardServers.servers.find((server) => server.canProvide(url)) || null
    );
  }

  getBoardServers(): BoardServer[] {
    return this.boardServers.servers;
  }

  /**
   *
   * @deprecated Use getBoardServers() instead.
   */
  getProviders(): GraphProvider[] {
    console.warn("getProviders is deprecated - use getBoardServers instead.");
    return this.providers;
  }

  getLoader(): GraphLoader {
    return this.boardServers.loader;
  }

  getGraphStore(): MutableGraphStore {
    return this.boardServers.graphStore;
  }

  get tabs() {
    return this.#tabs;
  }

  get currentTab(): Tab | null {
    if (!this.#currentTabId) {
      return null;
    }

    return this.#tabs.get(this.#currentTabId) ?? null;
  }

  getTabById(tab: TabId): Tab | null {
    return this.#tabs.get(tab) ?? null;
  }

  getTabURLs(): string[] {
    return [...this.#tabs.values()]
      .filter((tab) => tab.graph.url !== undefined)
      .map((tab) => tab.graph.url as string);
  }

  getBoardURL(url: URL): string | undefined {
    const params = new URLSearchParams(url.search);

    let t = 0;
    const board = params.get("board");
    if (board) {
      params.set(`tab${t++}`, board);
      params.delete("board");
    }

    const tabs = [...params]
      .filter((param) => param[0].startsWith("flow"))
      .sort(([idA], [idB]) => {
        if (idA > idB) return 1;
        if (idA < idB) return -1;
        return 0;
      });

    return tabs[0]?.[1];
  }

  async createTabsFromURL(url: URL, closeAllTabs = false) {
    if (closeAllTabs) {
      this.closeAllTabs();
    }

    const params = new URLSearchParams(url.search);

    let t = 0;
    const board = params.get("board");
    if (board) {
      params.set(`tab${t++}`, board);
      params.delete("board");
    }

    const tab = params.get("tab0");
    if (tab) {
      params.set(`flow`, tab);
      params.delete("tab0");
    }

    const flow = params.get("flow");
    if (flow) {
      await this.createTabFromURL(
        flow,
        url.href,
        true,
        false,
        false,
        null,
        null
      );
    }

    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  async #toDigest(descriptor: GraphDescriptor) {
    const graph = structuredClone(descriptor);
    delete graph.url;

    const str = JSON.stringify(graph, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);

    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }

  async createTabFromRun(
    descriptor: GraphDescriptor,
    topGraphObserver?: BreadboardUI.Utils.TopGraphObserver,
    runObserver?: InspectableRunObserver,
    readOnly = true
  ) {
    const descriptorUrl = await this.#toDigest(descriptor);
    descriptor.url = `run://${descriptorUrl}`;

    for (const [id, tab] of this.#tabs) {
      if (tab.graph.url !== descriptor.url) {
        continue;
      }

      this.#currentTabId = id;
      this.dispatchEvent(new RuntimeTabChangeEvent());
      return;
    }

    const moduleId = descriptor.main || null;

    const id = globalThis.crypto.randomUUID();
    const mainGraphId = this.getGraphStore().addByDescriptor(descriptor);
    if (!mainGraphId.success) {
      throw new Error(`Unable to add graph: ${mainGraphId.error}`);
    }
    this.#tabs.set(id, {
      id,
      boardServerKits: this.boardServerKits,
      name: descriptor.title ?? "Untitled board",
      mainGraphId: mainGraphId.result,
      graph: descriptor,
      graphIsMine: true,
      subGraphId: null,
      boardServer: null,
      moduleId,
      version: 1,
      type: TabType.DESCRIPTOR,
      readOnly,
    });

    this.#currentTabId = id;
    this.dispatchEvent(
      new RuntimeTabChangeEvent(topGraphObserver, runObserver)
    );
  }

  async createTabFromDescriptor(
    descriptor: GraphDescriptor,
    createNewTab = false,
    dispatchTabChangeEvent = true
  ) {
    const descriptorUrl = await this.#toDigest(descriptor);
    descriptor.url = `descriptor://${descriptorUrl}`;

    // Re-use an existing tab if possible.
    if (!createNewTab) {
      for (const [id, tab] of this.#tabs) {
        if (tab.graph.url !== descriptor.url) {
          continue;
        }

        this.#currentTabId = id;
        this.dispatchEvent(new RuntimeTabChangeEvent());
        return;
      }
    }

    const moduleId = descriptor.main || null;

    const id = globalThis.crypto.randomUUID();
    const mainGraphId = this.getGraphStore().addByDescriptor(descriptor);
    if (!mainGraphId.success) {
      throw new Error(`Unable to add graph: ${mainGraphId.error}`);
    }
    this.#tabs.set(id, {
      id,
      boardServerKits: this.boardServerKits,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      graphIsMine: true,
      mainGraphId: mainGraphId.result,
      subGraphId: null,
      boardServer: null,
      moduleId,
      version: 1,
      type: TabType.DESCRIPTOR,
      readOnly: false,
    });

    this.#currentTabId = id;
    if (!dispatchTabChangeEvent) {
      return;
    }

    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  async #createAppPaletteIfNeeded(graph: GraphDescriptor) {
    const themeId = graph.metadata?.visual?.presentation?.theme;
    if (!themeId) {
      return;
    }

    const theme = graph.metadata?.visual?.presentation?.themes?.[themeId];
    if (!theme || !theme.splashScreen || theme.palette) {
      return;
    }

    let splashUrl: URL | undefined = undefined;
    const { handle } = theme.splashScreen.storedData;
    const BLOB_HANDLE_PATTERN = /^[./]*blobs\/(.+)/;
    const blobMatch = handle.match(BLOB_HANDLE_PATTERN);

    if (blobMatch) {
      const blobId = blobMatch[1];
      if (blobId) {
        splashUrl = new URL(`/board/blobs/${blobId}`, window.location.href);
      }
    } else if (
      handle.startsWith("data:") ||
      handle.startsWith("http:") ||
      handle.startsWith("https:")
    ) {
      splashUrl = new URL(handle);
    } else if (handle.startsWith("drive:") && !this.googleDriveClient) {
      return;
    }

    if (!splashUrl) {
      return;
    }

    const imgUrl = await loadImage(this.googleDriveClient!, splashUrl.href);
    if (!imgUrl) return;

    const img = new Image();
    img.src = imgUrl;
    img.crossOrigin = "anonymous";
    const generatedPalette = await generatePaletteFromImage(img);
    if (generatedPalette) {
      theme.palette = generatedPalette;
    }
  }

  /**
   * Here for now, but needs to be removed when all legacy theme information has
   * been handled.
   *
   * @deprecated
   */
  #migrateThemeInformationIfPresent(graph: GraphDescriptor) {
    // Already migrated.
    if (
      graph.metadata?.visual?.presentation?.themes &&
      graph.metadata?.visual?.presentation?.theme
    ) {
      return;
    }

    // No legacy theme info available - fit out the default theme.
    if (!graph.metadata?.visual?.presentation?.themeColors) {
      graph.metadata ??= {};
      graph.metadata.visual ??= {};
      graph.metadata.visual.presentation ??= {};
      graph.metadata.visual.presentation.themes ??= {};

      const graphTheme: GraphTheme = {
        themeColors: {
          primaryColor: "#1a1a1a",
          secondaryColor: "#7a7a7a",
          backgroundColor: "#ffffff",
          textColor: "#1a1a1a",
          primaryTextColor: "#ffffff",
        },
        template: "basic",
        isDefaultTheme: true,
        palette: generatePaletteFromColor("#330072"),
      };

      const themeId = globalThis.crypto.randomUUID();
      graph.metadata.visual.presentation.themes[themeId] = graphTheme;
      graph.metadata.visual.presentation.theme = themeId;
      return;
    }

    const { themeColors, template, templateAdditionalOptions } =
      graph.metadata.visual.presentation;
    const graphTheme: GraphTheme = {
      themeColors,
      templateAdditionalOptions,
      template,
    };

    const splashScreen = graph.assets?.["@@splash"];
    if (
      isLLMContentArray(splashScreen?.data) &&
      isStoredData(splashScreen.data[0]?.parts[0])
    ) {
      graphTheme.splashScreen = splashScreen.data[0].parts[0];
    }

    graph.metadata.visual.presentation.themes ??= {};

    // Set the theme.
    const themeId = globalThis.crypto.randomUUID();
    graph.metadata.visual.presentation.themes[themeId] = graphTheme;
    graph.metadata.visual.presentation.theme = themeId;

    // Remove the legacy values.
    delete graph.metadata.visual.presentation.template;
    delete graph.metadata.visual.presentation.templateAdditionalOptions;
    delete graph.metadata.visual.presentation.themeColors;
  }

  async createTabFromURL(
    boardUrl: string,
    currentUrl: string | null = null,
    _createNewTab = false,
    readOnly = false,
    dispatchTabChangeEvent = true,
    moduleId: ModuleIdentifier | null = null,
    subGraphId: GraphIdentifier | null = null,
    creator: EditHistoryCreator | null = null
  ): Promise<void> {
    const urlAtTimeOfCall = this.currentURL?.href ?? null;
    const url = this.#makeRelativeToCurrentBoard(boardUrl, currentUrl);
    if (!url) {
      return;
    }

    try {
      const base = new URL(window.location.href);
      let boardServer: BoardServer | null = null;

      let kits = this.boardServerKits;
      let graph: GraphDescriptor | null = null;
      if (this.#canParse(url, base.href)) {
        boardServer = this.getBoardServerForURL(new URL(url, base));
        if (boardServer) {
          // Ensure the the provider has actually loaded fully before
          // requesting the graph file from it.
          await boardServer.ready();
        }
        if (boardServer && this.boardServers) {
          kits = (boardServer as BoardServer).kits ?? this.boardServerKits;
          const loadResult = await this.boardServers.loader.load(url, { base });
          graph = loadResult.success ? loadResult.graph : null;
        } else {
          const loadResult = await this.loader.load(url, { base });
          graph = loadResult.success ? loadResult.graph : null;
        }
      }

      if (!graph) {
        const urlObj = new URL(url);
        if (urlObj.protocol === "drive:") {
          // If we can't load a Google Drive board, it's likely that the user
          // needs to "pick" it so that it's visible to our application (this is
          // an expected byproduct of using the drive.file OAuth scope).
          const picker = document.createElement("bb-google-drive-picker");
          picker.mode = "pick-shared-board";
          picker.fileIds = [urlObj.pathname.replace(/^\/+/, "")];

          // Note we must put the picker in <bb-main>, because we need access to
          // a SigninAdapter which is provided via a Lit context provided there.
          const main = document.body.querySelector("bb-main");
          if (!main) {
            console.error("Could not find <bb-main>");
            return;
          }
          // TODO(aomarks) It would be better if this was a method on main,
          // since it breaks encapsulation, and if we're not careful we could
          // step on Lit's toes a bit. In practice, this works fine for now,
          // especially because we remove the element after the picker closes so
          // Lit shouldn't even notice anything happened.
          if (!main.shadowRoot) {
            console.error("<bb-main> did not have a shadowRoot");
            return;
          }
          main.shadowRoot.appendChild(picker);

          picker.open();
          await new Promise<void>((resolve) => {
            picker.addEventListener("close", () => resolve());
          });
          picker.remove();
          // Try again!
          return this.createTabFromURL(
            boardUrl,
            currentUrl,
            _createNewTab,
            readOnly,
            dispatchTabChangeEvent,
            moduleId,
            subGraphId,
            creator
          );
        } else {
          this.dispatchEvent(new RuntimeErrorEvent("Unable to load board"));
          return;
        }
      }

      // Check to see if this is an imperative grpah
      if (graph.main && !moduleId) {
        moduleId = graph.main;
      }

      // Confirm the module exists before setting it.
      if (moduleId && (!graph.modules || !graph.modules[moduleId])) {
        moduleId = null;
      }

      if (subGraphId && (!graph.graphs || !graph.graphs[subGraphId])) {
        subGraphId = null;
      }

      if (graph.graphs?.["Main board"]) {
        graph.graphs[globalThis.crypto.randomUUID()] =
          graph.graphs?.["Main board"];
        delete graph.graphs?.["Main board"];
      }

      this.#migrateThemeInformationIfPresent(graph);
      await this.#createAppPaletteIfNeeded(graph);

      // This is not elegant, since we actually load the graph by URL,
      // and we should know this mainGraphId by now.
      // TODO: Make this more elegant.
      const mainGraphId = this.getGraphStore().addByDescriptor(graph);
      if (!mainGraphId.success) {
        throw new Error(`Unable to add graph: ${mainGraphId.error}`);
      }

      // Before creating the tab ensure that the tab's URL still matches the one
      // we want to have open.
      if (urlAtTimeOfCall !== this.currentURL?.href) {
        return;
      }

      const id = globalThis.crypto.randomUUID();
      const graphIsMine = this.isMine(graph.url);
      this.#tabs.set(id, {
        id,
        boardServerKits: kits,
        name: graph.title ?? "Untitled board",
        graph,
        graphIsMine,
        mainGraphId: mainGraphId.result,
        subGraphId,
        moduleId,
        boardServer,
        type: TabType.URL,
        version: 1,
        readOnly: !graphIsMine,
        creator: creator ?? undefined,
        history: await this.#loadLocalHistory(url),
        onHistoryChanged: (history) => this.#saveLocalHistory(url, history),
      });

      // If there's a current tab, close it.
      // We are in a single-tab environment for now.
      if (this.#currentTabId) {
        this.closeTab(this.#currentTabId);
      }

      this.#currentTabId = id;

      // When we create multiple tabs at once we dispatch the event elsewhere,
      // which means we don't want to do it here.
      if (!dispatchTabChangeEvent) {
        return;
      }

      await this.#trackRecentBoard(graph.url);
      this.dispatchEvent(new RuntimeTabChangeEvent());
    } catch (err) {
      console.warn(err);
      this.dispatchEvent(new RuntimeBoardLoadErrorEvent());
    }
  }

  changeTab(id: TabId) {
    if (!this.#tabs.has(id)) {
      return;
    }

    this.#currentTabId = id;
    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  changeWorkspaceItem(
    id: TabId,
    subGraphId: GraphIdentifier | null,
    moduleId: ModuleIdentifier | null
  ) {
    const tab = this.#tabs.get(id);
    if (!tab) {
      return;
    }

    if (subGraphId && moduleId) {
      console.error("Unable to select both a subgraph and module");
      return;
    }

    tab.subGraphId = subGraphId;
    tab.moduleId = moduleId;

    this.dispatchEvent(new RuntimeWorkspaceItemChangeEvent());
  }

  closeAllTabs() {
    const tabList = [...this.#tabs.keys()];
    for (let t = 0; t < tabList.length; t++) {
      this.#tabs.delete(tabList[t]);
      this.dispatchEvent(new RuntimeTabCloseEvent(tabList[t]));
    }
  }

  closeTab(id: TabId) {
    let nextTab = null;

    const tabList = [...this.#tabs.keys()];
    for (let t = 0; t < tabList.length; t++) {
      if (tabList[t] !== id) {
        continue;
      }

      if (t === 0 && tabList.length > 1) {
        nextTab = tabList[t + 1];
        break;
      }

      if (t > 0) {
        nextTab = tabList[t - 1];
        break;
      }
    }

    this.#tabs.delete(id);
    this.dispatchEvent(new RuntimeTabCloseEvent(id));

    if (id !== this.#currentTabId) {
      return;
    }

    this.#currentTabId = nextTab;
    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  canSave(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return false;
    }

    if (!tab.graph || !tab.graph.url) {
      return false;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return false;
    }

    const capabilities = boardServer.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return false;
    }

    for (const store of boardServer.items().values()) {
      for (const item of store.items.values()) {
        if (
          item.url !== tab.graph.url &&
          item.url.replace(USER_REGEX, "/") !== tab.graph.url
        ) {
          continue;
        }

        return item.mine && !item.readonly;
      }
    }

    return false;
  }

  isMine(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    const boardUrl = new URL(url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return false;
    }

    const capabilities = boardServer.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return false;
    }

    for (const store of boardServer.items().values()) {
      for (const item of store.items.values()) {
        if (item.url !== url && item.url.replace(USER_REGEX, "/") !== url) {
          continue;
        }

        return item.mine;
      }
    }

    return false;
  }

  canPreview(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return false;
    }

    if (!tab.graph || !tab.graph.url) {
      return false;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return false;
    }

    return boardServer.capabilities.preview;
  }

  #tabSaveId = new Map<
    TabId,
    ReturnType<typeof globalThis.crypto.randomUUID>
  >();
  #tabSaveStatus = new Map<TabId, BreadboardUI.Types.BOARD_SAVE_STATUS>();

  saveStatus(id: TabId) {
    return this.#tabSaveStatus.get(id);
  }

  clearSaveStatus(id: TabId) {
    this.#tabSaveStatus.delete(id);
  }

  clearPendingBoardSave(id: TabId) {
    this.#tabSaveId.delete(id);
  }

  async save(
    id: TabId | null,
    timeout: number,
    messages: { start: string; end: string } | null
  ) {
    const noSave = { result: false, error: "Unable to save" };

    if (!id) {
      return noSave;
    }

    const tab = this.#tabs.get(id);
    if (!tab || tab.readOnly) {
      return noSave;
    }

    if (!tab.graph || !tab.graph.url) {
      return noSave;
    }

    const userInitiated = timeout !== 0;
    const boardServerAutosaves = !!tab?.boardServer?.capabilities.autosave;
    const useBoardServerEvents = !!tab?.boardServer?.capabilities.events;

    if (timeout !== 0 && !boardServerAutosaves) {
      const saveId = globalThis.crypto.randomUUID();
      this.#tabSaveId.set(tab.id, saveId);
      await new Promise((r) => setTimeout(r, timeout));

      // Check the tab still exists.
      if (!this.tabs.has(tab.id)) {
        return noSave;
      }

      // If the stored save ID has changed then the user has made a newer change
      // and there is another save pending; therefore, ignore this request.
      const storedSaveId = this.#tabSaveId.get(tab.id);
      if (!storedSaveId || storedSaveId !== saveId) {
        return noSave;
      }

      this.#tabSaveId.delete(tab.id);
    }

    const saveStatus = this.#tabSaveStatus.get(tab.id);
    if (
      (saveStatus &&
        saveStatus === BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING) ||
      !this.canSave(tab.id)
    ) {
      return noSave;
    }

    let snackbarId;
    if (messages) {
      snackbarId = globalThis.crypto.randomUUID();
      this.dispatchEvent(
        new RuntimeSnackbarEvent(
          snackbarId,
          messages.start,
          BreadboardUI.Types.SnackType.PENDING,
          [],
          true,
          true
        )
      );
    }

    if (!useBoardServerEvents) {
      this.#tabSaveStatus.set(
        tab.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING
      );

      this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
    }

    try {
      // Remove the legacy SVG thumbnail.
      tab.graph.assets ??= {};
      delete tab.graph.assets["@@thumbnail"];

      const boardUrl = new URL(tab.graph.url);
      const boardServer = this.getBoardServerForURL(boardUrl);
      if (!boardServer) {
        return noSave;
      }

      const capabilities = boardServer.canProvide(boardUrl);
      if (!capabilities || !capabilities.save) {
        return noSave;
      }

      const result = await boardServer.save(boardUrl, tab.graph, userInitiated);

      if (snackbarId && messages) {
        this.dispatchEvent(
          new RuntimeSnackbarEvent(
            snackbarId,
            messages.end,
            BreadboardUI.Types.SnackType.INFORMATION,
            [],
            false,
            true
          )
        );
      }

      if (!useBoardServerEvents) {
        this.#tabSaveStatus.set(
          tab.id,
          BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED
        );
        this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
        return result;
      }

      if (!result) {
        this.#tabSaveStatus.set(
          tab.id,
          BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
        );
        this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
        return result;
      }

      return result;
    } catch {
      this.#tabSaveStatus.set(
        tab.id,
        BreadboardUI.Types.BOARD_SAVE_STATUS.ERROR
      );
      this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
    }

    return noSave;
  }

  #isSavingAs = false;
  async saveAs(
    boardServerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor,
    ackUser = true,
    ackUserMessage: { start: string; end: string; error: string }
  ) {
    if (this.#isSavingAs) {
      return null;
    }

    this.#isSavingAs = true;

    let snackbarId;
    if (ackUser) {
      snackbarId = globalThis.crypto.randomUUID();
      this.dispatchEvent(
        new RuntimeSnackbarEvent(
          snackbarId,
          ackUserMessage.start,
          BreadboardUI.Types.SnackType.INFORMATION,
          [],
          true,
          true
        )
      );
    }

    const fail = { result: false, error: "Unable to save", url: undefined };
    const boardServer = this.getBoardServerByName(boardServerName);
    if (!boardServer) {
      this.#isSavingAs = false;
      if (snackbarId) {
        this.dispatchEvent(
          new RuntimeSnackbarEvent(
            snackbarId,
            ackUserMessage.error,
            BreadboardUI.Types.SnackType.ERROR,
            [],
            true,
            true
          )
        );
      }
      return fail;
    }

    const urlString = await boardServer.createURL(location, fileName);
    if (!urlString) {
      this.#isSavingAs = false;
      if (snackbarId) {
        this.dispatchEvent(
          new RuntimeSnackbarEvent(
            snackbarId,
            ackUserMessage.error,
            BreadboardUI.Types.SnackType.ERROR,
            [],
            true,
            true
          )
        );
      }
      return fail;
    }

    let url = new URL(urlString);

    // Replace pointers with inline data so that copies get created when saving.
    graph = await this.#deepCopyGraph(boardServer, graph, url);

    const response = await boardServer.create(url, graph);
    if (response.url) {
      url = new URL(response.url);
    }

    this.#isSavingAs = false;
    return { ...response, url };
  }

  async delete(providerName: string, url: string) {
    const fail = { result: false, error: "Unable to delete" };
    const boardServer = this.getBoardServerByName(providerName);
    if (!boardServer) {
      return fail;
    }

    await this.#removeRecentUrl(url);
    return await boardServer.delete(new URL(url));
  }

  async extensionAction<T extends BoardServerExtensionNamespace>(
    id: TabId | null,
    namespace: T,
    action: keyof BoardServerExtension[T],
    ...args: unknown[]
  ) {
    if (!id) {
      return;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return;
    }

    switch (namespace) {
      case "node": {
        switch (action) {
          case "onSelect": {
            // id: NodeIdentifier,
            // type: string,
            // configuration: NodeConfiguration
            const node = tab.graph.nodes.find((node) => node.id === args[0]);
            const comment = tab.graph.metadata?.comments?.find(
              (comment) => comment.id === args[0]
            );
            args = [
              ...args,
              node ? node.type : comment ? "comment" : "unknown",
              node ? node.configuration : comment ? comment.text : {},
            ];
            break;
          }

          case "onDeselect": {
            // Noop.
            break;
          }

          case "onAction": {
            // action: string,
            // kits: Kit[],
            // id: NodeIdentifier,
            // type: string,
            // configuration: NodeConfiguration
            const node = tab.graph.nodes.find((node) => node.id === args[0]);
            const comment = tab.graph.metadata?.comments?.find(
              (comment) => comment.id === args[0]
            );
            args = [
              "replaceContent",
              tab.boardServerKits,
              ...args,
              node ? node.type : comment ? "comment" : "unknown",
              node ? node.configuration : comment ? comment.text : {},
            ];
            break;
          }
        }
      }
    }

    // API.
    const dispatchEvent = this.dispatchEvent.bind(this);
    args.unshift({
      async send(method: string, args: unknown[]) {
        dispatchEvent(new RuntimeHostAPIEvent(tab, method, args));
      },
    });

    return this.#handleExtensionAction(tab, namespace, action, ...args);
  }

  async #handleExtensionAction<T extends BoardServerExtensionNamespace>(
    tab: Tab,
    namespace: T,
    action: keyof BoardServerExtension[T],
    ...args: unknown[]
  ) {
    if (!tab.graph || !tab.graph.url) {
      return;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.getBoardServerForURL(boardUrl);
    if (!boardServer) {
      return;
    }

    for (const extension of boardServer.extensions) {
      const ns = extension[namespace];
      if (ns && ns[action]) {
        if (typeof ns[action] !== "function") {
          continue;
        }

        await ns[action].call(null, ...args);
      }
    }
  }

  async #loadLocalHistory(url: string): Promise<EditHistoryEntry[]> {
    const db = await this.#openLocalHistoryDB();
    const revisions = (await db.get("revisions", url)) ?? [];
    db.close();
    return revisions;
  }

  async #saveLocalHistory(
    url: string,
    history: readonly EditHistoryEntry[]
  ): Promise<void> {
    const db = await this.#openLocalHistoryDB();
    await db.put("revisions", history as EditHistoryEntry[], url);
    db.close();
  }

  async #openLocalHistoryDB() {
    return await idb.openDB<LocalEditHistoryDBSchema>(
      LOCAL_EDIT_HISTORY_KEY,
      LOCAL_EDIT_HISTORY_VERSION,
      {
        upgrade(db) {
          if (!db.objectStoreNames.contains("revisions")) {
            db.createObjectStore("revisions");
          }
        },
      }
    );
  }

  async #deepCopyGraph(
    boardServer: BoardServer,
    graph: GraphDescriptor,
    graphUrl: URL
  ): Promise<GraphDescriptor> {
    return boardServer.deepCopy(graphUrl, graph);
  }
}

function toSaveStatus(status: BoardServerSaveEventStatus): BOARD_SAVE_STATUS {
  let result;

  switch (status) {
    case "saving":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING;
      break;
    case "idle":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED;
      break;
    case "debouncing":
    case "queued":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED;
      break;
    default:
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED;
      break;
  }
  return result;
}
