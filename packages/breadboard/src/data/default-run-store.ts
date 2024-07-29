/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { isLLMContent, isStoredData, toInlineDataPart } from "./common.js";
import { RunStore } from "./types.js";

export class DefaultRunStore implements RunStore {
  #runs = new Map<string, HarnessRunResult[]>();
  #storeId: string | null = null;

  async start(storeId: string, limit = 2) {
    if (this.#runs.has(storeId)) {
      throw new Error("Run by name has already started");
    }

    this.#storeId = storeId;
    this.#runs.set(storeId, []);

    const oldStoreNames = [...this.#runs.keys()]
      .sort((a, b) => {
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      })
      .slice(limit);

    for (const storeName of oldStoreNames) {
      this.#runs.delete(storeName);
    }

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
    limit = Number.POSITIVE_INFINITY
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

    return runs;
  }
}
