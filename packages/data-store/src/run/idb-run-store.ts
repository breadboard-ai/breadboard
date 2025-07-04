/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, HarnessRunResult } from "@breadboard-ai/types";
import {
  isLLMContent,
  isLLMContentArray,
  isMetadataEntry,
  isStoredData,
  RunStore,
  RunTimestamp,
  RunURL,
  toInlineDataPart,
} from "@google-labs/breadboard";
import * as idb from "idb";

const RUN_LISTING_DB = "run-listing";
const RUN_LISTING_VERSION = 1;

interface RunListing extends idb.DBSchema {
  urls: {
    key: "url";
    value: {
      url: string;
    };
  };
}

export class IDBRunStore implements RunStore {
  #writers: Map<RunURL, Map<RunTimestamp, WritableStreamDefaultWriter>> =
    new Map();

  #urlToDbName(url: string) {
    return `run-${url}`;
  }

  constructor() {
    // Remove the deprecated 'runs' database if it exists.
    try {
      idb.deleteDB("runs");
    } catch (err) {
      // Best effort - don't throw if there are any issues.
    }
  }

  /**
   * Starts tracking a run.
   *
   * @param storeId The ID of the store to create.
   * @param releaseGroupIds The IDs of any old stores to be released.
   * @returns The store ID used.
   */
  async start(url: RunURL): Promise<RunTimestamp> {
    // 1. Store the URLs that we've seen (necessary to support the truncation
    // and drop calls).
    const runListing = await idb.openDB<RunListing>(
      RUN_LISTING_DB,
      RUN_LISTING_VERSION,
      {
        upgrade(db) {
          db.createObjectStore("urls", { keyPath: "url" });
        },
      }
    );
    await runListing.put("urls", { url });
    runListing.close();

    // 2. Create a database and object store for this particular run.
    const dbName = this.#urlToDbName(url);
    const timestamp = Date.now();
    const timestampKey = timestamp.toString();
    const dbVersion = await idb.openDB(dbName);
    const nextVersion = dbVersion.version + 1;
    dbVersion.close();

    // 3. Set up a stream to write to the new database.
    let db: idb.IDBPDatabase;
    const stream = new WritableStream({
      async start() {
        db = await idb.openDB(dbName, nextVersion, {
          blocked(currentVersion, blockedVersion, event) {
            console.warn(
              `IDB Store blocked version ${blockedVersion} by version ${currentVersion}`,
              event
            );
          },

          upgrade(db) {
            db.createObjectStore(timestampKey, {
              keyPath: "id",
              autoIncrement: true,
            });
          },
        });

        db.close();
      },
      async write(chunk: HarnessRunResult) {
        try {
          const result = JSON.parse(JSON.stringify(chunk)) as HarnessRunResult;

          // Before storing any inputs, check if they are using StoredDataParts.
          // If so inflate them back to inlineData before storage.
          if (result.type === "nodeend" && result.data.node.type === "input") {
            for (const output of Object.values(result.data.outputs)) {
              if (!isLLMContent(output) && !isLLMContentArray(output)) {
                continue;
              }

              const outputs: LLMContent[] = isLLMContent(output)
                ? [output]
                : output;
              for (const output of outputs) {
                if (isMetadataEntry(output)) {
                  continue;
                }

                for (let i = 0; i < output.parts.length; i++) {
                  const part = output.parts[i];
                  if (!isStoredData(part)) {
                    continue;
                  }

                  output.parts[i] = await toInlineDataPart(part);
                }
              }
            }
          }

          db = await idb.openDB(dbName);
          const tx = db.transaction(timestampKey, "readwrite");
          await Promise.all([tx.store.add(result), tx.done]);
        } catch (err) {
          console.warn(
            `Unable to write to storage (URL: ${url}, Timestamp: ${timestampKey})`,
            chunk
          );
          console.warn(err);
          if (this.abort) {
            this.abort();
          }
        } finally {
          db.close();
        }
      },
      abort() {
        db.close();
      },
      close() {
        db.close();
      },
    });

    // 4. Store the writer and return the timestamp.
    let store = this.#writers.get(url);
    if (!store) {
      store = new Map<
        RunTimestamp,
        WritableStreamDefaultWriter<HarnessRunResult>
      >();
      this.#writers.set(url, store);
    }

    if (store.has(timestamp)) {
      throw new Error("Already writing a stream - please stop it first");
    }

    store.set(timestamp, stream.getWriter());
    return timestamp;
  }

  async write(
    url: RunURL,
    timestamp: RunTimestamp,
    result: HarnessRunResult
  ): Promise<void> {
    const store = this.#writers.get(url);
    if (!store) {
      throw new Error("No active stream - please start one before writing");
    }

    const writer = store.get(timestamp);
    if (!writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await writer.ready;
    writer.write(result);
  }

  async stop(url: RunURL, timestamp: RunTimestamp) {
    const store = this.#writers.get(url);
    if (!store) {
      throw new Error("No active stream - please start one before writing");
    }

    const writer = store.get(timestamp);
    if (!writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await writer.ready;
    writer.close();
    store.delete(timestamp);
  }

  async abort(url: RunURL, timestamp: RunTimestamp) {
    const store = this.#writers.get(url);
    if (!store) {
      throw new Error("No active stream - please start one before writing");
    }

    const writer = store.get(timestamp);
    if (!writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await writer.ready;
    writer.abort();
    store.delete(timestamp);
  }

  async drop(url?: RunURL) {
    if (url) {
      await idb.deleteDB(this.#urlToDbName(url));
      return;
    }

    const runListing = await idb.openDB<RunListing>(RUN_LISTING_DB);
    if (runListing.objectStoreNames.contains("urls")) {
      const urls = await runListing.getAll("urls");
      for (const item of urls) {
        await idb.deleteDB(this.#urlToDbName(item.url));
      }
    }

    runListing.close();
    await idb.deleteDB(RUN_LISTING_DB);
  }

  async truncate(url: RunURL, limit: number): Promise<void> {
    const dbName = this.#urlToDbName(url);
    const db = await idb.openDB(dbName);
    const nextVersion = db.version + 1;
    const storesToRemove = [...db.objectStoreNames]
      .sort((a, b) => {
        return Number.parseInt(b) - Number.parseInt(a);
      })
      .slice(limit);
    db.close();

    // Now re-open the database with a new version and use that operation to
    // delete the stores that are no longer needed.
    const truncateDb = await idb.openDB(this.#urlToDbName(url), nextVersion, {
      upgrade(db) {
        for (const store of storesToRemove) {
          db.deleteObjectStore(store);
        }
      },
    });
    truncateDb.close();
  }

  async getStoredRuns(
    url: RunURL
  ): Promise<Map<RunTimestamp, HarnessRunResult[]>> {
    const dbName = this.#urlToDbName(url);
    const db = await idb.openDB(dbName);
    const runs = await Promise.all(
      [...db.objectStoreNames].map(async (timestamp) => {
        const events = (await db.getAll(timestamp)) as HarnessRunResult[];
        return [Number.parseInt(timestamp), events] as [
          RunTimestamp,
          HarnessRunResult[],
        ];
      })
    );
    db.close();

    return new Map(runs);
  }
}
