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
  RuntimeBoardEditEvent,
  RuntimeBoardLoadErrorEvent,
  RuntimeBoardSaveStatusChangeEvent,
  RuntimeErrorEvent,
  RuntimeNewerSharedVersionEvent,
  RuntimeRequestSignInEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
} from "./events.js";
import { Tab, TabId, TabType } from "./types.js";
import {
  applyDefaultThemeInformationIfNonePresent,
  createAppPaletteIfNeeded,
} from "./util.js";
import { GoogleDriveBoardServer } from "../board-server/server.js";
import { parseUrl } from "../ui/utils/urls.js";
import { SCA } from "../sca/sca.js";

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
    private readonly googleDriveClient?: GoogleDriveClient,
    /** Here for migrations */
    private readonly __sca?: SCA
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

      const tab: Tab = {
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
      };

      this.#tabs.set(id, tab);

      if (this.__sca) {
        // Set up legacy event handling.
        const editor = this.graphStore.editByDescriptor(graph, {
          creator: tab.creator,
          history: tab.history,
          onHistoryChanged: tab.onHistoryChanged,
        });
        if (!editor) throw new Error("Unable to edit by descriptor");

        editor.addEventListener("graphchange", (evt) => {
          tab.graph = evt.graph;

          this.dispatchEvent(
            new RuntimeBoardEditEvent(
              tab.id,
              // This is wrong, since we lose the graphId here.
              // TODO: Propagate graphId out to listeners of
              // RuntimeBoardEditEvent.
              evt.visualOnly ? [] : evt.affectedNodes.map((node) => node.id),
              evt.visualOnly
            )
          );
        });

        editor.addEventListener("graphchangereject", (evt) => {
          tab.graph = evt.graph;

          const { reason } = evt;
          if (reason.type === "error") {
            this.dispatchEvent(new RuntimeErrorEvent(reason.error));
          }
        });

        this.__sca.controller.editor.graph.id = id;
        this.__sca.controller.editor.graph.setEditor(editor);
        this.__sca.controller.editor.graph.url = url;
        this.__sca.controller.editor.graph.version = version;
        this.__sca.controller.editor.graph.readOnly = !graphIsMine;
        this.__sca.controller.editor.graph.graphIsMine = graphIsMine;
        this.__sca.controller.editor.graph.mainGraphId = mainGraphId.result;
        this.__sca.controller.editor.graph.lastLoadedVersion =
          lastLoadedVersion;
      }

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

    if (this.__sca) {
      this.__sca.controller.editor.graph.resetAll();
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
