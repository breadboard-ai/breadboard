/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphProviderChange,
  ChangeNotificationCallback,
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderStore,
} from "@google-labs/breadboard";

type BoardInfo = {
  title: string;
  url: string;
  version?: string;
};

const api = {
  loadBoards: async () => {
    const data = await fetch("/api/board/list");
    const boards = await data.json();
    return boards;
  },
  listenForChanges: (callback: (data: GraphProviderChange) => void) => {
    const evtSource = new EventSource("/~~debug");
    evtSource.addEventListener("update", (evt) => {
      let data: GraphProviderChange;
      try {
        data = JSON.parse(evt.data);
      } catch (e) {
        console.error("Failed to parse update event", evt.data);
        return;
      }
      callback(data);
    });
  },
};

export class DebuggerGraphProvider implements GraphProvider {
  name = "DebuggerGraphProvider";

  #blank: URL | null = null;
  #items: Map<string, GraphProviderStore> = new Map();

  items(): Map<string, GraphProviderStore> {
    return this.#items;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(_url: URL): false | GraphProviderCapabilities {
    // Never use this provider for loading.
    return false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: true,
    };
  }

  async load(_url: URL): Promise<GraphDescriptor | null> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be used to load graphs."
    );
  }

  async save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be used to save graphs."
    );
  }

  async createBlank(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be used to create blank graphs."
    );
  }

  async create(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be used to create graphs."
    );
  }

  async delete(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be used to delete graphs."
    );
  }

  async connect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be called to connect."
    );
  }

  async disconnect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be called to disconnect."
    );
  }

  async refresh(_location: string): Promise<boolean> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be called to refresh."
    );
  }

  async createURL(_location: string, _fileName: string): Promise<string> {
    throw new Error(
      "The `DebuggerGraphProvider` should not be called to create URL."
    );
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error(
      "The `DebuggerGraphProvider` should not be called to parse URL."
    );
  }

  async restore(): Promise<void> {
    const boards = (await api.loadBoards()) as BoardInfo[];
    const boardMap = new Map(
      boards.map((board) => {
        return [
          board.title,
          { url: board.url, mine: true, readonly: false, handle: undefined },
        ];
      })
    );
    this.#blank = new URL(boards[0].url, window.location.href);
    this.#items.set("debugger", {
      permission: "granted",
      title: "Boards to Debug",
      items: boardMap,
    });
  }

  startingURL(): URL | null {
    return this.#blank;
  }

  watch(callback: ChangeNotificationCallback): void {
    api.listenForChanges(callback);
  }
}
