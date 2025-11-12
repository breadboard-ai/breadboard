/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryResult,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { openDB, DBSchema } from "idb";

export type FileSystemWalkerEntry =
  | FileSystemDirectoryHandle
  | FileSystemFileHandle;

interface _FileSystemDirectoryHandle {
  readonly kind: "directory";
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
  getDirectoryHandle(
    name: string,
    options?: { create: boolean }
  ): Promise<FileSystemDirectoryHandle>;
}

export { type _FileSystemDirectoryHandle };

declare global {
  interface FileSystemWalker {
    [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemWalkerEntry]>;
  }

  interface FileSystemFileHandle {
    readonly kind: "file";
    name: string;
    isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
    remove(): Promise<void>;
  }

  // Augmented interface to the default one in TypeScript. This one accounts for
  // the API added by Chrome.
  interface FileSystemDirectoryHandle extends _FileSystemDirectoryHandle {
    readonly kind: "directory";
  }

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

const HANDLES_DB = "evalfilesystemhandles";

type Mode = "read";

type HandleKey = [path: FileSystemPath];

export type FileSystemEvalBackendHandle = {
  handle: FileSystemDirectoryHandle;
  path: FileSystemPath;
  title: string;
};

interface Handles extends DBSchema {
  handles: {
    key: HandleKey;
    value: FileSystemEvalBackendHandle;
    indexes: {
      byPath: string;
    };
  };
}

export class FileSystemEvalBackend {
  async #db() {
    return openDB<Handles>(HANDLES_DB, 1, {
      upgrade(db) {
        const handles = db.createObjectStore("handles", {
          keyPath: ["path"],
        });
        handles.createIndex(`byPath`, `path`);
      },
    });
  }

  #getKey(path: FileSystemPath, retainFullPath = false): HandleKey {
    if (retainFullPath) {
      return [path];
    }

    return [this.#getDirName(path)];
  }

  #getDirName(path: FileSystemPath): FileSystemPath {
    return path.split("/").with(-1, "").join("/") as FileSystemPath;
  }

  #getFullFilePath(path: FileSystemPath, name: string): FileSystemPath {
    return `${this.#getDirName(path)}${name}` as FileSystemPath;
  }

  async #createHandle(
    path: FileSystemPath,
    mode: Mode
  ): Promise<Outcome<FileSystemEvalBackendHandle>> {
    try {
      const handle = await window.showDirectoryPicker({
        mode,
      });

      const title = handle.name;

      if (handle) {
        const handlesDb = await this.#db();
        handlesDb.put("handles", { handle, path, title });
        handlesDb.close();
      }

      return { handle, path, title };
    } catch (e) {
      console.warn(e);
      return err((e as Error).message);
    }
  }

  async #obtainHandle(key: HandleKey, mode: Mode, createIfNeeded = true) {
    // 1. Get the handle from the database.
    const handlesDb = await this.#db();
    let handle = await handlesDb.get("handles", key);
    handlesDb.close();

    if (!createIfNeeded) {
      return handle?.handle ?? null;
    }

    // 2. If the handle doesn't exist, create it.
    if (!handle) {
      const creatingHandle = await this.#createHandle(key[0], mode);
      if (!ok(creatingHandle)) return null;

      handle = creatingHandle;
    }

    // 3. Check the permission on the handle.
    const permission = await handle.handle.queryPermission({ mode });
    if (permission !== "granted") {
      return permission;
      // 4. Renew the permission if needed.
      // permission = await handle.handle.requestPermission({ mode });
    }

    // 5. Return the handle.
    return handle.handle;
  }

  async #obtainDirHandle(
    path: FileSystemPath,
    mode: Mode,
    createIfNeeded = true
  ): Promise<FileSystemDirectoryHandle | null | "prompt"> {
    const key = this.#getKey(path, true);
    return this.#obtainHandle(key, mode, createIfNeeded);
  }

  async #obtainFileDirHandle(
    path: FileSystemPath,
    mode: Mode,
    createIfNeeded = true
  ): Promise<FileSystemDirectoryHandle | null | "prompt"> {
    const key = this.#getKey(path, false);
    return this.#obtainHandle(key, mode, createIfNeeded);
  }

  async getAll(): Promise<FileSystemEvalBackendHandle[]> {
    const db = await this.#db();
    const all = db.getAll("handles");
    db.close();
    return all;
  }

  async refreshAccess(path: FileSystemPath): Promise<Outcome<boolean>> {
    const key = this.#getKey(path, false);
    const handlesDb = await this.#db();
    const handle = await handlesDb.get("handles", key);
    handlesDb.close();

    if (!handle) {
      return { $error: "No handle found" };
    }

    const mode = "read";
    let permission = await handle.handle.queryPermission({ mode });
    if (permission === "granted") return true;

    permission = await handle.handle.requestPermission({ mode });
    return permission === "granted";
  }

  async query(path: FileSystemPath): Promise<FileSystemQueryResult> {
    const handle = await this.#obtainDirHandle(path, "read");
    if (!handle) {
      return { $error: "Permission to read from directory was refused" };
    }
    if (handle === "prompt") {
      return { $error: "prompt" };
    }

    try {
      const queryEntries: FileSystemQueryResult = { entries: [] };
      for await (const [name] of handle.entries()) {
        if (!name.endsWith(".json")) {
          continue;
        }

        const fullPath = this.#getFullFilePath(path, name);
        queryEntries.entries.push({
          stream: false,
          path: fullPath,
          length: 1,
        });
      }

      return queryEntries;
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }
  }

  async read(path: FileSystemPath): Promise<Outcome<string>> {
    const handle = await this.#obtainFileDirHandle(path, "read", false);
    if (!handle) {
      return { $error: "Permission to read from directory was refused" };
    }
    if (handle === "prompt") {
      return { $error: "prompt" };
    }

    try {
      for await (const [id, descriptor] of handle.entries()) {
        if (!path.endsWith(id)) {
          continue;
        }

        // Found the file.
        const fileDescriptor = descriptor as FileSystemFileHandle;
        const fileBlob = await fileDescriptor.getFile();
        return await fileBlob.text();
      }
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }

    return { $error: `Unable to read file in directory: ${path}` };
  }
}
