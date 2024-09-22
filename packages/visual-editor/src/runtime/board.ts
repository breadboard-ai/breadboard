/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { RuntimeConfigBoardServers, Tab, TabId, TabType } from "./types";
import {
  RuntimeBoardLoadErrorEvent,
  RuntimeErrorEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
} from "./events";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { IDBBoardServer } from "@breadboard-ai/idb-board-server";

export class Board extends EventTarget {
  #tabs = new Map<TabId, Tab>();
  #currentTabId: TabId | null = null;

  constructor(
    private readonly providers: GraphProvider[],
    private readonly loader: GraphLoader,
    private readonly kits: Kit[],
    private readonly boardServers?: RuntimeConfigBoardServers
  ) {
    super();
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
    } catch (err) {
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
        } catch (e) {
          console.warn("Unable to parse URL from current board: ", currentUrl);
        }
      }
    }
    return boardUrl;
  }

  #getProviderByName(name: string) {
    if (this.boardServers) {
      return (
        this.boardServers.servers.find((server) => server.name === name) || null
      );
    }

    return this.providers.find((provider) => provider.name === name) || null;
  }

  #getProviderForURL(url: URL) {
    if (this.boardServers) {
      return (
        this.boardServers.servers.find((server) => server.canProvide(url)) ||
        null
      );
    }

    return this.providers.find((provider) => provider.canProvide(url)) || null;
  }

  getProviders(): GraphProvider[] {
    if (this.boardServers) {
      return this.boardServers.servers;
    }

    return this.providers;
  }

  getLoader(): GraphLoader {
    if (this.boardServers) {
      return this.boardServers.loader;
    }

    return this.loader;
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

  createURLFromTabs() {
    const params = new URLSearchParams();
    let t = 0;
    for (const tab of this.#tabs.values()) {
      if (tab.type !== TabType.URL || !tab.graph.url) {
        continue;
      }

      params.set(`tab${t++}`, tab.graph.url);
    }

    const url = new URL(window.location.href);
    url.search = params.toString();
    return url;
  }

  async createTabsFromURL(url: URL) {
    const params = new URLSearchParams(url.search);

    let t = 0;
    const board = params.get("board");
    if (board) {
      params.set(`tab${t++}`, board);
      params.delete("board");
    }

    const tabs = [...params].sort(([idA], [idB]) => {
      if (idA > idB) return 1;
      if (idA < idB) return -1;
      return 0;
    });

    if (tabs.length > 0) {
      for (const [, tab] of tabs) {
        if (tab.startsWith("run://") || tab.startsWith("descriptor://")) {
          continue;
        }

        await this.createTabFromURL(tab, url.href, true, false, false);
      }
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

    const id = globalThis.crypto.randomUUID();
    this.#tabs.set(id, {
      id,
      kits: this.kits,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      subGraphId: null,
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

    const id = globalThis.crypto.randomUUID();
    this.#tabs.set(id, {
      id,
      kits: this.kits,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      subGraphId: null,
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

  async createTabFromURL(
    boardUrl: string,
    currentUrl: string | null = null,
    createNewTab = false,
    readOnly = false,
    dispatchTabChangeEvent = true
  ) {
    let url = this.#makeRelativeToCurrentBoard(boardUrl, currentUrl);

    // Redirect older /graphs examples to /example-boards
    if (url?.startsWith("/graphs")) {
      url = url.replace(/^\/graphs/, "/example-boards");
    }

    // Match any older URLs like /example-boards/blank.json and redirect to the
    // newer /example-boards/playground/blank.json
    const pgRegex = /example-boards\/([^\\/]+.json)$/;
    const matches = pgRegex.exec(boardUrl ?? "");
    if (url && matches && matches.length === 2) {
      url = `/example-boards/playground/${matches[1]}`;
    }

    if (!url) {
      return;
    }

    try {
      const base = new URL(window.location.href);

      let kits = this.kits;
      let graph: GraphDescriptor | null = null;
      if (this.#canParse(url, base.href)) {
        const provider = this.#getProviderForURL(new URL(url, base));
        if (provider) {
          // Ensure the the provider has actually loaded fully before
          // requesting the graph file from it.
          await provider.ready();
        }

        if (this.boardServers) {
          kits = (provider as IDBBoardServer).kits ?? this.kits;
          graph = await this.boardServers.loader.load(url, { base });
        } else {
          graph = await this.loader.load(url, { base });
        }
      }

      // Re-use an existing tab if possible.
      if (!createNewTab) {
        for (const [id, tab] of this.#tabs) {
          if (tab.graph.url !== boardUrl) {
            continue;
          }

          this.#currentTabId = id;
          this.dispatchEvent(new RuntimeTabChangeEvent());
          return;
        }
      }

      if (!graph) {
        this.dispatchEvent(new RuntimeErrorEvent("Unable to load board"));
        return;
      }

      const id = globalThis.crypto.randomUUID();
      this.#tabs.set(id, {
        id,
        kits,
        name: graph.title ?? "Untitled board",
        graph,
        subGraphId: null,
        type: TabType.URL,
        version: 1,
        readOnly,
      });

      this.#currentTabId = id;

      // When we create multiple tabs at once we dispatch the event elsewhere,
      // which means we don't want to do it here.
      if (!dispatchTabChangeEvent) {
        return;
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
    const provider = this.#getProviderForURL(boardUrl);
    if (!provider) {
      return false;
    }

    const capabilities = provider.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return false;
    }

    return true;
  }

  save(id: TabId | null) {
    if (!id) {
      return { result: false, error: "Unable to save" };
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return { result: false, error: "Unable to save" };
    }

    if (!tab.graph || !tab.graph.url) {
      return { result: false, error: "Unable to save" };
    }

    const boardUrl = new URL(tab.graph.url);
    const provider = this.#getProviderForURL(boardUrl);
    if (!provider) {
      return { result: false, error: "Unable to save" };
    }

    const capabilities = provider.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return { result: false, error: "Unable to save" };
    }

    return provider.save(boardUrl, tab.graph);
  }

  async saveAs(
    providerName: string,
    location: string,
    fileName: string,
    graph: GraphDescriptor
  ) {
    const fail = { result: false, error: "Unable to save", url: undefined };
    const provider = this.#getProviderByName(providerName);
    if (!provider) {
      return fail;
    }

    const urlString = await provider.createURL(location, fileName);
    if (!urlString) {
      return fail;
    }

    const url = new URL(urlString);
    const response = await provider.create(url, graph);
    return { ...response, url };
  }

  async delete(providerName: string, url: string) {
    const fail = { result: false, error: "Unable to delete" };
    const provider = this.#getProviderByName(providerName);
    if (!provider) {
      return fail;
    }

    return await provider.delete(new URL(url));
  }
}
