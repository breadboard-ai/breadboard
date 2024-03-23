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
  NodeDescriptor,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
} from "../types.js";
import { inspectableGraph } from "./graph.js";
import {
  ERROR_PATH,
  PathRegistry,
  SECRET_PATH,
  idFromPath,
} from "./path-registry.js";
import { RunNodeEvent, eventIdFromEntryId } from "./run-node-event.js";
import {
  InspectableGraphStore,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunSecretEvent,
  RunObserverLogLevel,
  RunObserverOptions,
} from "./types.js";

const shouldSkipEvent = (
  options: RunObserverOptions,
  node: NodeDescriptor,
  isTopLevel: boolean
): boolean => {
  // Never skip input or output events.
  if (isTopLevel && (node.type === "input" || node.type === "output"))
    return false;

  const isAskingForDebug = !!options.logLevel && options.logLevel == "debug";
  // If asking for debug, show all events, regardless of the node's log level.
  if (isAskingForDebug) return false;

  const nodelogLevel =
    (node.metadata?.logLevel as RunObserverLogLevel) || "debug";
  return nodelogLevel !== "info";
};

export class EventManager {
  #graphStore;
  #options;
  #pathRegistry = new PathRegistry();

  constructor(store: InspectableGraphStore, options: RunObserverOptions) {
    this.#graphStore = store;
    this.#options = options;
  }

  #addGraphstart(data: GraphStartProbeData) {
    const { path, graph, timestamp } = data;
    const graphId = this.#graphStore.add(graph, 0);
    const entry = this.#pathRegistry.create(path);
    if (entry) {
      entry.graphId = graphId;
      entry.graphStart = timestamp;
      // TODO: Instead of creating a new instance, cache and store them
      // in the GraphStore.
      entry.graph = inspectableGraph(graph, { kits: this.#options.kits });
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
    event.hidden = shouldSkipEvent(
      this.#options,
      node,
      entry.path.length === 1
    );
    entry.event = event;
  }

  #addInput(data: InputResponse) {
    const { path, bubbled, inputArguments, node, timestamp } = data;
    const entry = this.#pathRegistry.find(path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    if (bubbled) {
      const event = new RunNodeEvent(entry, node, timestamp, inputArguments);
      event.bubbled = true;
      this.#pathRegistry.addSidecar(path, event);
    } else {
      const existing = entry.event;
      if (!existing) {
        console.error("Expected an existing event for", path);
        return;
      }
    }
  }

  #addOutput(data: OutputResponse) {
    const { path, bubbled, node, timestamp, outputs } = data;
    const entry = this.#pathRegistry.find(path);
    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }
    if (bubbled) {
      const event = new RunNodeEvent(entry, node, timestamp, outputs);
      event.bubbled = true;
      this.#pathRegistry.addSidecar(path, event);
    } else {
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
      // This is an event that was skipped because the log levels didn't
      // match.
      this.#pathRegistry.finalizeSidecar(path, data);
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
