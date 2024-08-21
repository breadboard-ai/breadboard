/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ChangeNotificationCallback,
  type GraphDescriptor,
  type GraphProvider,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderStore,
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

export class BoardServerProvider implements GraphProvider {
  #path: string;
  #loader: BoardServerLoadFunction;

  name = "Board Server Provider";

  constructor(path: string, loader: BoardServerLoadFunction) {
    this.#path = path;
    this.#loader = loader;
  }

  async ready(): Promise<void> {
    return;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    return url.href.endsWith(this.#path)
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

  async load(_url: URL): Promise<GraphDescriptor | null> {
    return this.#loader(this.#path);
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
