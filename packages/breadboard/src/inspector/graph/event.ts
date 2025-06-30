/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphIdentifier,
  GraphStoreUpdateEvent,
  MainGraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";

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
    public readonly nodeId: NodeIdentifier,
    public readonly affectedGraphs: MainGraphIdentifier[]
  ) {
    super(UpdateEvent.eventName, { ...eventInit });
  }
}
