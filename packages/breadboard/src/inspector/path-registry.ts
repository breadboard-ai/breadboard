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
  path: number[];
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

const traverse = (
  readonly: boolean,
  registry: PathRegistryEntry[],
  fullPath: number[],
  path: number[],
  updater: PathRegistryEntryUpdater
) => {
  const [head, ...tail] = path;
  if (head === undefined) {
    return;
  }
  let entry = registry[head];
  if (!entry) {
    if (tail.length !== 0) {
      console.warn("Path registry entry not found for", path, "in", fullPath);
    }
    if (readonly) {
      console.warn("Path registry is read-only. Not adding", fullPath);
      return;
    }
    entry = registry[head] = {
      path: [],
      children: [],
      event: null,
      sidecars: [],
    };
  }
  if (tail.length === 0) {
    updater(entry);
    return;
  }
  traverse(readonly, entry.children, fullPath, tail, updater);
};

export class PathRegistry {
  registry: PathRegistryEntry[] = [];
  #events: InspectableRunEvent[] = [];
  #eventsIsDirty = false;
  // Keep track of some sidecar events so that we can clean them up later.
  // We only need to keep track of input and output events, since the
  // secret and events do not have a corresponding `nodeend` event.
  #trackedSidecars: Map<string, InspectableRunEvent> = new Map();

  #updateEvents() {
    this.#events = this.registry
      .filter(Boolean)
      .flatMap((entry) => [entry.event, ...entry.sidecars])
      .filter(Boolean) as InspectableRunEvent[];
  }

  #traverse(
    readonly: boolean,
    path: number[],
    replacer: PathRegistryEntryUpdater
  ) {
    traverse(readonly, this.registry, path, path, replacer);
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
      this.registry[this.registry.length - 1].sidecars.push(entry);
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
      this.registry[this.registry.length - 1].sidecars.push(entry);
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
    this.registry[this.registry.length - 1].sidecars.push(event);
    this.#trackedSidecars.set("secret", event);
    this.#eventsIsDirty = true;
  }

  error(error: InspectableRunErrorEvent) {
    // Add as a sidecar to the current last entry in the registry.
    this.registry[this.registry.length - 1].sidecars.push(error);
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
