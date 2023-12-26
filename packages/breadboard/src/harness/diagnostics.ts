/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProbeEvent } from "../types.js";
import { AfterhandlerResult, BeforehandlerResult } from "./types.js";

export type DiagnosticMesageType = "beforehandler" | "afterhandler";

export type DiagnosticsCallback = (
  message: BeforehandlerResult | AfterhandlerResult
) => void;

export class Diagnostics extends EventTarget {
  #callback: DiagnosticsCallback;

  constructor(callback: DiagnosticsCallback) {
    super();
    this.#callback = callback;
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("beforehandler", eventHandler);
    this.addEventListener("node", eventHandler);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    const { descriptor: node, inputs, outputs, invocationId } = e.detail;
    const message =
      e.type === "beforehandler"
        ? ({
            type: "beforehandler",
            data: { node, inputs, invocationId },
          } as BeforehandlerResult)
        : ({
            type: "afterhandler",
            data: { node, outputs, invocationId },
          } as AfterhandlerResult);
    this.#callback(message);
  };
}
