/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerProject,
  type ChangeNotificationCallback,
  type GraphDescriptor,
  type GraphProvider,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderStore,
  type Permission,
  type User,
} from "@google-labs/breadboard";

import { asInfo, getStore } from "../../store.js";
import type { BoardServerLoadFunction } from "../../types.js";

export const loadFromStore = async (
  path: string
): Promise<GraphDescriptor | null> => {
  const store = getStore();
  const { userStore, boardName } = asInfo(path);
  if (!userStore || !boardName) {
    return null;
  }
  const graph = JSON.parse(await store.get(userStore, boardName));
  return graph as GraphDescriptor;
};

export class BoardServerProvider implements BoardServer {
  #initialized = false;
  #serverUrl: string | undefined;
  #path: string;
  #loader: BoardServerLoadFunction;
  #cache: Map<string, GraphDescriptor> = new Map();

  url: URL = new URL(
    typeof window !== "undefined"
      ? window.location.href
      : "https://breadboard-ai.github.io/"
  );
  projects: Promise<BoardServerProject[]> = Promise.resolve([]);
  kits = [];
  secrets = new Map();
  extensions = [];
  capabilities: BoardServerCapabilities = {
    connect: false,
    disconnect: false,
    preview: false,
    watch: false,
    refresh: false,
  };

  user: User = { username: "board-builder", apiKey: "", secrets: new Map() };
  users = [this.user];
  name = "Board Server Provider";

  constructor(path: string, loader: BoardServerLoadFunction) {
    this.#path = path;
    this.#loader = loader;
  }

  async #initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }
    try {
      const store = getStore();
      const info = await store.getServerInfo();
      if (info) {
        this.#serverUrl = info.url;
      }
    } catch (e) {
      // Ignore errors.
    }
    this.#initialized = true;
  }

  async ready(): Promise<void> {
    await this.#initialize();
  }

  getAccess(_url: URL, _user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const sameServer = url.origin === this.#serverUrl;
    return url.href.endsWith(this.#path) || sameServer
      ? {
          load: true,
          save: false,
          delete: false,
        }
      : false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
      preview: false,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    // This check is necessary because this.#path might actually be of a
    // different origin than the URL (commonly the case when board server is
    // running from local server).
    const sameServer = url.origin === this.#serverUrl;
    const key = sameServer ? url.pathname : this.#path;
    if (this.#cache.has(key)) {
      return this.#cache.get(key)!;
    }
    const path = sameServer ? url.pathname : this.#path;
    const graph = await this.#loader(path);
    if (graph) {
      this.#cache.set(key, graph);
    }
    return graph;
  }

  async save(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  create(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  delete(url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  connect: (location?: string, auth?: unknown) => Promise<boolean> =
    async () => {
      throw new Error("Method not supported.");
    };

  disconnect: (location: string) => Promise<boolean> = async () => {
    throw new Error("Method not supported.");
  };

  refresh: (location: string) => Promise<boolean> = async () => {
    throw new Error("Method not supported.");
  };

  createURL: (location: string, fileName: string) => Promise<string | null> =
    async () => {
      throw new Error("Method not supported.");
    };

  watch: (callback: ChangeNotificationCallback) => void = async () => {
    throw new Error("Method not supported.");
  };

  parseURL(url: URL): { location: string; fileName: string } {
    throw new Error("Method not supported.");
  }

  restore: () => Promise<void> = async () => {
    throw new Error("Method not supported.");
  };

  items: () => Map<string, GraphProviderStore> = () => {
    throw new Error("Method not supported.");
  };

  startingURL: () => URL | null = () => {
    throw new Error("Method not supported.");
  };

  preview: (_url: URL) => Promise<URL> = () => {
    throw new Error("Method not supported.");
  };
}
