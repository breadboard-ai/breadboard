/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class CodeChangeEvent extends Event {
  static eventName = "bbcodechange";

  constructor() {
    super(CodeChangeEvent.eventName, { ...eventInit });
  }
}
