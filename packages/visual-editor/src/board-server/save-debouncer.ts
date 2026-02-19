/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, Outcome } from "@breadboard-ai/types";
import type { DriveOperations } from "@breadboard-ai/utils/google-drive/operations.js";
import { err } from "@breadboard-ai/utils";
import { getLogger, Formatter } from "../sca/utils/logging/logger.js";

export { SaveDebouncer };

type SaveDebouncerState =
  | { status: "idle" }
  | { status: "debouncing"; url: URL }
  | { status: "queued"; previousSaved: Promise<void> }
  | { status: "saving"; saved: Promise<void> };

export type SaveStatus = SaveDebouncerState["status"];

export type DebouncerCallbacks = {
  savestatuschange: (status: SaveStatus, url: string) => void;
  savecomplete: (url: string, version: string) => void;
};

const DEFAULT_DEBOUNCE_DELAY = 1_500;
const LABEL = "Drive Save";

class SaveDebouncer {
  #timer: NodeJS.Timeout | number | null = null;
  #latest: GraphDescriptor | null = null;
  #state: SaveDebouncerState = { status: "idle" };
  #saveOperationInProgress = false;
  #logger = getLogger();

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
      this.#logger.log(
        Formatter.verbose("Already saving. Queued latest data to save after."),
        LABEL
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
    getLogger().log(
      Formatter.verbose(`Setting debounce timer for ${this.delay} ms`),
      LABEL
    );
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
    this.#logger.log(
      Formatter.verbose("Performing actual save to drive"),
      LABEL
    );
    const startTime = performance.now();
    const writing = await this.ops.writeGraphToDrive(url, descriptor);
    const elapsed = (performance.now() - startTime).toFixed(1);
    this.#logger.log(
      Formatter.verbose(`Writing "${url.href}" took ${elapsed}ms`),
      LABEL
    );
    this.#saveOperationInProgress = false;
    if (!writing.result) {
      this.#logger.log(
        Formatter.warning(`Save failed: ${writing.error}`),
        LABEL
      );
      // TODO: Introduce error status and learn to recover from errors.
      this.#setState({ status: "idle" }, url);
      resolve();
      return err(writing.error);
    }
    this.callbacks.savecomplete(url.href, writing.version);
    if (this.#latest !== null) {
      // If `save` was invoked again while operation was running, restart
      // the debounce timer.
      this.cancelPendingSave();
      this.#debounce(url);
    } else {
      this.#logger.log(Formatter.verbose("Save finished successfully"), LABEL);
      this.#setState({ status: "idle" }, url);
    }
    resolve();
  }
}
