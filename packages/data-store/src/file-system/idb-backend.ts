/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, UUID } from "@breadboard-ai/types";
import {
  asBase64,
  asBlob,
  BackendAtomicOperations,
  BackendTransaction,
  BackendTransactionResult,
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  Outcome,
  PersistentBackend,
  transformBlobs,
} from "@google-labs/breadboard";

import { openDB, DBSchema, IDBPDatabase } from "idb";

export { IDBBackend, createEphemeralBlobStore, type Files };

const FILES_DB = "files";

type FileKey = [graphUrl: string, path: FileSystemPath];

type BlobHandle = `files:${UUID}`;

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
    key: [BlobHandle, FileSystemPath];
    value: {
      handle: BlobHandle;
      path: FileSystemPath;
    };
    indexes: {
      byPath: FileSystemPath;
      byHandle: BlobHandle;
    };
  };
  blobs: {
    key: BlobHandle;
    value: {
      handle: BlobHandle;
      blob: Blob;
    };
  };
}

type EphemeralBlobHandle = string;
type EphemeralBlobs = {
  byEphemeralHandle(handle: EphemeralBlobHandle): BlobHandle | undefined;
  byBlobHandle(handle: BlobHandle): string | undefined;
  add(blob: Blob, handle: BlobHandle): EphemeralBlobHandle;
  size: number;
};

class IDBBackend implements PersistentBackend {
  #db: Promise<IDBPDatabase<Files>>;
  #graphUrl: string;
  #ops: BackendAtomicOperations;
  #ephemeralBlobs: EphemeralBlobs;

  constructor(graphUrl: string, ephemeralBlobs: EphemeralBlobs) {
    this.#ephemeralBlobs = ephemeralBlobs;
    this.#graphUrl = graphUrl;
    this.#db = this.initialize();
    this.#ops = {
      query: this.query.bind(this),
      read: this.read.bind(this),
      append: this.append.bind(this),
      delete: this.delete.bind(this),
      copy: this.copy.bind(this),
      move: this.move.bind(this),
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

  #key(path: FileSystemPath): FileKey {
    return [this.#graphUrl, path];
  }

  #startsWith(path: FileSystemPath) {
    return IDBKeyRange.bound(
      [this.#graphUrl, path],
      [this.#graphUrl, path + "\uffff"]
    );
  }

  #newBlobHandle(): BlobHandle {
    return `files:${crypto.randomUUID()}`;
  }

  async #write(
    path: FileSystemPath,
    data: LLMContent[],
    append: boolean
  ): Promise<FileSystemWriteResult> {
    try {
      const newBlobs: Map<BlobHandle, Blob> = new Map();
      const newRefs: Set<BlobHandle> = new Set();

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
            const blobId = this.#newBlobHandle();
            this.#ephemeralBlobs.add(blob, blobId);
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
        const existing = await files.get(this.#key(path));
        deflated = existing ? [...existing.data, ...deflated] : deflated;
      }

      await files.put({
        graphUrl: this.#graphUrl,
        path,
        data: deflated,
        timestamp,
      });

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
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

  async read(
    path: FileSystemPath,
    inflate: boolean
  ): Promise<Outcome<LLMContent[]>> {
    try {
      const db = await this.#db;
      const tx = db.transaction(["files", "blobs"], "readonly");
      const files = tx.objectStore("files");
      const blobs = tx.objectStore("blobs");

      const result = await files.get(this.#key(path));

      if (!result) {
        return err(`File "${path}" not found.`);
      }
      return await transformBlobs(path, result.data, [
        {
          transform: async (path, part) => {
            if ("storedData" in part) {
              const handle = part.storedData.handle as BlobHandle;
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
                  this.#ephemeralBlobs.byBlobHandle(handle);
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
                  const ephemeralHandle = this.#ephemeralBlobs.add(
                    blob.blob,
                    handle
                  );
                  return {
                    storedData: {
                      handle: ephemeralHandle,
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
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return this.#write(path, data, false);
  }

  async append(
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    return this.#write(path, data, true);
  }

  async delete(
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
        const querying = await files.getAllKeys(this.#startsWith(path));
        list = querying.map((entry) => entry[1]);
      } else {
        list = [path];
      }

      // 2) Get the list of affected blobs
      const affectedBlobs: Set<BlobHandle> = new Set();
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
      await files.delete(all ? this.#startsWith(path) : [this.#graphUrl, path]);

      await tx.done;
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

  async move(
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

      // 5) Delete source
      await files.delete(this.#key(source));

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

      if (!ok(result)) {
        tx.abort();
        return result;
      }

      await tx.done;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async close(): Promise<void> {
    (await this.#db).close();
  }
}

class EphemeralBlobsImpl implements EphemeralBlobs {
  #byBlobHandle: Map<BlobHandle, EphemeralBlobHandle> = new Map();
  #byEphemeralHandle: Map<EphemeralBlobHandle, BlobHandle> = new Map();

  byEphemeralHandle(handle: EphemeralBlobHandle): BlobHandle | undefined {
    return this.#byEphemeralHandle.get(handle);
  }
  byBlobHandle(handle: BlobHandle): string | undefined {
    return this.#byBlobHandle.get(handle);
  }
  add(blob: Blob, handle: BlobHandle): EphemeralBlobHandle {
    const ephemeralHandle = URL.createObjectURL(blob);
    this.#byBlobHandle.set(handle, ephemeralHandle);
    this.#byEphemeralHandle.set(ephemeralHandle, handle);
    return ephemeralHandle;
  }
  get size() {
    return this.#byBlobHandle.size;
  }
}

function createEphemeralBlobStore(): EphemeralBlobs {
  return new EphemeralBlobsImpl();
}

// TODO: Find a better place for these.

function err($error: string) {
  return { $error };
}

function ok<T>(o: Outcome<T>): o is T {
  return !(o && typeof o === "object" && "$error" in o);
}
