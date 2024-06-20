/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as KeyVal from "idb-keyval";
import {
  GraphDescriptor,
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderItem,
  blankLLMContent,
} from "@google-labs/breadboard";
import { GraphProviderStore } from "./types";
import { GraphProviderExtendedCapabilities } from "@google-labs/breadboard";

type FileSystemWalkerEntry = FileSystemDirectoryHandle | FileSystemFileHandle;

interface FileSystemWalker {
  [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemWalkerEntry]>;
}

interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): FileSystemWalker;
  queryPermission(options?: {
    mode: "read" | "write" | "readwrite";
  }): Promise<"prompt" | "granted">;
  requestPermission(options?: {
    mode: "read" | "write" | "readwrite";
  }): Promise<"prompt" | "granted">;
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

const FILE_SYSTEM_PROTOCOL = "file:";
const FILE_SYSTEM_HOST_PREFIX = "fsapi";

export class FileSystemGraphProvider implements GraphProvider {
  static #instance: FileSystemGraphProvider;
  static instance() {
    if (!this.#instance) {
      this.#instance = new FileSystemGraphProvider();
    }
    return this.#instance;
  }

  #items: Map<string, GraphProviderStore<FileSystemFileHandle>> = new Map<
    string,
    {
      permission: "unknown" | "prompt" | "granted";
      title: string;
      items: Map<
        string,
        GraphProviderItem & {
          handle: FileSystemFileHandle;
        }
      >;
    }
  >();
  #locations = new Map<string, FileSystemDirectoryHandle>();

  name = "FileSystemGraphProvider";

  private constructor() {}

  async createURL(location: string, fileName: string) {
    return `${FILE_SYSTEM_PROTOCOL}//${FILE_SYSTEM_HOST_PREFIX}~${location}/${fileName}`;
  }

  parseURL(url: URL) {
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
  }

  async load(url: URL) {
    const { location, fileName } = this.parseURL(url);
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
      descriptor.url = await this.createURL(location, fileName);
      return descriptor;
    } catch (err) {
      // Bad data.
      console.error(err);
    }
    return null;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const { location, fileName } = this.parseURL(url);
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

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const { location, fileName } = this.parseURL(url);
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

  async connect() {
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
      return false;
    }

    return true;
  }

  async disconnect(location: string) {
    try {
      this.#locations.delete(location);
      await this.#storeLocations();
      await this.#refreshAllItems();
    } catch (err) {
      return false;
    }
    return true;
  }

  async refresh(location: string): Promise<boolean> {
    return this.#refreshItems(location);
  }

  async #storeLocations() {
    await KeyVal.clear();
    return Promise.all(
      [...this.#locations].map(([key, handle]) => {
        return KeyVal.set(key, handle);
      })
    );
  }

  isSupported(): boolean {
    return "showDirectoryPicker" in window;
  }

  items() {
    return this.#items;
  }

  startingURL() {
    return null;
  }

  async #refreshAllItems() {
    this.#items.clear();

    for (const [name, handle] of this.#locations) {
      try {
        const permission = await handle.queryPermission({ mode: "readwrite" });

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
      } catch (e) {
        console.warn(e, "This is likely a result of directory being moved.");
      }
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

  async #getFiles(handle: FileSystemDirectoryHandle): Promise<
    Map<
      string,
      {
        url: string;
        readonly: boolean;
        mine: boolean;
        handle: FileSystemFileHandle;
      }
    >
  > {
    const entries: [
      string,
      {
        url: string;
        readonly: boolean;
        mine: boolean;
        handle: FileSystemFileHandle;
      },
    ][] = [];

    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "directory") {
        continue;
      }

      if (!entry.name.endsWith("json")) {
        continue;
      }

      entries.push([
        name.toLocaleLowerCase(),
        {
          url: await this.createURL(
            encodeURIComponent(handle.name.toLocaleLowerCase()),
            encodeURIComponent(name.toLocaleLowerCase())
          ),
          readonly: false,
          mine: true,
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

    await handle.requestPermission({ mode: "readwrite" });
    return this.#refreshAllItems();
  }

  async createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    return this.create(url, blankLLMContent());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const { location, fileName } = this.parseURL(url);
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
    await this.save(url, descriptor);
    return { result: true };
  }

  async restore() {
    const keys = await KeyVal.keys();

    // Temporary migration.
    for (const key of keys) {
      if (key === "bb-storage-locations") {
        console.log("Migrating old storage...");
        const locations =
          await KeyVal.get<Map<string, FileSystemDirectoryHandle>>(key);

        if (!locations) {
          break;
        }

        for (const [key, loc] of locations) {
          this.#locations.set(key, loc);
        }
        await KeyVal.del("bb-storage-locations");
        await this.#storeLocations();
        break;
      }
    }

    const entries = await KeyVal.entries<string, FileSystemDirectoryHandle>();
    this.#locations = new Map(entries);
    return this.#refreshAllItems();
  }

  async createGraphURL(location: string, fileName: string) {
    return await this.createURL(location, fileName);
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    const canProvide =
      url.protocol === FILE_SYSTEM_PROTOCOL &&
      url.host.startsWith(FILE_SYSTEM_HOST_PREFIX);
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
      connect: true,
      disconnect: true,
      refresh: true,
      watch: false,
    };
  }

  watch() {
    throw new Error("Watch not implemented for FileSystemGraphProvider");
  }
}
