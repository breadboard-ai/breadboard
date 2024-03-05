/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "@google-labs/breadboard/harness";

// Temporary hacks while extruding the inspectRun API.
type Runner = AsyncGenerator<HarnessRunResult, void, unknown>;

export const observe = (runner: Runner): Runner => {
  return {
    async next() {
      return runner.next();
    },
    async return() {
      return runner.return();
    },
    async throw(error?: unknown) {
      return runner.throw(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
};
