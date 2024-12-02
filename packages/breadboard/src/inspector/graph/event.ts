/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import { GraphStoreUpdateEvent, MainGraphIdentifier } from "../types.js";

export { UpdateEvent };

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

class UpdateEvent extends Event implements GraphStoreUpdateEvent {
  static eventName = "update";

  constructor(
    public readonly mainGraphId: MainGraphIdentifier,
    public readonly graphId: GraphIdentifier,
    public readonly nodeId: NodeIdentifier
  ) {
    super(UpdateEvent.eventName, { ...eventInit });
  }
}
