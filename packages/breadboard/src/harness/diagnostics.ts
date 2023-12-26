/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Probe, ProbeEvent, ProbeMessage } from "../types.js";
import { AfterhandlerResult, BeforehandlerResult } from "./types.js";

export type DiagnosticMesageType = "beforehandler" | "afterhandler";

export type DiagnosticsCallback = (
  message: BeforehandlerResult | AfterhandlerResult | ProbeMessage
) => Promise<void>;

export class Diagnostics extends EventTarget implements Probe {
  #callback: DiagnosticsCallback;

  constructor(callback: DiagnosticsCallback) {
    super();
    this.#callback = callback;
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("beforehandler", eventHandler);
    this.addEventListener("node", eventHandler);
  }

  async report(message: ProbeMessage): Promise<void> {
    return this.#callback(message);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    const { descriptor: node, inputs, outputs, path } = e.detail;
    const message =
      e.type === "beforehandler"
        ? ({
            type: "beforehandler",
            data: { node, inputs, path },
          } as BeforehandlerResult)
        : ({
            type: "afterhandler",
            data: { node, outputs, path },
          } as AfterhandlerResult);
    this.#callback(message);
  };
}
