/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues } from "../types.js";
import {
  InspectableRun,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  PathRegistryEntry,
  UUID,
} from "./types.js";

export const SECRET_PATH = [-2];
export const ERROR_PATH = [-3];

class Entry implements PathRegistryEntry {
  #events: InspectableRunEvent[] = [];
  #eventsIsDirty = false;
  #children: Entry[] = [];
  event: InspectableRunNodeEvent | null = null;
  sidecars: InspectableRunEvent[] = [];
  // Keep track of some sidecar events so that we can clean them up later.
  // We only need to keep track of input and output events, since the
  // secret and events do not have a corresponding `nodeend` event.
  #trackedSidecars: Map<string, InspectableRunEvent> = new Map();

  graphId: UUID | null = null;

  addSidecar(path: number[], event: InspectableRunEvent) {
    const key = path.join("-");
    this.children[this.children.length - 1].sidecars.push(event);
    this.#trackedSidecars.set(key, event);
    this.#eventsIsDirty = true;
  }

  finalizeSidecar(
    path: number[],
    data?: { timestamp: number; outputs: OutputValues }
  ) {
    const key = path.join("-");
    const sidecar = this.#trackedSidecars.get(key) as InspectableRunNodeEvent;
    if (sidecar) {
      if (data) {
        sidecar.end = data.timestamp;
        sidecar.outputs = data.outputs;
      }
      sidecar.result = null;
      this.#trackedSidecars.delete(key);
      this.#eventsIsDirty = true;
    }
  }

  /**
   * The main traversal function for the path registry. It will find the
   * entry for the given path, creating it if permitted, and return it.
   *
   * This function is what builds the graph tree.
   *
   * @param readonly -- If true, the registry is read-only and will not be
   *    modified.
   * @param registry -- The registry to traverse. Used in recursion.
   * @param fullPath -- The full path to the current node. Passed along during
   *   recursion.
   * @param path -- The current path to the node. Used in recursion.
   * @returns -- The entry for the given path, or undefined if the path is
   *  empty or invalid.
   */
  #findOrCreate(
    readonly: boolean,
    fullPath: number[],
    path: number[]
  ): PathRegistryEntry | undefined {
    // Marking events dirty, because we're about to mutate something within
    // this swath of the registry.
    this.#eventsIsDirty = true;
    const [head, ...tail] = path;
    if (head === undefined) {
      return;
    }
    let entry = this.#children[head];
    if (!entry) {
      if (tail.length !== 0) {
        // If you see this message in the console, it's a problem with the
        // underlying runner. The runner should always provide paths
        // incrementally, so there should never be a situation where we don't
        // have a registry entry for an index in the middle of the path.
        console.warn("Path registry entry not found for", path, "in", fullPath);
      }
      if (readonly) {
        console.warn("Path registry is read-only. Not adding", fullPath);
        return;
      }
      entry = this.#children[head] = new Entry();
    }
    if (tail.length === 0) {
      return entry;
    }
    return entry.#findOrCreate(readonly, fullPath, tail);
  }

  find(path: number[]) {
    return this.#findOrCreate(true, path, path);
  }

  create(path: number[]) {
    return this.#findOrCreate(false, path, path);
  }

  get children() {
    return this.#children;
  }

  #updateEvents() {
    this.#events = this.children
      .filter(Boolean)
      .flatMap((entry) => [...entry.sidecars, entry.event])
      .filter(Boolean) as InspectableRunEvent[];
  }

  get events() {
    if (this.#eventsIsDirty) {
      this.#updateEvents();
      this.#eventsIsDirty = false;
    }
    return this.#events;
  }

  nested(): InspectableRun[] {
    if (this.#children.length === 0) {
      return [];
    }
    const events = this.events;
    // a bit of a hack: what I actually need is to find out whether this is
    // a map or not.
    // Maps have a peculiar structure: their children will have no events, but
    // their children's children (the parallel runs) will have events.
    if (events.length > 0) {
      // This is an ordinary run.
      return [
        {
          graphId: this.graphId as UUID,
          graphVersion: 0,
          messages: [],
          events,
          observe: (runner) => runner,
          currentNode: () => "",
        },
      ];
    } else {
      // This is a map.
      return this.#children.filter(Boolean).map((entry) => {
        return {
          graphId: entry.graphId as UUID,
          graphVersion: 0,
          messages: [],
          observe: (runner) => runner,
          currentNode: () => "",
          events: entry.events,
        };
      });
    }
  }
}

export class PathRegistry extends Entry {}
