/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphStoreUpdateEvent } from "../types.js";

export { UpdateEvent };

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

class UpdateEvent extends Event implements GraphStoreUpdateEvent {
  static eventName = "update";

  constructor() {
    super(UpdateEvent.eventName, { ...eventInit });
  }
}
