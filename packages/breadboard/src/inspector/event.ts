/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { timestamp } from "../timestamp.js";
import {
  GraphEndProbeData,
  GraphStartProbeData,
  InputResponse,
  InputValues,
  NodeDescriptor,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  OutputValues,
} from "../types.js";
import { PathRegistry, SECRET_PATH } from "./path-registry.js";
import {
  GraphUUID,
  InspectableGraphStore,
  InspectableRun,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  PathRegistryEntry,
} from "./types.js";

/**
 * Meant to be a very lightweight wrapper around the
 * data in the `PathRegistryEntry`.
 */
class NestedRun implements InspectableRun {
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

  currentNode(): string {
    return "";
  }
}

class RunNodeEvent implements InspectableRunNodeEvent {
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

  get runs(): InspectableRun[] {
    if (!this.#entry || this.#entry.empty()) {
      return [];
    }
    const entry = this.#entry;
    const events = entry.events;
    // a bit of a hack: what I actually need is to find out whether this is
    // a map or not.
    // Maps have a peculiar structure: their children will have no events, but
    // their children's children (the parallel runs) will have events.
    if (events.length > 0) {
      // This is an ordinary run.
      return [new NestedRun(entry)];
    } else {
      // This is a map.
      return entry.children.filter(Boolean).map((childEntry) => {
        return new NestedRun(childEntry);
      });
    }
  }
}

export class EventManager {
  #graphStore;
  #pathRegistry = new PathRegistry();

  constructor(store: InspectableGraphStore) {
    this.#graphStore = store;
  }

  #addGraphstart(data: GraphStartProbeData) {
    const { path, graph, timestamp } = data;
    const graphId = this.#graphStore.add(graph, 0);
    const entry = this.#pathRegistry.create(path);
    if (entry) {
      entry.graphId = graphId;
      entry.graphStart = timestamp;
    }
  }

  #addGraphend(data: GraphEndProbeData) {
    const { path, timestamp } = data;
    const entry = this.#pathRegistry.find(path);
    if (!entry) {
      if (path.length > 0) {
        throw new Error(
          `Expected an existing entry for ${JSON.stringify(path)}`
        );
      }
      return;
    }
    entry.graphEnd = timestamp;
  }

  #addNodestart(path: number[], result: HarnessRunResult) {
    const entry = this.#pathRegistry.create(path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    const { node, timestamp, inputs } = result.data as NodeStartResponse;
    const event = new RunNodeEvent(entry, node, timestamp, inputs);
    entry.event = event;
  }

  #addInput(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      const input = result.data as InputResponse;
      const event = new RunNodeEvent(
        null,
        input.node,
        input.timestamp,
        input.inputArguments
      );
      event.bubbled = true;
      event.result = result;
      this.#pathRegistry.addSidecar(path, event);
    } else {
      const entry = this.#pathRegistry.find(path);
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
    }
  }

  #addOutput(path: number[], result: HarnessRunResult, bubbled: boolean) {
    if (bubbled) {
      // Create a new entry for the sidecar output event.
      const output = result.data as OutputResponse;
      const event = new RunNodeEvent(
        null,
        output.node,
        output.timestamp,
        output.outputs
      );
      event.bubbled = true;
      event.result = result;
      this.#pathRegistry.addSidecar(path, event);
    } else {
      const entry = this.#pathRegistry.find(path);
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
      if (existing.type !== "node") {
        throw new Error(
          `Expected an existing event to be of type "node", but got ${existing.type}`
        );
      }
      existing.inputs = (result.data as OutputResponse).outputs;
    }
  }

  #addNodeend(path: number[], data: NodeEndResponse) {
    const entry = this.#pathRegistry.find(path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    const existing = entry.event;
    if (!existing) {
      console.error("Expected an existing event for", path);
      return;
    }
    if (existing.type !== "node") {
      throw new Error(
        `Expected an existing event to be of type "node", but got ${existing.type}`
      );
    }
    existing.end = data.timestamp;
    existing.outputs = data.outputs;
    this.#pathRegistry.finalizeSidecar(path, data);
  }

  #addSecret(event: InspectableRunSecretEvent) {
    this.#pathRegistry.addSidecar(SECRET_PATH, event);
  }

  #addError(error: InspectableRunErrorEvent) {
    this.#pathRegistry.addError(error);
  }

  add(result: HarnessRunResult) {
    this.#pathRegistry.finalizeSidecar(SECRET_PATH);

    switch (result.type) {
      case "graphstart": {
        this.#addGraphstart(result.data);
        break;
      }
      case "graphend": {
        this.#addGraphend(result.data);
        break;
      }
      case "nodestart": {
        this.#addNodestart(result.data.path, result);
        break;
      }
      case "input": {
        this.#addInput(result.data.path, result, result.data.bubbled);
        break;
      }
      case "output": {
        this.#addOutput(result.data.path, result, result.data.bubbled);
        break;
      }
      case "secret": {
        this.#addSecret({
          type: "secret",
          data: result.data,
          start: timestamp(),
          end: null,
        });
        break;
      }
      case "nodeend": {
        this.#addNodeend(result.data.path, result.data);
        break;
      }
      case "error": {
        this.#addError({
          type: "error",
          error: result.data,
        });
        break;
      }
    }
  }

  get events(): InspectableRunEvent[] {
    return this.#pathRegistry.events;
  }
}
