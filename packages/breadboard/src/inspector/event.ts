/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { NodeEndResponse, NodeStartResponse } from "../types.js";
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

class PathRegistry {
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

export class EventManager {
  #registry = new PathRegistry();
  #level = 0;

  add(result: HarnessRunResult) {
    // Clean up after the `secret` event.
    // const maybeSecret = this.#events[this.#events.length - 1];
    // if (maybeSecret && maybeSecret.type === "secret") {
    //   maybeSecret.result = null;
    // }

    switch (result.type) {
      case "graphstart": {
        this.#registry.graphstart(result.data.path);
        this.#level++;
        break;
      }
      case "graphend": {
        this.#registry.graphend(result.data.path);
        this.#level--;
        break;
      }
      case "nodestart": {
        this.#registry.nodestart(result.data.path, result.data);
        break;
      }
      case "input": {
        // const last = this.#events[this.#events.length - 1];
        // if (last.type !== "node" || last.node.type !== result.type) {
        //   // This is a bubbled input.
        //   // Create a "bubbled" event for it.
        //   const event: EventWithPath = {
        //     type: "node",
        //     node: result.data.node,
        //     start: result.data.timestamp,
        //     // Because it is bubbled, it will not have a corresponding
        //     // "nodeend" event.
        //     end: result.data.timestamp,
        //     inputs: result.data.inputArguments,
        //     // TODO: Find a way to populate this field. Currently, this event
        //     // will have no outputs.
        //     outputs: null,
        //     result,
        //     bubbled: true,
        //     nested: null,
        //     path: [],
        //   };
        //   this.#events = [...this.#events, event];
        // }
        break;
      }
      case "secret": {
        this.#registry.secret({
          type: "secret",
          data: result.data,
          result,
        });
        break;
      }
      case "nodeend": {
        this.#registry.nodeend(result.data.path, result.data);
        break;
      }
      case "error": {
        this.#registry.error({
          type: "error",
          error: result.data,
        });
        break;
      }
    }
  }

  get events(): InspectableRunEvent[] {
    return this.#registry.events();
  }
}
