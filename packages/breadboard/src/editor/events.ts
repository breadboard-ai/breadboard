/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";

/**
 * This event is dispatched whenever the graph changes due to edits.
 */
export class GraphChangeEvent extends Event {
  static eventName = "graphchange";

  constructor(
    public graph: GraphDescriptor,
    public version: number,
    public visualOnly: boolean
  ) {
    super(GraphChangeEvent.eventName, {
      bubbles: false,
      cancelable: true,
      composed: true,
    });
  }
}

export class GraphChangeRejectedEvent extends Event {
  static eventName = "graphchangerejected";

  constructor(
    public graph: GraphDescriptor,
    public error: string
  ) {
    super(GraphChangeRejectedEvent.eventName, {
      bubbles: false,
      cancelable: true,
      composed: true,
    });
  }
}

export type EditableGraphEventMap = {
  graphchange: GraphChangeEvent;
  graphchangerejected: GraphChangeRejectedEvent;
};
