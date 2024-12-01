/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SnapshotFreshEvent, SnapshotStaleEvent } from "./types.js";

export { StaleEvent, FreshEvent };

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

class StaleEvent extends Event implements SnapshotStaleEvent {
  static eventName = "stale";
  constructor() {
    super(StaleEvent.eventName, { ...eventInit });
  }
}

class FreshEvent extends Event implements SnapshotFreshEvent {
  static eventName = "fresh";
  constructor() {
    super(FreshEvent.eventName, {
      ...eventInit,
    });
  }
}
