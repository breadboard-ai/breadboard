/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class LogToElementProbe extends EventTarget {
  #outputElement: HTMLElement;

  /**
   * Creates a new LogProbe instance. If no receiver is provided, the
   * console will be used.
   * @param receiver Optional. An object with a `log` method that accepts
   * any number of arguments.
   */
  constructor(outputElement: HTMLElement) {
    super();

    this.#outputElement = outputElement;

    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("input", eventHandler);
    this.addEventListener("skip", eventHandler);
    this.addEventListener("node", eventHandler);
    this.addEventListener("output", eventHandler);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    this.#outputElement.innerText += `Type: ${e.type}\nDetails:\n${JSON.stringify(e.detail,null, 2)}\n\n`;
  };
}