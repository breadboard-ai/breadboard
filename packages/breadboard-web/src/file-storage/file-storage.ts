/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as KeyVal from "idb-keyval";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
} from "@google-labs/breadboard";

type FileSystemWalkerEntry = FileSystemDirectoryHandle | FileSystemFileHandle;

interface FileSystemWalker {
  [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemWalkerEntry]>;
}

interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): FileSystemWalker;
  queryPermission(): Promise<"prompt" | "granted">;
  requestPermission(): Promise<"prompt" | "granted">;
}

interface FileSystemFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

const KEY = `bb-storage-locations`;
const FILE_SYSTEM_PROTOCOL = "file:";
const FILE_SYSTEM_HOST_PREFIX = "fsapi";

const createFileSystemURL = (location: string, fileName: string) => {
  return `${FILE_SYSTEM_PROTOCOL}//${FILE_SYSTEM_HOST_PREFIX}~${location}/${fileName}`;
};

const parseFileSystemURL = (url: URL) => {
  if (url.protocol !== FILE_SYSTEM_PROTOCOL) {
    throw new Error("Unsupported protocol");
  }
  const fileName = url.pathname?.substring(1);
  const [prefix, location] = url.host.split("~");
  if (prefix !== "fsapi") {
    throw new Error("Unsupported protocol");
  }
  if (!location || !fileName) {
    throw new Error("Invalid path");
  }

  return { location, fileName };
};

export class FileStorage implements GraphProvider {
  static #instance: FileStorage;
  static instance() {
    if (!this.#instance) {
      this.#instance = new FileStorage();
    }
    return this.#instance;
  }

  #items = new Map<
    string,
    {
      permission: "unknown" | "prompt" | "granted";
      items: Map<string, FileSystemFileHandle>;
    }
  >();
  #locations = new Map<string, FileSystemDirectoryHandle>();

  private constructor() {}

  #storeLocations() {
    KeyVal.set(KEY, this.#locations);
  }

  getSupported(): BreadboardUI.Types.BoardStorageSupported {
    return {
      fileSystem: "showDirectoryPicker" in window,
    };
  }

  items() {
    return this.#items;
  }

  async #refreshItems(location: string | null = null) {
    this.#items.clear();
    for (const [name, handle] of this.#locations) {
      if (location !== null && name !== location) {
        continue;
      }

      const permission = await handle.queryPermission();

      let files = this.#items.get(name);
      if (!files) {
        files = { permission, items: new Map() };
        this.#items.set(name, files);
      }

      if (permission !== "granted") {
        continue;
      }

      const entries: [string, FileSystemFileHandle][] = [];

      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === "directory") {
          continue;
        }

        if (!entry.name.endsWith("json")) {
          continue;
        }

        entries.push([name, entry]);
      }

      files.items = new Map(entries.sort());
    }
  }

  async renewAccessRequest(location: string) {
    const handle = this.#locations.get(location);
    if (!handle) {
      return;
    }

    await handle.requestPermission();
    return this.#refreshItems();
  }

  async disconnect(location: string) {
    this.#locations.delete(location);
    await this.#storeLocations();
    return this.#refreshItems();
  }

  async refresh(location: string) {
    return this.#refreshItems(location);
  }

  async restoreAndValidateHandles() {
    const locations = await KeyVal.get(KEY);
    if (!locations) {
      return;
    }

    this.#locations = locations;
    return this.#refreshItems();
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canLoad =
      url.protocol === FILE_SYSTEM_PROTOCOL &&
      url.host.startsWith(FILE_SYSTEM_HOST_PREFIX);
    return canLoad ? { load: true, save: false } : false;
  }

  async load(url: URL) {
    const { location, fileName } = parseFileSystemURL(url);
    return this.getBoardFile(location, fileName);
  }

  async getBoardFile(location: string, fileName: string) {
    const items = this.items();

    const fileLocation = items.get(location);
    if (!fileLocation) {
      return null;
    }

    const handle = fileLocation.items.get(fileName);
    if (!handle) {
      return null;
    }

    const data = await handle.getFile();
    const boardDataAsText = await data.text();
    try {
      const descriptor = JSON.parse(boardDataAsText) as GraphDescriptor;
      descriptor.url = createFileSystemURL(location, fileName);
      return descriptor;
    } catch (err) {
      // Bad data.
      console.error(err);
    }
    return null;
  }

  async request(type: keyof BreadboardUI.Types.BoardStorageSupported) {
    switch (type) {
      case "fileSystem": {
        try {
          const handle = await window.showDirectoryPicker();
          this.#locations.set(handle.name, handle);
          await this.#storeLocations();
          await this.#refreshItems();
        } catch (err) {
          // User cancelled the action.
        }

        return true;
      }

      default: {
        console.warn("Unsupported storage");
        break;
      }
    }

    return false;
  }
}
