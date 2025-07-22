/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { isLLMContentArray, ok } from "@google-labs/breadboard";

import { openDB, DBSchema } from "idb";

const HANDLES_DB = "filesystemhandles";

type Mode = "read" | "readwrite";

type HandleKey = [graphUrl: string, path: FileSystemPath];

interface Handles extends DBSchema {
  handles: {
    key: HandleKey;
    value: {
      graphUrl: string;
      path: FileSystemPath;
      handle: FileSystemDirectoryHandle;
    };
    indexes: {
      byGraph: string;
    };
  };
}

export class FileSystemPersistentBackend implements PersistentBackend {
  async #db() {
    return openDB<Handles>(HANDLES_DB, 1, {
      upgrade(db) {
        const handles = db.createObjectStore("handles", {
          keyPath: ["graphUrl", "path"],
        });
        handles.createIndex(`byGraph`, `graphUrl`);
      },
    });
  }

  #getKey(
    graphUrl: string,
    path: FileSystemPath,
    retainFullPath = false
  ): HandleKey {
    if (retainFullPath) {
      return [graphUrl, path];
    }

    return [graphUrl, this.#getDirName(path)];
  }

  #getDirName(path: FileSystemPath): FileSystemPath {
    return path.split("/").with(-1, "").join("/") as FileSystemPath;
  }

  #getFileName(path: FileSystemPath): string {
    const fileName = path.split("/").at(-1);
    if (!fileName) {
      throw new Error(`Invalid filename ${path}`);
    }

    return fileName;
  }

  #getFullFilePath(path: FileSystemPath, name: string): FileSystemPath {
    return `${this.#getDirName(path)}${name}` as FileSystemPath;
  }

  async #createHandle(graphUrl: string, path: FileSystemPath, mode: Mode) {
    try {
      const handle = await window.showDirectoryPicker({
        mode,
      });

      if (handle) {
        const handlesDb = await this.#db();
        handlesDb.put("handles", { handle, graphUrl, path });
        handlesDb.close();
      }

      return { handle, graphUrl, path };
    } catch (err) {
      console.warn(err);
      return;
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
      handle = await this.#createHandle(key[0], key[1], mode);

      if (!handle) {
        return null;
      }
    }

    // 3. Check the permission on the handle.
    let permission = await handle.handle.queryPermission({ mode });
    if (permission !== "granted") {
      // 4. Renew the permission if needed.
      permission = await handle.handle.requestPermission({ mode });
    }

    // 5. If the permission request failed for any reason, fail here.
    if (!permission) {
      return null;
    }

    // 6. Return the handle.
    return handle.handle;
  }

  async #obtainDirHandle(
    graphUrl: string,
    path: FileSystemPath,
    mode: Mode,
    createIfNeeded = true
  ) {
    const key = this.#getKey(graphUrl, path, true);
    return this.#obtainHandle(key, mode, createIfNeeded);
  }

  async #obtainFileHandle(
    graphUrl: string,
    path: FileSystemPath,
    mode: Mode,
    createIfNeeded = true
  ): Promise<FileSystemDirectoryHandle | null> {
    const key = this.#getKey(graphUrl, path, false);
    return this.#obtainHandle(key, mode, createIfNeeded);
  }

  async #write(graphUrl: string, path: FileSystemPath, data: LLMContent[]) {
    const handle = await this.#obtainFileHandle(graphUrl, path, "readwrite");
    if (!handle) {
      return { $error: "Permission to save to directory was refused" };
    }

    try {
      const fileHandle = await handle.getFileHandle(this.#getFileName(path), {
        create: true,
      });
      const outStream = await fileHandle.createWritable();
      const writer = outStream.getWriter();
      const serializedData = JSON.stringify(data, null, 2);
      await writer.write(serializedData);
      await writer.close();
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }
  }

  async append(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const fileData = await this.read(graphUrl, path, true);
    if (!ok(fileData)) {
      return fileData;
    }

    if (!isLLMContentArray(fileData)) {
      return {
        $error: `Unable to append; file is not correctly formatted: ${path}`,
      };
    }

    fileData.push(...data);
    return this.#write(graphUrl, path, fileData);
  }

  async copy(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const fileData = await this.read(graphUrl, source, false);
    if (!ok(fileData)) {
      return fileData;
    }

    if (!isLLMContentArray(fileData)) {
      return { $error: "Source file contains invalid data" };
    }

    return this.#write(graphUrl, destination, fileData);
  }

  async delete(
    graphUrl: string,
    path: FileSystemPath,
    all = false
  ): Promise<FileSystemWriteResult> {
    if (all) {
      console.warn(
        "All flag is ignored; deleting behaviors are determined by the path provided"
      );
    }

    // Attempt to get the handle as-is, assuming it is a directory handle, but
    // don't attempt to create it if it is missing.
    const dirHandle = await this.#obtainDirHandle(
      graphUrl,
      path,
      "readwrite",
      true
    );

    // If we've found a handle for the directory begin the process of deleting
    // files within that directory. Note that we only delete files in this
    // process.
    if (dirHandle) {
      try {
        for await (const [name, entry] of dirHandle.entries()) {
          if (entry.kind === "directory") {
            continue;
          }

          await dirHandle.removeEntry(name, { recursive: false });
        }
        return;
      } catch (err) {
        console.warn(err);
        return { $error: `Unable to delete directory` };
      }
    }

    // If we fail to find the handle as a directory then we assume that we have
    // been given a file and we obtain a file handle instead.
    const fileHandle = await this.#obtainFileHandle(
      graphUrl,
      path,
      "readwrite",
      false
    );
    if (fileHandle) {
      try {
        const file = await fileHandle.getFileHandle(this.#getFileName(path));
        await file.remove();
        return;
      } catch (err) {
        console.warn(err);
        return { $error: `File does not exist: ${path}` };
      }
    }

    return { $error: `Unable to delete; no matching item found` };
  }

  async move(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const fileData = await this.read(graphUrl, source, false);
    if (!ok(fileData)) {
      return fileData;
    }

    if (!isLLMContentArray(fileData)) {
      return { $error: "Source file contains invalid data" };
    }

    const write = await this.#write(graphUrl, destination, fileData);
    if (!ok(write)) {
      return write;
    }

    return this.delete(graphUrl, source);
  }

  async query(
    graphUrl: string,
    path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    const handle = await this.#obtainDirHandle(graphUrl, path, "read");
    if (!handle) {
      return { $error: "Permission to read from directory was refused" };
    }

    try {
      const queryEntries: FileSystemQueryResult = { entries: [] };
      for await (const [name] of handle.entries()) {
        const fullPath = this.#getFullFilePath(path, name);
        const fileData = await this.read(graphUrl, fullPath, false);
        if (!ok(fileData) || !isLLMContentArray(fileData)) {
          console.warn(`Unable to read file ${fullPath}`);
          continue;
        }

        queryEntries.entries.push({
          stream: false,
          path: fullPath,
          length: fileData.length,
        });
      }

      return queryEntries;
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }
  }

  async read(
    graphUrl: string,
    path: FileSystemPath,
    inflate = false
  ): Promise<Outcome<LLMContent[]>> {
    if (inflate) {
      console.warn("Inflate flag is ignored; data is persisted as-is.");
    }

    const handle = await this.#obtainFileHandle(graphUrl, path, "read");
    if (!handle) {
      return { $error: "Permission to read from directory was refused" };
    }

    try {
      const fileHandle = await handle.getFileHandle(this.#getFileName(path));
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content) as LLMContent[];
    } catch (err) {
      console.warn(err);
      return { $error: `Unable to read file in directory: ${path}` };
    }
  }

  async write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return this.#write(graphUrl, path, data);
  }
}
