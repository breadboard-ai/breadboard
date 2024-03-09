/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import {
  GraphStartProbeData,
  InputResponse,
  InputValues,
  NodeDescriptor,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  OutputValues,
} from "../types.js";
import { PathRegistry, SECRET_PATH, ERROR_PATH } from "./path-registry.js";
import {
  InspectableGraphStore,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  PathRegistryEntry,
} from "./types.js";

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

  get nested() {
    return this.#entry?.nested() || [];
  }
}

export class EventManager {
  #graphStore;
  #pathRegistry = new PathRegistry();

  constructor(store: InspectableGraphStore) {
    this.#graphStore = store;
  }

  #addGraphstart(data: GraphStartProbeData) {
    const { path, graph } = data;
    const graphId = this.#graphStore.add(graph);
    const entry = this.#pathRegistry.create(path);
    if (entry) entry.graphId = graphId;
  }

  #addGraphend(path: number[]) {
    this.#pathRegistry.find(path);
    console.groupCollapsed("🌻 Graph Registry");
    console.log(this.#graphStore);
    console.groupEnd();
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
      existing.result = result;
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
    existing.end = data.timestamp;
    existing.outputs = data.outputs;
    existing.result = null;
    this.#pathRegistry.finalizeSidecar(path, data);
  }

  #addSecret(event: InspectableRunSecretEvent) {
    this.#pathRegistry.addSidecar(SECRET_PATH, event);
  }

  #addError(error: InspectableRunErrorEvent) {
    this.#pathRegistry.addSidecar(ERROR_PATH, error);
  }

  add(result: HarnessRunResult) {
    this.#pathRegistry.finalizeSidecar(SECRET_PATH);

    switch (result.type) {
      case "graphstart": {
        // TODO: Figure out what to do with these.
        this.#addGraphstart(result.data);
        break;
      }
      case "graphend": {
        // TODO: Figure out what to do with these.
        this.#addGraphend(result.data.path);
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
          result,
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
