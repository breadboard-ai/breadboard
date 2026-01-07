/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The event which should be dispatched by a Breadboard Input Widget to indicate
 * when there is a new value.
 */
export class InputChangeEvent extends Event {
  readonly value: unknown;
  constructor(value: unknown, options?: EventInit) {
    super("bb-input-change", options);
    this.value = value;
  }
}

export class InputCancelEvent extends Event {
  constructor() {
    super("bbinputcancel", { bubbles: true, cancelable: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    "bb-input-change": InputChangeEvent;
    bbinputcancel: InputCancelEvent;
  }
}
