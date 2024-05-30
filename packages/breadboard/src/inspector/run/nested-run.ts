/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphUUID,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  PathRegistryEntry,
} from "../types.js";

/**
 * Meant to be a very lightweight wrapper around the
 * data in the `PathRegistryEntry`.
 */
export class NestedRun implements InspectableRun {
  graphId: GraphUUID;
  start: number;
  end: number | null;
  graphVersion = 0;
  events: InspectableRunEvent[];
  dataStoreGroupId: number = -1;

  constructor(entry: PathRegistryEntry) {
    this.graphId = entry.graphId as GraphUUID;
    this.start = entry.graphStart;
    this.end = entry.graphEnd;
    this.events = entry.events;
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    return null;
  }

  stack(): InspectableRunNodeEvent[] {
    // TODO: Implement stack support for nested runs.
    return [];
  }

  getEventById(): InspectableRunEvent | null {
    return null;
  }

  inputs(): InspectableRunInputs | null {
    return null;
  }
}
