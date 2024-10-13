/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import type {
  EventIdentifier,
  GraphUUID,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  PathRegistryEntry,
} from "../types.js";
import {
  entryIdFromEventId,
  eventsAsHarnessRunResults,
  pathFromId,
} from "./conversions.js";

/**
 * Meant to be a very lightweight wrapper around the
 * data in the `PathRegistryEntry`.
 */
export class NestedRun implements InspectableRun {
  public readonly dataStoreKey = Date.now().toFixed(3);

  #entry: PathRegistryEntry;

  graphId: GraphUUID;
  start: number;
  end: number | null;
  graphVersion = 0;
  events: InspectableRunEvent[];
  edges = [];

  constructor(entry: PathRegistryEntry) {
    this.graphId = entry.graphId as GraphUUID;
    this.start = entry.graphStart;
    this.end = entry.graphEnd;
    this.events = entry.events;
    this.#entry = entry;
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    return null;
  }

  stack(): InspectableRunNodeEvent[] {
    // TODO: Implement stack support for nested runs.
    return [];
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    const entryId = entryIdFromEventId(id);
    if (!entryId) return null;
    const path = pathFromId(entryId);
    const entry = this.#entry.find(path);
    return entry?.event || null;
  }

  inputs(): InspectableRunInputs | null {
    return null;
  }

  async *replay(): AsyncGenerator<HarnessRunResult> {
    const { view } = this.#entry;
    if (!view) {
      return;
    }
    const { sequence, start } = view;
    if (!sequence) {
      return;
    }
    const timeline = sequence.slice(start);
    yield* eventsAsHarnessRunResults(timeline);
  }
}
