/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Probe, ProbeEvent, ProbeMessage } from "../types.js";
import { BeforehandlerResult } from "./types.js";

export type DiagnosticMesageType = "beforehandler";

export type DiagnosticsCallback = (
  message: BeforehandlerResult | ProbeMessage
) => Promise<void>;

export class Diagnostics extends EventTarget implements Probe {
  #callback: DiagnosticsCallback;

  constructor(callback: DiagnosticsCallback) {
    super();
    this.#callback = callback;
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("beforehandler", eventHandler);
  }

  async report(message: ProbeMessage): Promise<void> {
    return this.#callback(message);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    const { descriptor: node, inputs, path } = e.detail;
    const message = {
      type: "beforehandler",
      data: { node, inputs, path },
    } as BeforehandlerResult;
    this.#callback(message);
  };
}
