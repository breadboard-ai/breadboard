/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  BackendAtomicOperations,
  BackendTransaction,
  BackendTransactionResult,
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  Outcome,
  PersistentBackend,
} from "@google-labs/breadboard";

import { openDB, DBSchema, IDBPDatabase } from "idb";

export { IDBBackend };

// TODO: Find a better place for these.

function err($error: string) {
  return { $error };
}

const FILES_DB = "files";

type FileKey = [graphUrl: string, path: string];

interface Files extends DBSchema {
  files: {
    key: FileKey;
    value: {
      graphUrl: string;
      path: string;
      data: LLMContent[];
      timestamp: number;
    };
    indexes: {
      byGraph: string;
    };
  };
}

class IDBBackend implements PersistentBackend {
  #db: Promise<IDBPDatabase<Files>>;
  #graphUrl: string;
  #ops: BackendAtomicOperations;

  constructor(graphUrl: string) {
    this.#graphUrl = graphUrl;
    this.#db = this.initialize();
    this.#ops = {
      query: this.query.bind(this),
      read: this.read.bind(this),
      append: this.append.bind(this),
      delete: this.delete.bind(this),
      copy: this.copy.bind(this),
      write: this.write.bind(this),
    };
  }

  /**
   *
   * @param url -- the URL of the graph associated
   */
  async initialize() {
    return openDB<Files>(FILES_DB, 1, {
      upgrade(db) {
        const store = db.createObjectStore("files", {
          keyPath: ["graphUrl", "path"],
        });
        store.createIndex(`byGraph`, `graphUrl`);
      },
    });
  }

  #key(path: FileSystemPath): FileKey {
    return [this.#graphUrl, path];
  }

  #startsWith(path: FileSystemPath) {
    return IDBKeyRange.bound(
      [this.#graphUrl, path],
      [this.#graphUrl, path + "\uffff"]
    );
  }

  async query(path: FileSystemPath): Promise<FileSystemQueryResult> {
    const db = await this.#db;
    try {
      const entries = (await db.getAll("files", this.#startsWith(path))).map(
        (entry) => ({
          stream: false,
          path: entry.path as FileSystemPath,
          length: entry.data.length - 1,
        })
      );
      return { entries };
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async read(path: FileSystemPath): Promise<Outcome<LLMContent[]>> {
    try {
      const db = await this.#db;
      const result = await db.get("files", this.#key(path));

      if (!result) {
        return err(`File "${path}" not found.`);
      }
      return result.data;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async write(
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      await db.put("files", {
        graphUrl: this.#graphUrl,
        path,
        data,
        timestamp: Date.now(),
      });
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async append(
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      const tx = db.transaction("files", "readwrite");
      const files = tx.objectStore("files");

      const existing = await files.get(this.#key(path));

      data = existing ? [...existing.data, ...data] : data;

      await files.put({
        graphUrl: this.#graphUrl,
        path,
        data,
        timestamp: Date.now(),
      });

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async delete(
    path: FileSystemPath,
    all: boolean
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      await db.delete(
        "files",
        all ? this.#startsWith(path) : [this.#graphUrl, path]
      );
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async copy(
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      const tx = db.transaction("files", "readwrite");

      const files = tx.objectStore("files");

      const sourceContents = await files.get(this.#key(source));
      if (!sourceContents) {
        return err(`Source file "${source}" not found.`);
      }

      await files.put({
        graphUrl: this.#graphUrl,
        path: destination,
        data: sourceContents.data,
        timestamp: Date.now(),
      });

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async transaction(
    handler: (tx: BackendTransaction) => BackendTransactionResult
  ): BackendTransactionResult {
    try {
      const db = await this.#db;
      const tx = db.transaction("files", "readwrite");

      const result = await handler(this.#ops);

      await tx.done;
      return result;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async clear(): Promise<void> {
    const db = await this.#db;
    await db.clear("files");
  }
}
