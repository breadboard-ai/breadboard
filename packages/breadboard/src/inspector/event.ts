/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
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
import {
  ERROR_PATH,
  PathRegistry,
  SECRET_PATH,
  idFromPath,
} from "./path-registry.js";
import {
  EventIdentifier,
  GraphUUID,
  InspectableGraphStore,
  InspectableRun,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  PathRegistryEntry,
} from "./types.js";

const eventIdFromEntryId = (entryId?: string): string => {
  return `e-${entryId || "0"}`;
};

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

  get id(): EventIdentifier {
    return eventIdFromEntryId(this.#entry?.id);
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
  #pathRegistry = new PathRegistry([]);

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

  #addNodestart(data: NodeStartResponse) {
    const { node, timestamp, inputs, path } = data;
    const entry = this.#pathRegistry.create(path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    const event = new RunNodeEvent(entry, node, timestamp, inputs);
    entry.event = event;
  }

  #addInput(data: InputResponse) {
    const { path, bubbled, inputArguments, node, timestamp } = data;
    if (bubbled) {
      const event = new RunNodeEvent(null, node, timestamp, inputArguments);
      event.bubbled = true;
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

  #addOutput(data: OutputResponse) {
    const { path, bubbled, node, timestamp, outputs } = data;
    if (bubbled) {
      // Create a new entry for the sidecar output event.
      const event = new RunNodeEvent(null, node, timestamp, outputs);
      event.bubbled = true;
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
      existing.inputs = data.outputs;
    }
  }

  #addNodeend(data: NodeEndResponse) {
    const { path } = data;
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
        this.#addNodestart(result.data);
        break;
      }
      case "input": {
        this.#addInput(result.data);
        break;
      }
      case "output": {
        this.#addOutput(result.data);
        break;
      }
      case "secret": {
        const { timestamp: start, keys } = result.data;
        this.#addSecret({
          id: eventIdFromEntryId(idFromPath(SECRET_PATH)),
          type: "secret",
          keys,
          start,
          end: null,
        });
        break;
      }
      case "nodeend": {
        this.#addNodeend(result.data);
        break;
      }
      case "error": {
        const { timestamp: start, error } = result.data;
        this.#addError({
          id: eventIdFromEntryId(idFromPath(ERROR_PATH)),
          type: "error",
          start,
          error,
        });
        break;
      }
    }
  }

  get events(): InspectableRunEvent[] {
    return this.#pathRegistry.events;
  }
}
