/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// import * as KeyVal from "idb-keyval";
import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  blank,
} from "@google-labs/breadboard";
import { GraphProviderStore } from "./types";
import { GraphProviderExtendedCapabilities } from "@google-labs/breadboard";

export class RemoteGraphProvider implements GraphProvider {
  name = "RemoteGraphProvider";

  #name: string;
  #store: GraphProviderStore<void>;
  #stores: Map<string, GraphProviderStore<void>>;

  constructor(public readonly origin: string) {
    const url = new URL(origin);
    const port = url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
    this.#name = `${url.hostname}${port}`;
    this.#store = {
      permission: "granted",
      title: this.#name,
      items: new Map<string, { url: string; handle: void }>(),
    };
    this.#stores = new Map([[this.#name, this.#store]]);
  }

  async #sendToRemote(url: URL, descriptor: GraphDescriptor) {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(descriptor, null, 2),
      headers: new Headers([["Content-Type", "application/json"]]),
    });
    return await response.json();
  }

  createURL(_location: string, fileName: string) {
    return `${this.origin}/boards/${fileName}`;
  }

  parseURL(_url: URL) {
    throw new Error("Not implemented for RemoteGraphProvider");
    return { location: "", fileName: "" };
  }

  async load(url: URL) {
    const response = await fetch(url);
    const graph = await response.json();

    return graph;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(url, descriptor);
    if (data.error) {
      return { result: false };
    }

    await this.refresh();
    return { result: true };
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    try {
      const response = await fetch(url, { method: "DELETE" });
      const data = await response.json();
      await this.refresh();

      if (data.error) {
        return { result: false };
      }
      return { result: true };
    } catch (err) {
      return { result: true };
    }
  }

  async connect() {
    return true;
  }

  async disconnect(_location: string) {
    return true;
  }

  async refresh(): Promise<boolean> {
    try {
      await this.restore();
      return true;
    } catch (err) {
      return false;
    }
  }

  items() {
    return this.#stores;
  }

  startingURL() {
    return null;
  }

  isSupported(): boolean {
    return true;
  }

  async createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(url, blank());
    if (data.error) {
      return { result: false };
    }

    await this.refresh();
    return { result: true };
  }

  async restore() {
    const response = await fetch(`${this.origin}/boards`);
    const files = await response.json();

    this.#store.items.clear();

    for (const file of files) {
      this.#store.items.set(file, {
        url: `${this.origin}/boards/${file}`,
        handle: void 0,
      });
    }
  }

  createGraphURL(location: string, fileName: string) {
    return this.createURL(location, fileName);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canProvide = url.origin === this.origin;
    return canProvide
      ? {
          load: canProvide,
          save: canProvide,
          delete: canProvide,
        }
      : false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: false,
      disconnect: false,
      refresh: true,
      watch: false,
    };
  }

  watch() {
    throw new Error("Watch not implemented for RemoteProvider");
  }
}
