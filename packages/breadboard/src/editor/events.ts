/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, NodeIdentifier } from "../types.js";
import {
  ChangeEventType,
  ErrorRejection,
  GraphChangeEvent,
  GraphChangeRejectEvent,
  NoChangeRejection,
} from "./types.js";

/**
 * This event is dispatched whenever the graph changes due to edits.
 */
export class ChangeEvent extends Event implements GraphChangeEvent {
  static eventName = "graphchange";

  constructor(
    public graph: GraphDescriptor,
    public version: number,
    public visualOnly: boolean,
    public changeType: ChangeEventType,
    public affectedNodes: NodeIdentifier[],
    public affectedModules: NodeIdentifier[]
  ) {
    super(ChangeEvent.eventName, {
      bubbles: false,
      cancelable: true,
      composed: true,
    });
  }
}

/**
 * This event is dispatched whenever a proposed change to the graph is
 * rejected. The rejection may happen for two reasons
 * - error: the change would create an invalid graph. For instance, adding an edge to a non-existent node.
 * - nochange: the change is unnecessary, because it results in no actual change to the graph. For example, adding an edge that already exists.
 */
export class ChangeRejectEvent extends Event implements GraphChangeRejectEvent {
  static eventName = "graphchangereject";

  constructor(
    public graph: GraphDescriptor,
    public reason: ErrorRejection | NoChangeRejection
  ) {
    super(ChangeRejectEvent.eventName, {
      bubbles: false,
      cancelable: true,
      composed: true,
    });
  }
}
