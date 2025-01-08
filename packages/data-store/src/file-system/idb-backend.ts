/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  asBase64,
  asBlob,
  EphemeralBlobStore,
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  Outcome,
  PersistentBackend,
  PersistentBlobHandle,
  transformBlobs,
} from "@google-labs/breadboard";

import { openDB, DBSchema, IDBPDatabase } from "idb";

export { IDBBackend, type Files };

const FILES_DB = "files";

type FileKey = [graphUrl: string, path: FileSystemPath];

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
  refs: {
    key: [PersistentBlobHandle, FileSystemPath];
    value: {
      handle: PersistentBlobHandle;
      path: FileSystemPath;
    };
    indexes: {
      byPath: FileSystemPath;
      byHandle: PersistentBlobHandle;
    };
  };
  blobs: {
    key: PersistentBlobHandle;
    value: {
      handle: PersistentBlobHandle;
      blob: Blob;
    };
  };
}

class IDBBackend implements PersistentBackend {
  #db: Promise<IDBPDatabase<Files>>;
  #ephemeralBlobs: EphemeralBlobStore;

  constructor(ephemeralBlobs: EphemeralBlobStore) {
    this.#ephemeralBlobs = ephemeralBlobs;
    this.#db = this.initialize();
  }

  /**
   *
   * @param url -- the URL of the graph associated
   */
  async initialize() {
    return openDB<Files>(FILES_DB, 1, {
      upgrade(db) {
        // 1) Initialize `files` store.
        const files = db.createObjectStore("files", {
          keyPath: ["graphUrl", "path"],
        });
        files.createIndex(`byGraph`, `graphUrl`);

        // 2) Initialize `blobs` store.
        db.createObjectStore("blobs", { keyPath: "handle" });

        // 4) Initialize `refs` store.
        const refs = db.createObjectStore("refs", {
          keyPath: ["handle", "path"],
        });
        refs.createIndex("byPath", "path");
        refs.createIndex("byHandle", "handle");
      },
    });
  }

  #key(graphUrl: string, path: FileSystemPath): FileKey {
    return [graphUrl, path];
  }

  #startsWith(graphUrl: string, path: FileSystemPath) {
    return IDBKeyRange.bound([graphUrl, path], [graphUrl, path + "\uffff"]);
  }

  async #write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[],
    append: boolean
  ): Promise<FileSystemWriteResult> {
    try {
      const newBlobs: Map<PersistentBlobHandle, Blob> = new Map();
      const newRefs: Set<PersistentBlobHandle> = new Set();

      let deflated = await transformBlobs(path, data, [
        {
          transform: async (_, part) => {
            if ("storedData" in part) {
              const ephemeralBlobHandle = part.storedData.handle;
              // If this blob is pointing at a URL, return as is.
              // We interpret a URL handle as "don't manage this as a blob".
              if (ephemeralBlobHandle.startsWith("https://")) {
                return part;
              }
              // If we already have the blob handle stored,
              // increment the ref count and return the part as is.
              const blobHandle =
                this.#ephemeralBlobs.byEphemeralHandle(ephemeralBlobHandle);
              if (blobHandle) {
                newRefs.add(blobHandle);
                return part;
              }
              // Otherwise, fall through to add a new blob.
            }
            const blob = await asBlob(part);
            const { persistent: blobId } = this.#ephemeralBlobs.add(blob);
            newBlobs.set(blobId, blob);
            return {
              storedData: {
                handle: blobId,
                mimeType: blob.type,
              },
            };
          },
        },
      ]);

      if (!ok(deflated)) {
        return deflated;
      }

      const timestamp = Date.now();

      const db = await this.#db;

      const tx = db.transaction(["files", "blobs", "refs"], "readwrite");
      const files = tx.objectStore("files");
      const blobs = tx.objectStore("blobs");
      const refs = tx.objectStore("refs");

      // Store new blobs and add refs
      for (const [handle, blob] of newBlobs.entries()) {
        await blobs.put({ handle, blob });
        await refs.put({ path, handle });
      }

      // Update references for existing blobs
      for (const handle of newRefs.values()) {
        await refs.put({ path, handle });
      }

      if (append) {
        const existing = await files.get(this.#key(graphUrl, path));
        deflated = existing ? [...existing.data, ...deflated] : deflated;
      }

      await files.put({
        graphUrl,
        path,
        data: deflated,
        timestamp,
      });

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async query(
    graphUrl: string,
    path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    const db = await this.#db;
    try {
      const entries = (
        await db.getAll("files", this.#startsWith(graphUrl, path))
      ).map((entry) => ({
        stream: false,
        path: entry.path as FileSystemPath,
        length: entry.data.length,
      }));
      return { entries };
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async read(
    graphUrl: string,
    path: FileSystemPath,
    inflate: boolean
  ): Promise<Outcome<LLMContent[]>> {
    try {
      const db = await this.#db;
      const tx = db.transaction(["files", "blobs"], "readonly");
      const files = tx.objectStore("files");
      const blobs = tx.objectStore("blobs");

      const result = await files.get(this.#key(graphUrl, path));

      if (!result) {
        return err(`File "${path}" not found.`);
      }
      return await transformBlobs(path, result.data, [
        {
          transform: async (path, part) => {
            if ("storedData" in part) {
              const handle = part.storedData.handle as PersistentBlobHandle;
              if (inflate) {
                // Instead of using ephemeral blobs, convert directly to
                // inlineData.
                const blob = await blobs.get(handle);
                if (!blob) {
                  return err(
                    `File System persistent backend integrity error: blob not found for "${path}"`
                  );
                }
                return {
                  inlineData: {
                    data: await asBase64(blob.blob),
                    mimeType: part.storedData.mimeType,
                  },
                };
              } else {
                const ephemeralHandle =
                  this.#ephemeralBlobs.byPersistentHandle(handle);
                if (ephemeralHandle) {
                  // We already have an ephemeral blob, just return that.
                  return {
                    storedData: {
                      handle: ephemeralHandle,
                      mimeType: part.storedData.mimeType,
                    },
                  };
                } else {
                  // Conjure up a new ephemeral blob
                  const blob = await blobs.get(handle);
                  if (!blob) {
                    return err(
                      `File System persistent backend integrity error: blob not found for "${path}"`
                    );
                  }
                  const { ephemeral } = this.#ephemeralBlobs.add(
                    blob.blob,
                    handle
                  );
                  return {
                    storedData: {
                      handle: ephemeral,
                      mimeType: part.storedData.mimeType,
                    },
                  };
                }
              }
            }
            return part;
          },
        },
      ]);
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return this.#write(graphUrl, path, data, false);
  }

  async append(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return this.#write(graphUrl, path, data, true);
  }

  async delete(
    graphUrl: string,
    path: FileSystemPath,
    all: boolean
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;

      const tx = db.transaction(["files", "blobs", "refs"], "readwrite");

      const files = tx.objectStore("files");
      const refs = tx.objectStore("refs");
      const blobs = tx.objectStore("blobs");

      // 1) Get all the paths to be deleted.
      let list: FileSystemPath[];
      if (all) {
        const querying = await files.getAllKeys(
          this.#startsWith(graphUrl, path)
        );
        list = querying.map((entry) => entry[1]);
      } else {
        list = [path];
      }

      // 2) Get the list of affected blobs
      const affectedBlobs: Set<PersistentBlobHandle> = new Set();
      for (const toBeDeleted of list) {
        const index = refs.index("byPath");
        const blobRefs = await index.getAllKeys(toBeDeleted);
        blobRefs.forEach(([handle]) => affectedBlobs.add(handle));
        for (const key of blobRefs) {
          await refs.delete(key);
        }
      }

      // 3) Update ref counts or deleted orphaned blobs.
      for (const handle of affectedBlobs) {
        const refCount = await refs.index("byHandle").count(handle);
        if (refCount == 0) {
          // Delete orphaned blobs and their metadata.
          await blobs.delete(handle);
        }
      }

      // 4) Delete the files themselves.
      await files.delete(
        all ? this.#startsWith(graphUrl, path) : [graphUrl, path]
      );

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async copy(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      const tx = db.transaction(["files", "refs"], "readwrite");

      const files = tx.objectStore("files");
      const refs = tx.objectStore("refs");

      // 1) Get blob handles associated with `source`.
      const sourceHandles = await refs.index("byPath").getAll(source);

      // 2) Associate these blob handles with `destination`
      for (const { handle } of sourceHandles) {
        await refs.put({ handle, path: destination });
      }

      // 3) Copy contents
      const sourceContents = await files.get(this.#key(graphUrl, source));
      if (!sourceContents) {
        return err(`Source file "${source}" not found.`);
      }

      await files.put({
        graphUrl: graphUrl,
        path: destination,
        data: sourceContents.data,
        timestamp: Date.now(),
      });

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async move(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    try {
      const db = await this.#db;
      const tx = db.transaction(["files", "refs"], "readwrite");

      const files = tx.objectStore("files");
      const refs = tx.objectStore("refs");

      // 1) Get blob handles associated with `source`.
      const sourceHandles = await refs.index("byPath").getAll(source);

      // 2) Associate these blob handles with `destination`
      for (const { handle } of sourceHandles) {
        await refs.put({ handle, path: destination });
      }

      // 3) Detele blob handles associated with `source`.
      for (const { handle } of sourceHandles) {
        await refs.delete([handle, source]);
      }

      // 4) Copy contents
      const sourceContents = await files.get(this.#key(graphUrl, source));
      if (!sourceContents) {
        return err(`Source file "${source}" not found.`);
      }

      await files.put({
        graphUrl: graphUrl,
        path: destination,
        data: sourceContents.data,
        timestamp: Date.now(),
      });

      // 5) Delete source
      await files.delete(this.#key(graphUrl, source));

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async close(): Promise<void> {
    const db = await this.#db;
    db.close();
  }
}

// TODO: Find a better place for these.

function err($error: string) {
  return { $error };
}

function ok<T>(o: Outcome<T>): o is T {
  return !(o && typeof o === "object" && "$error" in o);
}
