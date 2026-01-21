/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServer,
  BoardServerSaveEventStatus,
  GraphLoader,
  OutputValues,
} from "@breadboard-ai/types";
import {
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
  GraphIdentifier,
  ModuleIdentifier,
  MutableGraphStore,
} from "@breadboard-ai/types";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { type RunResults } from "@breadboard-ai/utils/google-drive/operations.js";
import * as idb from "idb";
import * as BreadboardUI from "../ui/index.js";
import { BOARD_SAVE_STATUS } from "../ui/types/types.js";
import type { SigninAdapter } from "../ui/utils/signin-adapter.js";
import {
  RuntimeBoardLoadErrorEvent,
  RuntimeBoardSaveStatusChangeEvent,
  RuntimeErrorEvent,
  RuntimeNewerSharedVersionEvent,
  RuntimeRequestSignInEvent,
  RuntimeSnackbarEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
  RuntimeUnsnackbarEvent,
} from "./events.js";
import { Tab, TabId, TabType } from "./types.js";
import {
  applyDefaultThemeInformationIfNonePresent,
  createAppPaletteIfNeeded,
} from "./util.js";
import { GoogleDriveBoardServer } from "../board-server/server.js";
import { parseUrl } from "../ui/utils/urls.js";

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${string}` | `--${string}`;

const SHARED_VERSION_HISTORY_KEY = "shared-version-history";
const SHARED_VERSION_HISTORY_VERSION = 1;
interface SharedVersionHistoryDBSchema extends idb.DBSchema {
  versions: {
    key: string;
    value: number;
  };
}

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
    public readonly loader: GraphLoader,
    public readonly graphStore: MutableGraphStore,
    public readonly googleDriveBoardServer: GoogleDriveBoardServer,
    private readonly signinAdapter: SigninAdapter,
    private readonly googleDriveClient?: GoogleDriveClient
  ) {
    super();
    this.googleDriveBoardServer.addEventListener(
      "savestatuschange",
      ({ url, status }) => {
        if (!this.#currentTabId) {
          return;
        }

        const currentTab = this.#tabs.get(this.#currentTabId);
        if (!currentTab || currentTab.graph?.url !== url) {
          return;
        }

        this.#tabSaveStatus.set(this.#currentTabId, toSaveStatus(status));
        this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
      }
    );
  }

  currentURL: URL | null = null;

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
    const parsed = parseUrl(url);
    return parsed.page === "graph" ? parsed.flow : undefined;
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
      await this.createTabFromURL(flow, url.href, true, false, null, null);
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
    const mainGraphId = this.graphStore.addByDescriptor(descriptor);
    if (!mainGraphId.success) {
      throw new Error(`Unable to add graph: ${mainGraphId.error}`);
    }
    this.#tabs.set(id, {
      id,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      graphIsMine: true,
      mainGraphId: mainGraphId.result,
      subGraphId: null,
      boardServer: null,
      moduleId,
      version: 1,
      lastLoadedVersion: 1,
      type: TabType.DESCRIPTOR,
      readOnly: false,
    });

    this.#currentTabId = id;
    if (!dispatchTabChangeEvent) {
      return;
    }

    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  async createTabFromURL(
    boardUrl: string,
    currentUrl: string | null = null,
    _createNewTab = false,
    dispatchTabChangeEvent = true,
    moduleId: ModuleIdentifier | null = null,
    subGraphId: GraphIdentifier | null = null,
    creator: EditHistoryCreator | null = null,
    resultsFileId?: string
  ): Promise<void> {
    const urlAtTimeOfCall = this.currentURL?.href ?? null;
    const url = this.#makeRelativeToCurrentBoard(boardUrl, currentUrl);
    if (!url) {
      return;
    }

    try {
      const base = new URL(window.location.href);
      let boardServer: BoardServer | null = null;

      let graph: GraphDescriptor | null = null;
      if (this.#canParse(url, base.href)) {
        boardServer = this.googleDriveBoardServer;
        const resourceKey = urlAtTimeOfCall
          ? new URL(urlAtTimeOfCall).searchParams.get("resourcekey")
          : null;
        const urlMaybeWithResourceKey = resourceKey
          ? url + `?resourcekey=${resourceKey}`
          : url;
        const loadResult = await this.loader.load(urlMaybeWithResourceKey, {
          base,
        });
        graph = loadResult.success ? loadResult.graph : null;
      }

      if (!graph) {
        if ((await this.signinAdapter.state) === "signedout") {
          this.dispatchEvent(new RuntimeRequestSignInEvent());
        } else {
          this.dispatchEvent(new RuntimeErrorEvent("Unable to load board"));
        }
        return;
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

      applyDefaultThemeInformationIfNonePresent(graph);
      await createAppPaletteIfNeeded(graph, this.googleDriveClient);

      // This is not elegant, since we actually load the graph by URL,
      // and we should know this mainGraphId by now.
      // TODO: Make this more elegant.
      const mainGraphId = this.graphStore.addByDescriptor(graph);
      if (!mainGraphId.success) {
        throw new Error(`Unable to add graph: ${mainGraphId.error}`);
      }

      // Before creating the tab ensure that the tab's URL still matches the one
      // we want to have open.
      if (urlAtTimeOfCall !== this.currentURL?.href) {
        return;
      }

      let finalOutputValues: OutputValues | undefined;
      if (resultsFileId) {
        if (this.googleDriveClient) {
          const response =
            await this.googleDriveClient.getFileMedia(resultsFileId);
          const runResults = (await response.json()) as RunResults;
          finalOutputValues = runResults.finalOutputValues;
        } else {
          console.error(
            `No GoogleDriveClient provided. Can not fetch results.`
          );
        }
      }

      const id = globalThis.crypto.randomUUID();
      const graphIsMine = this.isMine(graph.url);
      const shouldCheckVersion = !graphIsMine;

      let version = -1;
      let lastLoadedVersion = -1;

      if (
        shouldCheckVersion &&
        graph.url &&
        boardServer &&
        boardServer.getLatestSharedVersion
      ) {
        lastLoadedVersion = await this.#loadSharedVersionHistory(graph.url);
        version = boardServer.getLatestSharedVersion(new URL(graph.url));
        await this.#saveSharedVersionHistory(graph.url, version);
      }

      this.#tabs.set(id, {
        id,
        name: graph.title ?? "Untitled board",
        graph,
        graphIsMine,
        mainGraphId: mainGraphId.result,
        subGraphId,
        moduleId,
        boardServer,
        type: TabType.URL,
        version,
        lastLoadedVersion,
        readOnly: !graphIsMine,
        creator: creator ?? undefined,
        history: await this.#loadLocalHistory(url),
        onHistoryChanged: (history) => this.#saveLocalHistory(url, history),
        finalOutputValues,
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

      const isNewerVersionOfSharedGraph =
        !graphIsMine && lastLoadedVersion !== -1 && lastLoadedVersion < version;

      if (isNewerVersionOfSharedGraph) {
        this.dispatchEvent(new RuntimeNewerSharedVersionEvent());
      }

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
    const boardServer = this.googleDriveBoardServer;
    if (!boardServer) {
      return false;
    }

    const capabilities = boardServer.canProvide(boardUrl);
    return capabilities && capabilities.save;
  }

  isMine(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    const boardUrl = new URL(url);
    const boardServer = this.googleDriveBoardServer;
    if (!boardServer) {
      return false;
    }
    return boardServer.isMine(boardUrl);
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
      const boardServer = this.googleDriveBoardServer;

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
    _boardServerName: string,
    _location: string,
    _fileName: string,
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
          BreadboardUI.Types.SnackType.PENDING,
          [],
          true,
          true
        )
      );
    }

    const fail = { result: false, error: "Unable to save", url: undefined };
    const boardServer = this.googleDriveBoardServer;
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

    try {
      // A couple of our methods take a graph URL even though it's not used.
      const ignoredPlaceholderUrl = new URL("http://invalid");

      // Replace pointers with inline data so that copies get created when saving.
      graph = await this.#deepCopyGraph(
        boardServer,
        graph,
        ignoredPlaceholderUrl
      );

      const { url: urlString } = await boardServer.create(
        ignoredPlaceholderUrl,
        graph
      );
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

      return { result: true, url: new URL(urlString) };
    } catch {
      return fail;
    } finally {
      if (snackbarId) {
        this.dispatchEvent(new RuntimeUnsnackbarEvent());
      }
      this.#isSavingAs = false;
    }
  }

  async delete(
    _providerName: string,
    url: string,
    messages: { start: string; end: string; error: string }
  ) {
    const snackbarId = globalThis.crypto.randomUUID();
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

    const fail = { result: false, error: "Unable to delete" };
    const boardServer = this.googleDriveBoardServer;
    if (!boardServer) {
      return fail;
    }

    const result = await boardServer.delete(new URL(url));

    if (this.#currentTabId) {
      this.closeTab(this.#currentTabId);
    }

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

    return result;
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

  async #loadSharedVersionHistory(url: string): Promise<number> {
    const db = await this.#openSharedVersionDB();
    const version = (await db.get("versions", url)) ?? -1;
    db.close();

    return version;
  }

  async #saveSharedVersionHistory(url: string, version: number): Promise<void> {
    const db = await this.#openSharedVersionDB();
    await db.put("versions", version, url);
    db.close();
  }

  async #openSharedVersionDB() {
    return await idb.openDB<SharedVersionHistoryDBSchema>(
      SHARED_VERSION_HISTORY_KEY,
      SHARED_VERSION_HISTORY_VERSION,
      {
        upgrade(db) {
          if (!db.objectStoreNames.contains("versions")) {
            db.createObjectStore("versions");
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
