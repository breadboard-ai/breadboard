/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const eventInit = { bubbles: true, cancelable: true, composed: true };

export class ControllerDebugEvent extends Event {
  static eventName = "controllerdebug";

  constructor(public readonly path: string[] = []) {
    super(ControllerDebugEvent.eventName, { ...eventInit });
  }
}
