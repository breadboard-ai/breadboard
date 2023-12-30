/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Probe, ProbeMessage } from "../types.js";

export type DiagnosticsCallback = (message: ProbeMessage) => Promise<void>;

export class Diagnostics extends EventTarget implements Probe {
  #callback: DiagnosticsCallback;

  constructor(callback: DiagnosticsCallback) {
    super();
    this.#callback = callback;
  }

  async report(message: ProbeMessage): Promise<void> {
    return this.#callback(message);
  }
}
