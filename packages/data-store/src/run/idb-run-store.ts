/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import {
  isLLMContent,
  isStoredData,
  RunStore,
  toInlineDataPart,
} from "@google-labs/breadboard";

const RUN_DB = "runs";

export class IDBRunStore implements RunStore {
  #writer: WritableStreamDefaultWriter | null = null;
  #version = idb.openDB(RUN_DB).then((db) => {
    const { version } = db;
    db.close();

    return version;
  });

  /**
   * Starts tracking a run.
   *
   * @param storeId The ID of the store to create.
   * @param limit The maximum number of old runs to keep around.
   * @returns The store ID used.
   */
  async start(storeId: string, limit = 2) {
    if (this.#writer) {
      throw new Error("Already writing a stream - please stop it first");
    }

    // Get the current version, bump it and set it for future starts.
    const newVersion = (await this.#version) + 1;
    this.#version = Promise.resolve(newVersion);

    // Now figure out the new version.
    const dbNewVersion = await idb.openDB(RUN_DB, newVersion, {
      blocked(currentVersion, blockedVersion, event) {
        console.warn(
          `IDB Store blocked version ${blockedVersion} by version ${currentVersion}`,
          event
        );
      },

      upgrade(db) {
        db.createObjectStore(storeId, {
          keyPath: "id",
          autoIncrement: true,
        });

        [...db.objectStoreNames]
          .sort((a, b) => {
            if (a > b) return -1;
            if (a < b) return 1;
            return 0;
          })
          .slice(limit)
          .map((storeName) => {
            // Delete the entries.
            db.deleteObjectStore(storeName);
          });
      },
    });

    dbNewVersion.close();

    // Now set up a stream to write to the new version.
    let db: idb.IDBPDatabase;
    const stream = new WritableStream({
      async start() {
        db = await idb.openDB(RUN_DB);
      },
      async write(chunk: HarnessRunResult) {
        try {
          const result = JSON.parse(JSON.stringify(chunk)) as HarnessRunResult;

          // Before storing any inputs, check if they are using StoredDataParts.
          // If so inflate them back to inlineData before storage.
          if (result.type === "nodeend" && result.data.node.type === "input") {
            for (const output of Object.values(result.data.outputs)) {
              if (!isLLMContent(output)) {
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

          const tx = db.transaction(storeId, "readwrite");
          await Promise.all([tx.store.add(result), tx.done]);
        } catch (err) {
          console.warn("Unable to write to storage", chunk);
          console.warn(err);
          if (this.abort) {
            this.abort();
          }
        }
      },
      abort() {
        db.close();
      },
      close() {
        db.close();
      },
    });

    this.#writer = stream.getWriter();
    return storeId;
  }

  async write(result: HarnessRunResult) {
    if (!this.#writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await this.#writer.ready;
    this.#writer.write(result);
  }

  async stop() {
    if (!this.#writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await this.#writer.ready;
    this.#writer.close();
    this.#writer = null;
  }

  async abort() {
    if (!this.#writer) {
      throw new Error("No active stream - please start one before writing");
    }

    await this.#writer.ready;
    this.#writer.abort();
    this.#writer = null;
  }

  async drop() {
    await idb.deleteDB(RUN_DB);
  }

  async getNewestRuns(
    limit = Number.POSITIVE_INFINITY
  ): Promise<HarnessRunResult[][]> {
    await this.#version;

    const db = await idb.openDB(RUN_DB);
    const storeNames = [...db.objectStoreNames]
      .sort((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      })
      .slice(0, limit);

    const runs = await Promise.all(
      storeNames.map((storeName) => db.getAll(storeName))
    );
    db.close();

    return runs;
  }
}
