/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProbeMessage } from "@breadboard-ai/types";
import type { Probe } from "../types.js";

export type DiagnosticsCallback = (message: ProbeMessage) => Promise<void>;

export class Diagnostics implements Probe {
  #callback: DiagnosticsCallback;

  constructor(callback: DiagnosticsCallback) {
    this.#callback = callback;
  }

  async report(message: ProbeMessage): Promise<void> {
    return this.#callback(message);
  }
}
