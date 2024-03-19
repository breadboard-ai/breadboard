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
import { BLANK_BOARD } from "./blank-board";

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
  removeEntry(name: string, options?: { recursive: boolean }): Promise<void>;
  getFileHandle(
    name: string,
    options?: { create: boolean }
  ): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  kind: "file";
  name: string;
  isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  remove(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode: string;
    }): Promise<FileSystemDirectoryHandle>;

    showSaveFilePicker(options?: {
      excludeAcceptAllOptions?: boolean;
      id?: string;
      startIn?: FileSystemHandle | string;
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }): Promise<FileSystemFileHandle>;
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
      title: string;
      items: Map<string, { url: string; handle: FileSystemFileHandle }>;
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

  async #refreshAllItems() {
    this.#items.clear();

    for (const [name, handle] of this.#locations) {
      const permission = await handle.queryPermission();

      let files = this.#items.get(name);
      if (!files) {
        files = {
          permission,
          items: new Map(),
          title: handle.name,
        };
        this.#items.set(name, files);
      }

      if (permission !== "granted") {
        continue;
      }

      files.items = await this.#getFiles(handle);
    }
  }

  async #refreshItems(location: string): Promise<boolean> {
    const handle = this.#locations.get(location);
    if (!handle) {
      return false;
    }

    const permission = await handle.queryPermission();
    if (permission !== "granted") {
      return false;
    }

    let files = this.#items.get(location);
    if (!files) {
      files = {
        permission,
        items: new Map(),
        title: handle.name,
      };
      this.#items.set(location, files);
    }

    files.items = await this.#getFiles(handle);
    return true;
  }

  async #getFiles(
    handle: FileSystemDirectoryHandle
  ): Promise<Map<string, { url: string; handle: FileSystemFileHandle }>> {
    const entries: [string, { url: string; handle: FileSystemFileHandle }][] =
      [];

    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "directory") {
        continue;
      }

      if (!entry.name.endsWith("json")) {
        continue;
      }

      entries.push([
        name,
        {
          url: createFileSystemURL(
            encodeURIComponent(handle.name.toLocaleLowerCase()),
            encodeURIComponent(entry.name.toLocaleLowerCase())
          ),
          handle: entry,
        },
      ]);
    }

    return new Map(entries.sort());
  }

  async renewAccessRequest(location: string) {
    const handle = this.#locations.get(location);
    if (!handle) {
      return;
    }

    await handle.requestPermission();
    return this.#refreshAllItems();
  }

  async disconnect(location: string) {
    this.#locations.delete(location);
    await this.#storeLocations();
    return this.#refreshAllItems();
  }

  async deleteFile(
    location: string,
    fileName: string
  ): Promise<{ result: boolean; error?: string }> {
    const fileLocation = this.#locations.get(location);
    if (!fileLocation) {
      return { result: false, error: "Unable to locate file" };
    }

    try {
      await fileLocation.removeEntry(fileName);
    } catch (err) {
      return { result: false, error: "Unable to locate file" };
    }

    await this.#refreshAllItems();
    return { result: true };
  }

  async refresh(location: string): Promise<boolean> {
    return this.#refreshItems(location);
  }

  async createBlankBoard(
    location: string,
    fileName: string
  ): Promise<{ result: boolean; error?: string }> {
    const handle = this.#locations.get(location);
    if (!handle) {
      return { result: false, error: "Unable to find directory" };
    }

    for await (const [, entry] of handle.entries()) {
      if (entry.name !== fileName) {
        continue;
      }

      return { result: false, error: "File already exists" };
    }

    // Now create the file.
    await handle.getFileHandle(fileName, { create: true });
    await this.#refreshItems(location);

    // Now populate it.
    const url = new URL(createFileSystemURL(location, fileName));
    await this.saveBoardFile(url, BLANK_BOARD);
    return { result: true };
  }

  async restoreAndValidateHandles() {
    const locations = await KeyVal.get(KEY);
    if (!locations) {
      return;
    }

    this.#locations = locations;
    return this.#refreshAllItems();
  }

  createGraphURL(location: string, fileName: string) {
    return createFileSystemURL(location, fileName);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canLoad =
      url.protocol === FILE_SYSTEM_PROTOCOL &&
      url.host.startsWith(FILE_SYSTEM_HOST_PREFIX);
    return { load: canLoad, save: true };
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

    const file = fileLocation.items.get(fileName);
    if (!file) {
      return null;
    }

    const { handle } = file;
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

  async saveBoardFile(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    if (url.protocol !== FILE_SYSTEM_PROTOCOL) {
      return this.#saveNewBoardFile(descriptor);
    }

    return this.#saveExistingBoardFile(url, descriptor);
  }

  async #saveNewBoardFile(descriptor: GraphDescriptor) {
    try {
      const handle = await window.showSaveFilePicker({
        types: [
          {
            description: "BGL Files",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const stream = await handle.createWritable();
      const data = structuredClone(descriptor);
      delete data["url"];

      await stream.write(JSON.stringify(data, null, 2));
      await stream.close();

      await this.#refreshAllItems();
      const response: { result: boolean; url?: string } = { result: true };
      search: for (const { items } of this.#items.values()) {
        for (const entry of items.values()) {
          const sameFile = await entry.handle.isSameEntry(handle);
          if (!sameFile) {
            continue;
          }

          response.url = entry.url;
          break search;
        }
      }

      return response;
    } catch (err) {
      console.error(err);
      return { result: false };
    }
  }

  async #saveExistingBoardFile(url: URL, descriptor: GraphDescriptor) {
    const { location, fileName } = parseFileSystemURL(url);
    const items = this.items();
    const fileLocation = items.get(location);
    if (!fileLocation) {
      return { result: false };
    }

    const file = fileLocation.items.get(fileName);
    if (!file) {
      return { result: false };
    }

    try {
      const { handle } = file;
      const stream = await handle.createWritable();
      const data = structuredClone(descriptor);
      delete data["url"];

      await stream.write(JSON.stringify(data, null, 2));
      await stream.close();
      return { result: true };
    } catch (err) {
      console.error(err);
      return { result: false };
    }
  }

  async request(type: keyof BreadboardUI.Types.BoardStorageSupported) {
    switch (type) {
      case "fileSystem": {
        try {
          const handle = await window.showDirectoryPicker({
            mode: "readwrite",
          });
          this.#locations.set(
            encodeURIComponent(handle.name.toLocaleLowerCase()),
            handle
          );
          await this.#storeLocations();
          await this.#refreshAllItems();
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
