/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as idb from "idb";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import {
  isInlineData,
  isLLMContent,
  isStoredData,
  RunStore,
  StoredDataCapabilityPart,
} from "@google-labs/breadboard";
import { toInlineDataPart, toStoredDataPart } from "./convert.js";
import {
  NodeTimeStamp,
  OutputProperty,
  OutputPropertyPartIndex,
  StoreID,
} from "./types.js";

const RUN_DB = "runs";

export class IDBRunStore implements RunStore {
  #writer: WritableStreamDefaultWriter | null = null;
  #version = idb.openDB(RUN_DB).then((db) => {
    const { version } = db;
    db.close();

    return version;
  });

  #dataStores = new Map<
    StoreID,
    Map<
      NodeTimeStamp,
      Map<
        OutputProperty,
        Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
      >
    >
  >();

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
    const dataStores = this.#dataStores;
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

            // Revoke any open blobs for this store, too.
            const dataStore = dataStores.get(storeName);
            if (!dataStore) {
              return;
            }

            for (const nodeTimeStamp of dataStore.values()) {
              for (const property of nodeTimeStamp.values()) {
                for (const part of property.values()) {
                  if (!part.storedData.handle.startsWith("blob:")) {
                    continue;
                  }

                  URL.revokeObjectURL(part.storedData.handle);
                }
              }
            }
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
    limit = Number.POSITIVE_INFINITY,
    convertInlineData = true
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

    const runs: HarnessRunResult[][] = await Promise.all(
      storeNames.map((storeName) => db.getAll(storeName))
    );

    if (!convertInlineData) {
      db.close();
      return runs;
    }

    // Now step through each of the runs and convert any inlineData over to a
    // storedData instead.
    for (let i = 0; i < storeNames.length; i++) {
      const storeName = storeNames[i];
      let dataStore = this.#dataStores.get(storeName);
      if (!dataStore) {
        dataStore = new Map<
          NodeTimeStamp,
          Map<
            OutputProperty,
            Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
          >
        >();
        this.#dataStores.set(storeName, dataStore);
      }

      for (const event of runs[i]) {
        if (event.type !== "nodeend" || event.data.node.type !== "input") {
          continue;
        }

        const nodeTimeStamp = event.data.timestamp.toFixed(3);
        let properties = dataStore.get(nodeTimeStamp);
        if (!properties) {
          properties = new Map<
            OutputProperty,
            Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
          >();
          dataStore.set(nodeTimeStamp, properties);
        }

        for (const [property, value] of Object.entries(event.data.outputs)) {
          if (!isLLMContent(value)) {
            continue;
          }

          let partHandles = properties.get(property);
          if (!partHandles) {
            partHandles = new Map<
              OutputPropertyPartIndex,
              StoredDataCapabilityPart
            >();
            properties.set(property, partHandles);
          }

          for (let j = 0; j < value.parts.length; j++) {
            const part = value.parts[j];

            if (isInlineData(part)) {
              let storedDataPart = partHandles.get(j);
              if (!storedDataPart) {
                storedDataPart = await toStoredDataPart(part);
              }

              value.parts[j] = storedDataPart;
              partHandles.set(j, storedDataPart);
            } else if (isStoredData(part)) {
              throw new Error("Unexpected storedData part in retrieved values");
            }
          }
        }
      }
    }

    db.close();
    return runs;
  }
}
