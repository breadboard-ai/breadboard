/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableGraphUpdateEvent } from "../types.js";

export { UpdateEvent };

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

class UpdateEvent extends Event implements InspectableGraphUpdateEvent {
  static eventName = "update";

  constructor() {
    super(UpdateEvent.eventName, { ...eventInit });
  }
}
