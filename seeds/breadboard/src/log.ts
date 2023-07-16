/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProbeEvent } from "./types.js";

/**
 * A convenience probe for easily logging events from the Board.
 * Usage:
 * ```ts
 * const log = new LogProbe();
 * for await (const result of this.run(log)) {
 * // ...
 * }
 */
export class LogProbe extends EventTarget {
  constructor() {
    super();
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("input", eventHandler);
    this.addEventListener("skip", eventHandler);
    this.addEventListener("node", eventHandler);
    this.addEventListener("output", eventHandler);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    console.log(e.type, e.detail);
  };
}
