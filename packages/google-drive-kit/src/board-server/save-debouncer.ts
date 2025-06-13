/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { err, type Outcome } from "@google-labs/breadboard";
import type { DriveOperations } from "./operations.js";

export { SaveDebouncer };

type SaveDebouncerState =
  | { status: "idle" }
  | { status: "debouncing"; url: URL }
  | { status: "queued"; previousSaved: Promise<void> }
  | { status: "saving"; saved: Promise<void> };

export type SaveStatus = SaveDebouncerState["status"];

export type DebouncerCallbacks = {
  savestatuschange: (status: SaveStatus, url: string) => void;
};

const DEFAULT_DEBOUNCE_DELAY = 1_500;

class SaveDebouncer {
  #timer: NodeJS.Timeout | number | null = null;
  #latest: GraphDescriptor | null = null;
  #state: SaveDebouncerState = { status: "idle" };
  #saveOperationInProgress = false;

  constructor(
    private readonly ops: DriveOperations,
    private readonly callbacks: DebouncerCallbacks,
    private readonly delay = DEFAULT_DEBOUNCE_DELAY
  ) {}

  get status() {
    return this.#state.status;
  }

  #setState(state: SaveDebouncerState, url: URL) {
    this.#state = state;
    this.callbacks.savestatuschange(state.status, url.href);
  }

  async flush(): Promise<void> {
    while (this.#state.status !== "idle") {
      const state = this.#state;
      if (state.status === "saving") {
        await state.saved;
      } else if (state.status === "queued") {
        await state.previousSaved;
      } else if (state.status === "debouncing") {
        this.cancelPendingSave();
        this.save(state.url, this.#latest!, true);
      } else {
        state satisfies never;
      }
    }
  }

  cancelPendingSave() {
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
  }

  save(url: URL, descriptor: GraphDescriptor, userInitiated: boolean) {
    this.#latest = structuredClone(descriptor);
    this.cancelPendingSave();
    if (this.#state.status === "saving") {
      console.log(
        "Drive Save: Already saving. Queued latest data to save after."
      );
      this.#setState(
        { status: "queued", previousSaved: this.#state.saved },
        url
      );
      return;
    }
    if (userInitiated) {
      this.#startSaveOperation(url);
    } else {
      this.#debounce(url);
    }
  }

  #debounce(url: URL) {
    console.log(`Drive Save: Setting debounce timer for ${this.delay} ms`);
    this.#setState({ status: "debouncing", url }, url);
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
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#setState({ status: "saving", saved: promise }, url);
    const descriptor = this.#latest;
    this.#latest = null;
    console.log("Drive Save: Performing actual save to drive");
    console.time(`Drive Save: writing "${url.href}"`);
    const writing = await this.ops.writeGraphToDrive(url, descriptor);
    console.timeEnd(`Drive Save: writing "${url.href}"`);
    this.#saveOperationInProgress = false;
    if (!writing.result) {
      console.warn(`Drive Save: save failed: ${writing.error}`);
      // TODO: Introduce error status and learn to recover from errors.
      this.#setState({ status: "idle" }, url);
      resolve();
      return err(writing.error!);
    }
    if (this.#latest !== null) {
      // If `save` was invoked again while operation was running, restart
      // the debounce timer.
      this.cancelPendingSave();
      this.#debounce(url);
    } else {
      console.log("Drive Save: save finished successfully");
      this.#setState({ status: "idle" }, url);
    }
    resolve();
  }
}
