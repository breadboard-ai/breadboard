/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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

export class InMemoryRunStore implements RunStore {
  #runs = new Map<string, HarnessRunResult[]>();
  #storeId: string | null = null;

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

  async start(storeId: string, limit = 2) {
    if (this.#runs.has(storeId)) {
      throw new Error("Run by name has already started");
    }

    const oldStoreNames = [...this.#runs.keys()]
      .sort((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      })
      .slice(limit);

    for (const storeName of oldStoreNames) {
      // Revoke any open blobs for this store.
      const dataStore = this.#dataStores.get(storeName);
      if (!dataStore) {
        throw new Error(`Unable to locate data store for run: ${storeName}`);
      }

      for (const nodeTimeStamp of dataStore.values()) {
        for (const property of nodeTimeStamp.values()) {
          for (const part of property.values()) {
            if (!part.storedData.handle.startsWith("blob:")) {
              continue;
            }

            console.log(`Revoking ${part.storedData.handle} from ${storeName}`);
            URL.revokeObjectURL(part.storedData.handle);
          }
        }
      }

      // And now delete it.
      this.#runs.delete(storeName);
    }

    this.#storeId = storeId;
    this.#runs.set(storeId, []);
    return storeId;
  }

  async write(result: HarnessRunResult) {
    if (!this.#storeId) {
      throw new Error("Run has not been started");
    }

    const store = this.#runs.get(this.#storeId);
    if (!store) {
      throw new Error("Unable to find the store");
    }

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

    store.push(result);
  }

  async stop() {
    this.#storeId = null;
  }

  async abort() {
    this.#storeId = null;
  }

  async drop() {
    this.#runs.clear();
  }

  async getNewestRuns(
    limit = Number.POSITIVE_INFINITY,
    convertInlineData = true
  ): Promise<HarnessRunResult[][]> {
    const storeNames = [...this.#runs.keys()]
      .sort((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      })
      .slice(0, limit);

    const runs = storeNames.map(
      (storeName) => JSON.parse(JSON.stringify(this.#runs.get(storeName))) ?? []
    );

    if (!convertInlineData) {
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

    return runs;
  }
}
