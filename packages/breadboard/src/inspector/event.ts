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
import { PathRegistry, SECRET_PATH, ERROR_PATH } from "./path-registry.js";
import {
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
  #registry = new PathRegistry();

  #addGraphstart(path: number[]) {
    this.#registry.create(path);
  }

  #addGraphend(path: number[]) {
    const entry = this.#registry.find(path);
    console.log("Graphend", path, entry);
  }

  #addNodestart(path: number[], result: HarnessRunResult) {
    const entry = this.#registry.create(path);
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
      this.#registry.addSidecar(path, event);
    } else {
      const entry = this.#registry.find(path);
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
      this.#registry.addSidecar(path, event);
    } else {
      const entry = this.#registry.find(path);
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
    const entry = this.#registry.find(path);
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
    this.#registry.finalizeSidecar(path, data);
  }

  #addSecret(event: InspectableRunSecretEvent) {
    this.#registry.addSidecar(SECRET_PATH, event);
  }

  #addError(error: InspectableRunErrorEvent) {
    this.#registry.addSidecar(ERROR_PATH, error);
  }

  add(result: HarnessRunResult) {
    this.#registry.finalizeSidecar(SECRET_PATH);

    switch (result.type) {
      case "graphstart": {
        // TODO: Figure out what to do with these.
        this.#addGraphstart(result.data.path);
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
    return this.#registry.events;
  }
}
