/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { RunStore, RunTimestamp, RunURL } from "./types.js";

export class DefaultRunStore implements RunStore {
  #runs = new Map<RunURL, Map<RunTimestamp, HarnessRunResult[]>>();

  async start(url: RunURL): Promise<RunTimestamp> {
    const timestamp = Date.now();
    let store = this.#runs.get(url);
    if (!store) {
      store = new Map<RunTimestamp, HarnessRunResult[]>();
    }

    if (store.has(timestamp)) {
      throw new Error("Run by name has already started");
    }

    store.set(timestamp, []);
    this.#runs.set(url, store);
    return timestamp;
  }

  async write(url: RunURL, timestamp: RunTimestamp, result: HarnessRunResult) {
    const store = this.#runs.get(url);
    if (!store) {
      throw new Error("Unable to find the store");
    }

    const run = store.get(timestamp);
    if (!run) {
      console.warn(`No run created for timestamp ${timestamp}`);
      return;
    }

    run.push(result);
  }

  async stop(_storeId: RunURL, _timestamp: RunTimestamp) {
    // Noop.
  }

  async abort(_storeId: RunURL, _timestamp: RunTimestamp) {
    // Noop
  }

  async drop(url?: RunURL, _limit?: number) {
    if (url) {
      this.#runs.delete(url);
    } else {
      this.#runs.clear();
    }
  }

  async truncate(url: RunURL, limit: number) {
    const store = this.#runs.get(url);
    if (!store) {
      return;
    }

    if (store.size <= limit) {
      return;
    }

    const toRemove = [...store.keys()].sort((a, b) => b - a).slice(limit);
    for (const item of toRemove) {
      store.delete(item);
    }
  }

  async getStoredRuns(
    url: RunURL
  ): Promise<Map<RunTimestamp, HarnessRunResult[]>> {
    if (!this.#runs.has(url)) {
      return new Map();
    }

    return this.#runs.get(url)!;
  }
}
