/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import {
  InputResponse,
  InputValues,
  NodeDescriptor,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  OutputValues,
} from "../types.js";
import {
  InspectableRun,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
} from "./types.js";

const SECRET_PATH = [-2];
const ERROR_PATH = [-3];

type PathRegistryEntry = {
  children: PathRegistryEntry[];
  event: InspectableRunNodeEvent | null;
  /**
   * Sidecars are events that are displayed at a top-level, but aren't
   * part of the main event list. Currently, sidecar events are:
   * - Input events that have bubbled up.
   * - Output events that have bubbled up.
   * - Secret events.
   * - Error events.
   */
  sidecars: InspectableRunEvent[];
  /**
   * Computes nested runs for the given path.
   */
  nested(): InspectableRun[];
};

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
  findOrCreate(
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
    return entry.findOrCreate(readonly, fullPath, tail);
  }

  get children() {
    return this.#children;
  }

  #updateEvents() {
    this.#events = this.children
      .filter(Boolean)
      .flatMap((entry) => [entry.event, ...entry.sidecars])
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
          id: -10,
          graphId: crypto.randomUUID(),
          graphVersion: 0,
          messages: [],
          events,
          observe: (runner) => runner,
          currentNode: () => "",
        },
      ];
    } else {
      // This is a map.
      return this.#children.map((entry) => {
        return {
          id: -10,
          graphId: crypto.randomUUID(),
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

class Event implements InspectableRunNodeEvent {
  type: "node";
  node: NodeDescriptor;
  start: number;
  end: number | null;
  inputs: InputValues;
  outputs: OutputValues | null;
  result: HarnessRunResult | null;
  bubbled: boolean;

  /**
   * The path registry entry associated with this event.
   */
  #entry: PathRegistryEntry | null;

  constructor(
    entry: PathRegistryEntry | null,
    node: NodeDescriptor,
    start: number,
    inputs: InputValues
  ) {
    this.#entry = entry;
    this.type = "node";
    this.node = node;
    this.start = start;
    this.end = null;
    this.inputs = inputs;
    this.outputs = null;
    this.result = null;
    this.bubbled = false;
  }

  get nested() {
    return this.#entry?.nested() || [];
  }
}

export class PathRegistry extends Entry {
  #traverse(readonly: boolean, path: number[]) {
    return this.findOrCreate(readonly, path, path);
  }

  cleanUpSecrets() {
    this.finalizeSidecar(SECRET_PATH);
  }

  graphstart(path: number[]) {
    this.#traverse(false, path);
  }

  graphend(path: number[]) {
    this.#traverse(true, path);
  }

  nodestart(path: number[], data: NodeStartResponse) {
    const entry = this.#traverse(false, path) as Entry;
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    const event = new Event(entry, data.node, data.timestamp, data.inputs);
    entry.event = event;
  }

  input(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      const input = result.data as InputResponse;
      const event = new Event(
        null,
        input.node,
        input.timestamp,
        input.inputArguments
      );
      event.bubbled = true;
      event.result = result;
      this.addSidecar(path, event);
    } else {
      const entry = this.#traverse(true, path);
      if (!entry) {
        throw new Error(
          `Expected an existing entry for ${JSON.stringify(path)}`
        );
      }
      const existing = entry.event;
      if (!existing) {
        console.error("Expected an existing event for", path);
        return;
      }
      existing.result = result;
    }
  }

  output(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      // Create a new entry for the sidecar output event.
      const output = result.data as OutputResponse;
      const event = new Event(
        null,
        output.node,
        output.timestamp,
        output.outputs
      );
      event.bubbled = true;
      event.result = result;
      this.addSidecar(path, event);
    } else {
      const entry = this.#traverse(true, path);
      if (!entry) {
        throw new Error(
          `Expected an existing entry for ${JSON.stringify(path)}`
        );
      }
      const existing = entry.event;
      if (!existing) {
        console.error("Expected an existing event for", path);
        return;
      }
      existing.inputs = (result.data as OutputResponse).outputs;
    }
  }

  nodeend(path: number[], data: NodeEndResponse) {
    const entry = this.#traverse(true, path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    const existing = entry.event;
    if (!existing) {
      console.error("Expected an existing event for", path);
      return;
    }
    existing.end = data.timestamp;
    existing.outputs = data.outputs;
    existing.result = null;
    this.finalizeSidecar(path, data);
  }

  secret(event: InspectableRunSecretEvent) {
    this.addSidecar(SECRET_PATH, event);
  }

  error(error: InspectableRunErrorEvent) {
    this.addSidecar(ERROR_PATH, error);
  }
}
