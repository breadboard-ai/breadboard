/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProbeEvent } from "./types.js";

type Receiver = {
  log: (...args: unknown[]) => void;
};

/**
 * A convenience probe for easily logging events from the Board.
 * Usage:
 * ```ts
 * const log = new LogProbe();
 * for await (const result of this.run(log)) {
 *  // ...
 * }
 * ```
 */
export class LogProbe extends EventTarget {
  #receiver: Receiver;

  /**
   * Creates a new LogProbe instance. If no receiver is provided, the
   * console will be used.
   * @param receiver Optional. An object with a `log` method that accepts
   * any number of arguments.
   */
  constructor(receiver?: Receiver) {
    super();
    this.#receiver = receiver || console;
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("input", eventHandler);
    this.addEventListener("skip", eventHandler);
    this.addEventListener("node", eventHandler);
    this.addEventListener("output", eventHandler);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    this.#receiver.log(e.type, e.detail);
  };
}
