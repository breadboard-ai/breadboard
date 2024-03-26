/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessRunResult } from "../harness/types.js";
import type {
  GraphUUID,
  InspectableRun,
  InspectableRunEvent,
  PathRegistryEntry,
} from "./types.js";

/**
 * Meant to be a very lightweight wrapper around the
 * data in the `PathRegistryEntry`.
 */
export class NestedRun implements InspectableRun {
  graphId: GraphUUID;
  start: number;
  end: number | null;
  graphVersion = 0;
  messages: HarnessRunResult[] = [];
  events: InspectableRunEvent[];

  constructor(entry: PathRegistryEntry) {
    this.graphId = entry.graphId as GraphUUID;
    this.start = entry.graphStart;
    this.end = entry.graphEnd;
    this.events = entry.events;
  }

  getEventById(): InspectableRunEvent | null {
    return null;
  }

  currentNode(): string {
    return "";
  }
}
