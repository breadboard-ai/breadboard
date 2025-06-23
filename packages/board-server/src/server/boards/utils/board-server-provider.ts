/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerEventTarget,
  type BoardServerProject,
  type ChangeNotificationCallback,
  type DataPartTransformer,
  type GraphDescriptor,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderPreloadHandler,
  type GraphProviderStore,
  type Permission,
  type User,
} from "@google-labs/breadboard";

import type { BoardServerStore } from "../../store.js";
import type { BoardServerLoadFunction } from "../../types.js";

export function createBoardLoader(
  store: BoardServerStore,
  userId: string
): BoardServerLoadFunction {
  return async (path: string): Promise<GraphDescriptor | null> => {
    const { userStore, boardName } = parsePath(path);
    if (!userStore || !boardName) {
      return null;
    }
    const board = await store.loadBoard({
      name: boardName,
      owner: userStore,
      requestingUserId: userId,
    });
    return board?.graph ?? null;
  };
}

function parsePath(path: string) {
  const [userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
}

export class BoardServerProvider
  extends (EventTarget as BoardServerEventTarget)
  implements BoardServer
{
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

  constructor(
    serverUrl: string,
    path: string,
    loader: BoardServerLoadFunction
  ) {
    super();
    this.#serverUrl = serverUrl;
    this.#path = path;
    this.#loader = loader;
  }
  deepCopy(_url: URL, graph: GraphDescriptor): Promise<GraphDescriptor> {
    return Promise.resolve(graph);
  }
  canProxy?: ((url: URL) => Promise<string | false>) | undefined;
  renewAccess?: (() => Promise<void>) | undefined;
  preload?:
    | ((preloader: GraphProviderPreloadHandler) => Promise<void>)
    | undefined;
  dataPartTransformer?: ((graphUrl: URL) => DataPartTransformer) | undefined;

  // TODO this doesn't do anything now that we're passing in server URL
  async #initialize(): Promise<void> {
    if (this.#initialized) {
      return;
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
    const path = sameServer ? trimBoard(url.pathname) : this.#path;
    if (this.#cache.has(path)) {
      return this.#cache.get(path)!;
    }
    const graph = await this.#loader(path);
    if (graph) {
      this.#cache.set(path, graph);
    }
    return graph;
  }

  async save(
    _url: URL,
    _graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  create(
    _url: URL,
    _graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not supported.");
  }

  delete(_url: URL): Promise<{ result: boolean; error?: string }> {
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

  parseURL(_url: URL): { location: string; fileName: string } {
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

function trimBoard(path: string) {
  if (!path.startsWith("/boards/")) {
    throw new Error(`Board path "${path}" must start with "/boards/".`);
  }
  return path.slice("/boards/".length);
}
