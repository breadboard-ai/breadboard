/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { openDB, DBSchema } from "idb";
import { RunNotes } from "./types.js";
import {
  buildFileHierarchy,
  GroupedByType,
  ParsedFileMedata,
  parseFileName,
} from "./parse-file-name.js";


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

type Mode = "read" | "readwrite";

type HandleKey = [path: string];

export type FileSystemEvalBackendHandle = {
  handle: FileSystemDirectoryHandle;
  path: string;
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

  #getKey(path: string, retainFullPath = false): HandleKey {
    if (retainFullPath) {
      return [path];
    }

    return [this.#getDirName(path)];
  }

  #getDirName(path: string): string {
    return path.split("/").with(-1, "").join("/");
  }

  #getFullFilePath(path: string, name: string): string {
    return `${this.#getDirName(path)}${name}`;
  }

  async #createHandle(
    path: string,
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

    if (!createIfNeeded && !handle) {
      return null;
    }

    // 2. If the handle doesn't exist, create it.
    if (!handle) {
      const creatingHandle = await this.#createHandle(key[0], mode);
      if (!ok(creatingHandle)) return null;

      handle = creatingHandle;
    }

    // 3. Check the permission on the handle.
    let permission = await handle.handle.queryPermission({ mode });
    if (permission !== "granted") {
      if (mode === "readwrite") {
        // Try to request permission for readwrite.
        permission = await handle.handle.requestPermission({ mode });
      }
      if (permission !== "granted") {
        return permission;
      }
    }

    // 5. Return the handle.
    return handle.handle;
  }

  async #obtainDirHandle(
    path: string,
    mode: Mode,
    createIfNeeded = true
  ): Promise<FileSystemDirectoryHandle | null | "prompt"> {
    const key = this.#getKey(path, true);
    return this.#obtainHandle(key, mode, createIfNeeded);
  }

  async #obtainFileDirHandle(
    path: string,
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

  async refreshAccess(path: string): Promise<Outcome<boolean>> {
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

  async query(path: string): Promise<Outcome<GroupedByType[]>> {
    const handle = await this.#obtainDirHandle(path, "read");
    if (!handle) {
      return { $error: "Permission to read from directory was refused" };
    }
    if (handle === "prompt") {
      return { $error: "prompt" };
    }

    try {
      const queryEntries: ParsedFileMedata[] = [];
      const raterMap = new Map<string, string>();
      const ratingScoreMap = new Map<string, number>();
      const notesCountMap = new Map<string, number>();
      const bglTitleMap = new Map<string, string>();
      const transcriptMap = new Set<string>();

      try {
        for await (const [name, descriptor] of handle.entries()) {
          if (name.endsWith(".rater.json") && descriptor.kind === "file") {
            try {
              const fileBlob = await (descriptor as FileSystemFileHandle).getFile();
              const text = await fileBlob.text();
              const parsed = JSON.parse(text);
              const judgement = parsed?.overall_judgement || (parsed?.error ? 'FAIL' : 'UNKNOWN');
              const score = parsed?.dimensions?.intent_fulfillment?.score;
              const baseName = name.replace(/\.rater\.json$/, "");
              raterMap.set(baseName, judgement);
              if (typeof score === 'number') {
                ratingScoreMap.set(baseName, score);
              }
            } catch {
              // Ignore failure.
            }
          }
          if (name.endsWith(".bgl.json") && descriptor.kind === "file") {
            try {
              const fileBlob = await (descriptor as FileSystemFileHandle).getFile();
              const text = await fileBlob.text();
              const parsed = JSON.parse(text);
              const title = parsed?.title || "";
              const baseName = name.replace(/\.bgl\.json$/, "");
              bglTitleMap.set(baseName, title);
            } catch {
              // Ignore failure.
            }
          }
          if (name.endsWith(".transcript.jsonl") && descriptor.kind === "file") {
            const baseName = name.replace(/\.transcript\.jsonl$/, "");
            transcriptMap.add(baseName);
          }
          if (name.endsWith(".notes.json") && descriptor.kind === "file") {
            try {
              const fileBlob = await (descriptor as FileSystemFileHandle).getFile();
              const text = await fileBlob.text();
              const parsed = JSON.parse(text) as RunNotes;
              const count = Array.isArray(parsed?.notes) ? parsed.notes.length : 0;
              const baseName = name.replace(/\.notes\.json$/, "");
              notesCountMap.set(baseName, count);
            } catch {
              // Ignore failure.
            }
          }
        }
      } catch {
        // Ignore listing failure.
      }

      for await (const [name] of handle.entries()) {
        if (!name.endsWith(".log.json")) {
          continue;
        }

        const fullPath = this.#getFullFilePath(path, name);
        const parsed = parseFileName(fullPath);
        if (parsed) {
          const baseName = name.replace(/\.log\.json$/, "");
          parsed.judgement = raterMap.get(baseName);
          parsed.rating = ratingScoreMap.get(baseName) || parsed.judgement;
          parsed.noteCount = notesCountMap.get(baseName) || 0;
          parsed.title = bglTitleMap.get(baseName);
          parsed.hasSidecars = bglTitleMap.has(baseName) || raterMap.has(baseName) || notesCountMap.has(baseName) || transcriptMap.has(baseName);
          queryEntries.push(parsed);
        }
      }

      return buildFileHierarchy(queryEntries);
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }
  }

  async read(path: string): Promise<Outcome<string>> {
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

  async write(path: string, content: string): Promise<Outcome<boolean>> {
    const handle = await this.#obtainFileDirHandle(path, "readwrite", true);
    if (!handle) {
      return { $error: "Permission to write to directory was refused" };
    }
    if (handle === "prompt") {
      return { $error: "prompt" };
    }

    try {
      const fileName = path.split("/").at(-1);
      if (!fileName) {
        return { $error: "Invalid file path" };
      }

      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to write file in directory: ${path}` };
    }
  }

  async readNotes(logPath: string): Promise<Outcome<RunNotes>> {
    const notesPath = logPath.replace(/\.log\.json$/, ".notes.json");
    const result = await this.read(notesPath);
    if (!ok(result)) {
      // If file not found, return empty notes instead of error, or handle error accordingly.
      // For now, let's assume empty notes if error.
      return { notes: [] };
    }
    try {
      return JSON.parse(result) as RunNotes;
    } catch {
      return { notes: [] };
    }
  }

  async writeNotes(logPath: string, notes: RunNotes): Promise<Outcome<boolean>> {
    const notesPath = logPath.replace(/\.log\.json$/, ".notes.json");
    return this.write(notesPath, JSON.stringify(notes, null, 2));
  }
}

