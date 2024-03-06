/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableRunEvent } from "./types.js";

class EventManager {
  event: InspectableRunEvent;

  constructor(event: InspectableRunEvent) {
    this.event = event;
  }
}
