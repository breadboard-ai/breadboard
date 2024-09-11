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
import { Tab, TabId } from "./types";
import {
  RuntimeBoardLoadErrorEvent,
  RuntimeErrorEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
} from "./events";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export class Board extends EventTarget {
  #tabs = new Map<TabId, Tab>();
  #currentTabId: TabId | null = null;

  constructor(
    public readonly providers: GraphProvider[],
    public readonly loader: GraphLoader,
    public readonly kits: Kit[]
  ) {
    super();
  }

  #canParse(url: string) {
    // TypeScript assumes that if `canParse` does not exist, then URL is
    // `never`. However, in older browsers that's not true. We therefore take a
    // temporary copy of the URL constructor here.
    const UrlCtor = URL;
    if ("canParse" in URL) {
      return URL.canParse(url);
    }

    try {
      new UrlCtor(url);
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
    return this.providers.find((provider) => provider.name === name) || null;
  }

  #getProviderForURL(url: URL) {
    return this.providers.find((provider) => provider.canProvide(url)) || null;
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

  async loadFromDescriptor(
    descriptor: GraphDescriptor,
    topGraphObserver?: BreadboardUI.Utils.TopGraphObserver,
    runObserver?: InspectableRunObserver
  ) {
    const id = globalThis.crypto.randomUUID();
    this.#tabs.set(id, {
      id,
      kits: this.kits,
      name: descriptor.title ?? "Untitled board",
      graph: descriptor,
      subGraphId: null,
      version: 1,
    });

    this.#currentTabId = id;
    this.dispatchEvent(
      new RuntimeTabChangeEvent(topGraphObserver, runObserver)
    );
  }

  async loadFromURL(boardUrl: string, currentUrl: string | null = null) {
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
      if (this.#canParse(url)) {
        const provider = this.#getProviderForURL(new URL(url));
        if (provider) {
          // Ensure the the provider has actually loaded fully before
          // requesting the graph file from it.
          await provider.ready();
        }
      }

      const graph = await this.loader.load(url, { base });
      if (!graph) {
        this.dispatchEvent(new RuntimeErrorEvent("Unable to load board"));
        return;
      }

      // TODO: Enable multiple tabs.
      const id = globalThis.crypto.randomUUID();
      this.#tabs.set(id, {
        id,
        kits: this.kits,
        name: graph.title ?? "Untitled board",
        graph,
        subGraphId: null,
        version: 1,
      });

      this.#currentTabId = id;
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
    this.dispatchEvent(new RuntimeTabCloseEvent(id));
    this.#currentTabId = null;

    const tabList = [...this.#tabs.keys()];
    for (let t = 0; t < tabList.length; t++) {
      if (tabList[t] !== id) {
        continue;
      }

      if (t === 0 && tabList.length > 1) {
        this.#currentTabId = tabList[t + 1];
        break;
      }

      if (t > 0) {
        this.#currentTabId = tabList[t - 1];
        break;
      }
    }

    this.#tabs.delete(id);
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
