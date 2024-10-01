/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import {
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderStore,
} from "./types.js";

export const loadFromFile = async (path: string) => {
  if (typeof globalThis.process === "undefined")
    throw new Error("Unable to use `path` when not running in node");
  let readFileFn;
  // The CJS transpilation process for node/vscode seems to miss this import,
  // and leaves it as an import statement rather than converting it to a
  // require. We therefore need a runtime check that prefers `require` if it
  // is available.
  if (typeof require === "function") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFile } = require("node:fs/promises");
    readFileFn = readFile;
  } else {
    const { readFile } = await import(/* vite-ignore */ "node:fs/promises");
    readFileFn = readFile;
  }

  return JSON.parse(await readFileFn(path, "utf-8"));
};

export const loadWithFetch = async (url: string | URL) => {
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    // Try again with credentials.
    // This is useful for sites that require authentication.
    // We also don't want this to be the default behavior, because some sites
    // like Github have * CORS headers, which will make this request fail.
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSNotSupportingCredentials
    response = await fetch(url, { credentials: "include" });
  }
  return await response?.json();
};

export class DefaultGraphProvider implements GraphProvider {
  name = "DefaultGraphProvider";

  #ready = Promise.resolve();
  ready() {
    return this.#ready;
  }

  isSupported(): boolean {
    return true;
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

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (url.protocol === "http:" || url.protocol === "https:") {
      return {
        load: true,
        save: false,
        delete: false,
      };
    }
    if (url.protocol === "file:" && url.hostname === "") {
      return {
        load: true,
        save: false,
        delete: false,
      };
    }
    return false;
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    if (url.protocol === "file:") {
      const path = decodeURIComponent(url.pathname);
      return loadFromFile(path);
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return loadWithFetch(url.href);
    }
    return null;
  }

  async save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Save not implemented for DefaultGraphProvider");
  }

  async delete(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Delete not implemented for DefaultGraphProvider");
  }

  async connect(_location?: string): Promise<boolean> {
    throw new Error("Connect not implemented for DefaultGraphProvider");
  }

  async disconnect(_location: string): Promise<boolean> {
    throw new Error("Disconnect not implemented for DefaultGraphProvider");
  }

  async refresh(_location: string): Promise<boolean> {
    throw new Error("Refresh not implemented for DefaultGraphProvider");
  }

  async createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Create Blank not implemented for DefaultGraphProvider");
  }

  async preview(_url: URL): Promise<URL> {
    throw new Error("Create Blank not implemented for DefaultGraphProvider");
  }

  async create(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error("Create not implemented for DefaultGraphProvider");
  }

  async createURL(_location: string, _fileName: string): Promise<string> {
    throw new Error("createURL not implemented for DefaultGraphProvider");
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error("parseURL not implemented for DefaultGraphProvider");
  }

  async restore() {
    throw new Error("restore is not implemented for DefaultGraphProvider");
  }

  items(): Map<string, GraphProviderStore> {
    throw new Error("items is not implemented for DefaultGraphProvider");
  }

  startingURL(): URL | null {
    return null;
  }

  watch(): void {
    throw new Error("watch is not implemented for DefaultGraphProvider");
  }
}
