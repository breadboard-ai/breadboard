/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import {
  InputResponse,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
} from "../types.js";
import {
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
} from "./types.js";

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
};

type PathRegistryEntryUpdater = (entry: PathRegistryEntry) => void;

class Entry implements PathRegistryEntry {
  #children: Entry[] = [];
  event: InspectableRunNodeEvent | null = null;
  sidecars: InspectableRunEvent[] = [];

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
    const [head, ...tail] = path;
    if (head === undefined) {
      return;
    }
    let entry = this.#children[head];
    if (!entry) {
      if (tail.length !== 0) {
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
}

export class PathRegistry extends Entry {
  #events: InspectableRunEvent[] = [];
  #eventsIsDirty = false;
  // Keep track of some sidecar events so that we can clean them up later.
  // We only need to keep track of input and output events, since the
  // secret and events do not have a corresponding `nodeend` event.
  #trackedSidecars: Map<string, InspectableRunEvent> = new Map();

  #updateEvents() {
    this.#events = this.children
      .filter(Boolean)
      .flatMap((entry) => [entry.event, ...entry.sidecars])
      .filter(Boolean) as InspectableRunEvent[];
  }

  #traverse(
    readonly: boolean,
    path: number[],
    replacer: PathRegistryEntryUpdater
  ) {
    const entry = this.findOrCreate(readonly, path, path);
    if (!entry) return;
    replacer(entry);
    this.#eventsIsDirty = true;
  }

  cleanUpSecrets() {
    const secret = this.#trackedSidecars.get(
      "secret"
    ) as InspectableRunSecretEvent;
    if (!secret) return;
    this.#trackedSidecars.delete("secret");
    secret.result = null;
  }

  graphstart(path: number[]) {
    this.#traverse(false, path, () => {});
  }

  graphend(path: number[]) {
    this.#traverse(true, path, () => {});
  }

  nodestart(path: number[], data: NodeStartResponse) {
    this.#traverse(
      false,
      path,
      (entry) =>
        (entry.event = {
          type: "node",
          node: data.node,
          start: data.timestamp,
          end: null,
          inputs: data.inputs,
          outputs: null,
          result: null,
          bubbled: false,
          nested: null,
        })
    );
  }

  input(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      const input = result.data as InputResponse;
      const entry: InspectableRunEvent = {
        type: "node",
        node: input.node,
        start: input.timestamp,
        end: null,
        inputs: input.inputArguments,
        outputs: null,
        result,
        bubbled: true,
        nested: null,
      };
      // Add a sidecar to the current last entry in the registry.
      this.children[this.children.length - 1].sidecars.push(entry);
      this.#trackedSidecars.set(path.join("-"), entry);
      this.#eventsIsDirty = true;
    } else {
      this.#traverse(true, path, (entry) => {
        const existing = entry.event;
        if (!existing) {
          console.error("Expected an existing event for", path);
          return;
        }
        existing.result = result;
      });
    }
  }

  output(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      // Create a new entry for the sidecar output event.
      const output = result.data as OutputResponse;
      const entry: InspectableRunEvent = {
        type: "node",
        node: output.node,
        start: output.timestamp,
        end: null,
        inputs: output.outputs,
        outputs: null,
        result,
        bubbled: true,
        nested: null,
      };
      // Add a sidecar to the current last entry in the registry.
      this.children[this.children.length - 1].sidecars.push(entry);
      this.#trackedSidecars.set(path.join("-"), entry);
      this.#eventsIsDirty = true;
    } else {
      this.#traverse(true, path, (entry) => {
        const existing = entry.event;
        if (!existing) {
          console.error("Expected an existing event for", path);
          return;
        }
        existing.inputs = (result.data as OutputResponse).outputs;
      });
    }
  }

  nodeend(path: number[], data: NodeEndResponse) {
    this.#traverse(true, path, (entry) => {
      const existing = entry.event;
      if (!existing) {
        console.error("Expected an existing event for", path);
        return;
      }
      existing.end = data.timestamp;
      existing.outputs = data.outputs;
      existing.result = null;
    });
    const key = path.join("-");
    const sidecar = this.#trackedSidecars.get(key) as InspectableRunNodeEvent;
    if (sidecar) {
      sidecar.end = data.timestamp;
      sidecar.outputs = data.outputs;
      sidecar.result = null;
      this.#trackedSidecars.delete(key);
      this.#eventsIsDirty = true;
    }
  }

  secret(event: InspectableRunSecretEvent) {
    // Add as a sidecar to the current last entry in the registry.
    this.children[this.children.length - 1].sidecars.push(event);
    this.#trackedSidecars.set("secret", event);
    this.#eventsIsDirty = true;
  }

  error(error: InspectableRunErrorEvent) {
    // Add as a sidecar to the current last entry in the registry.
    this.children[this.children.length - 1].sidecars.push(error);
    this.#eventsIsDirty = true;
  }

  events() {
    if (this.#eventsIsDirty) {
      this.#updateEvents();
      this.#eventsIsDirty = false;
    }
    return this.#events;
  }
}
