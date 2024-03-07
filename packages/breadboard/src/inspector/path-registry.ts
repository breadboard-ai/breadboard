/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { InputResponse, NodeEndResponse, NodeStartResponse } from "../types.js";
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
  after: InspectableRunEvent[];
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
      after: [],
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

  #updateEvents() {
    this.#events = this.registry
      .filter(Boolean)
      .flatMap((entry) => [entry.event, ...entry.after])
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
    console.log("INPUT", path, result, bubbled);
    if (bubbled) {
      const input = result.data as InputResponse;
      // Add a sidecar to the current last entry in the registry.
      this.registry[this.registry.length - 1].after.push({
        type: "node",
        node: input.node,
        start: input.timestamp,
        end: null,
        inputs: input.inputArguments,
        outputs: null,
        result,
        bubbled: true,
        nested: null,
      });
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
  }

  secret(event: InspectableRunSecretEvent) {
    // Add as a sidecar to the current last entry in the registry.
    this.registry[this.registry.length - 1].after.push(event);
    this.#eventsIsDirty = true;
  }

  error(error: InspectableRunErrorEvent) {
    // Add as a sidecar to the current last entry in the registry.
    this.registry[this.registry.length - 1].after.push(error);
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
