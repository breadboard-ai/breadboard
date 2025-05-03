/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { err, type Outcome } from "@google-labs/breadboard";
import type { DriveOperations } from "./operations.js";

export { SaveDebouncer };

export type SaveStatus = "idle" | "debouncing" | "queued" | "saving";

const DEFAULT_DEBOUNCE_DELAY = 1_500;

class SaveDebouncer {
  #timer: NodeJS.Timeout | number | null = null;
  #latest: GraphDescriptor | null = null;
  #status: SaveStatus = "idle";
  #saveOperationInProgress = false;

  constructor(
    private readonly ops: DriveOperations,
    private readonly delay = DEFAULT_DEBOUNCE_DELAY
  ) {}

  get status() {
    return this.#status;
  }

  save(url: URL, descriptor: GraphDescriptor) {
    this.#latest = structuredClone(descriptor);
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
    if (this.#saveOperationInProgress) {
      console.log(
        "Drive Save: Already saving. Queued latest data to save after."
      );
      this.#status = "queued";
      return;
    }
    this.#debounce(url);
  }

  #debounce(url: URL) {
    console.log(`Drive Save: Setting debounce timer for ${this.delay} ms`);
    this.#status = "debouncing";
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#startSaveOperation(url);
    }, this.delay);
  }

  async #startSaveOperation(url: URL): Promise<Outcome<void>> {
    if (this.#saveOperationInProgress || this.#latest === null) {
      return err(`Drive Save: Save operation started unexpectedly`);
    }
    this.#saveOperationInProgress = true;
    console.log("Drive Save: Performing actual save to drive");
    this.#status = "saving";
    const descriptor = this.#latest;
    this.#latest = null;
    const writing = await this.ops.writeGraphToDrive(url, descriptor);
    this.#saveOperationInProgress = false;
    if (!writing.result) {
      console.warn(`Drive Save: save failed: ${writing.error}`);
      return err(writing.error!);
    }
    if (this.#latest !== null) {
      if (this.#timer) {
        clearTimeout(this.#timer);
      }
      this.#debounce(url);
    } else {
      console.log("Drive Save: save finished successfully");
      this.#status = "idle";
    }
  }
}
