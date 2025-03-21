/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableRun,
  InspectableRunObserver,
  // NodeIdentifier,
} from "@google-labs/breadboard";

export { createPastRunObserver };

/**
 * Creaetes an InspectableRunObserver that holds a single run.
 * Useful for historical runs
 *
 * @param run -- the run to hold.
 * @returns
 */
function createPastRunObserver(run: InspectableRun): InspectableRunObserver {
  return {
    runs: async () => [run],
    observe: async () => {
      return;
    },
    load: async () => {
      throw new Error("Attempting to load in read-only tab.");
    },
    append: async () => {
      throw new Error("Do not append to a past run observer.");
    },
    async replay() {
    },
  };
}
