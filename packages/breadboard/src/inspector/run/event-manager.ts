/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult, SecretResult } from "../../harness/types.js";
import type {
  EdgeResponse,
  GraphEndProbeData,
  GraphStartProbeData,
  NodeEndResponse,
  NodeStartResponse,
  TraversalResult,
} from "@breadboard-ai/types";
import {
  ErrorResponse,
  InputResponse,
  NodeConfiguration,
  NodeDescriptor,
  OutputResponse,
} from "../../types.js";
import {
  ERROR_PATH,
  PathRegistry,
  SECRET_PATH,
  createSimpleEntry,
} from "./path-registry.js";
import { RunNodeEvent } from "./run-node-event.js";
import { RunSerializer, SequenceEntry } from "./serializer.js";
import {
  EventIdentifier,
  InspectableRunEdge,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  MutableGraphStore,
  PathRegistryEntry,
  RunObserverLogLevel,
  RunObserverOptions,
  RunSerializationOptions,
  TimelineEntry,
} from "../types.js";
import { SerializedDataStoreGroup } from "../../data/types.js";
import {
  entryIdFromEventId,
  eventIdFromEntryId,
  eventsAsHarnessRunResults,
  idFromPath,
  pathFromId,
} from "./conversions.js";
import { ReanimationState } from "../../run/types.js";
import { LifecycleManager } from "../../run/lifecycle.js";

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
  #serializer = new RunSerializer();
  #sequence: SequenceEntry[] = [];
  #currentNodeEvent: RunNodeEvent | null = null;

  constructor(store: MutableGraphStore, options: RunObserverOptions) {
    this.#graphStore = store;
    this.#options = options;
  }

  #addToSequence(type: TimelineEntry[0], entry: PathRegistryEntry) {
    this.#sequence.push([type, entry]);
  }

  #addGraphstart(data: GraphStartProbeData) {
    const { path, graph, graphId = "", timestamp } = data;
    const adding = this.#graphStore.getByDescriptor(graph);
    if (!adding.success) {
      return;
    }
    const mainGraphId = adding.result;
    const entry = this.#pathRegistry.create(path);
    entry.mainGraphId = mainGraphId;
    entry.graphId = graphId;
    entry.graphStart = timestamp;
    entry.view = {
      // Math: The start index is the length of the sequence before the
      // graphstart event is added.
      start: this.#sequence.length,
      sequence: this.#sequence,
    };
    // TODO: Instead of creating a new instance, cache and store them
    // in the GraphStore.
    const inspector = this.#graphStore.inspectSnapshot(graph, graphId);
    if (inspector) {
      entry.graph = inspector;
    } else {
      throw new Error(
        `Run API Integrity error: unable to get InspectableGraph for "${mainGraphId}", "${graphId}"`
      );
    }
    this.#addToSequence("graphstart", entry);
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
    this.#addToSequence("graphend", entry);
  }

  #addEdge(data: EdgeResponse) {
    const { edge, to, value: allValues } = data;
    const entry = this.#pathRegistry.create(to.slice(0, -1));
    // Only store the value for this particular edge.
    let value = allValues;
    if (!edge.in) {
      if (!edge.out) {
        value = undefined;
      }
    } else {
      const edgeValue = allValues ? allValues[edge.in] : null;
      value = edgeValue ? { [edge.in]: edgeValue } : undefined;
    }
    entry.edges.push({ ...data, value });
  }

  #addNodestart(data: NodeStartResponse, result?: TraversalResult) {
    const { node, timestamp, inputs, path } = data;
    const entry = this.#pathRegistry.create(path);

    if (!entry) {
      throw new Error(`Expected an existing entry for ${JSON.stringify(path)}`);
    }

    const event = new RunNodeEvent(entry, node, timestamp, inputs, result);
    event.hidden = shouldSkipEvent(
      this.#options,
      node,
      entry.path.length === 1
    );
    entry.event = event;
    this.#addToSequence("nodestart", entry);
    this.#currentNodeEvent = event;
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
      this.#addToSequence("input", createSimpleEntry(path, event));
    } else {
      const existing = entry.event;
      if (!existing) {
        console.error("Expected an existing event for", path);
        return;
      }
      this.#addToSequence("input", entry);
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
      this.#addToSequence("output", createSimpleEntry(path, event));
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
      this.#addToSequence("output", entry);
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
    this.#addToSequence("nodeend", entry);
  }

  #addSecret(data: SecretResult["data"]) {
    const { timestamp: start, keys } = data;
    const id = idFromPath(SECRET_PATH);
    const event: InspectableRunSecretEvent = {
      id: eventIdFromEntryId(id),
      type: "secret",
      keys,
      start,
      end: null,
    };
    this.#pathRegistry.addSidecar(SECRET_PATH, event);
    this.#addToSequence("secret", createSimpleEntry(SECRET_PATH, event));
  }

  #addError(data: ErrorResponse) {
    const { timestamp: start, error } = data;
    const id = idFromPath(ERROR_PATH);
    const event: InspectableRunErrorEvent = {
      id: eventIdFromEntryId(id),
      type: "error",
      start,
      error,
    };
    this.#pathRegistry.addError(event);
    this.#addToSequence("error", createSimpleEntry(ERROR_PATH, event));
  }

  resume(result?: HarnessRunResult) {
    this.#pathRegistry.finalizeSidecar(SECRET_PATH, result?.data);
  }

  add(result: HarnessRunResult) {
    this.resume(result);

    switch (result.type) {
      case "graphstart":
        return this.#addGraphstart(result.data);
      case "edge":
        return this.#addEdge(result.data);
      case "graphend":
        return this.#addGraphend(result.data);
      case "nodestart":
        return this.#addNodestart(result.data, result.result);
      case "input":
        return this.#addInput(result.data);
      case "output":
        return this.#addOutput(result.data);
      case "secret":
        return this.#addSecret(result.data);
      case "nodeend":
        return this.#addNodeend(result.data);
      case "error":
        return this.#addError(result.data);
    }
  }

  get events(): InspectableRunEvent[] {
    return this.#pathRegistry.events;
  }

  get edges(): InspectableRunEdge[] {
    return this.#pathRegistry.edges;
  }

  currentEvent(): InspectableRunNodeEvent | null {
    return this.#currentNodeEvent;
  }

  serialize(
    data: SerializedDataStoreGroup | null,
    options: RunSerializationOptions
  ) {
    return this.#serializer.serialize(this.#sequence, data, options);
  }

  serializer() {
    return this.#serializer;
  }

  async *replay() {
    yield* eventsAsHarnessRunResults(this.#sequence);
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    const entryId = entryIdFromEventId(id);
    if (!entryId) return null;
    const path = pathFromId(entryId);
    const entry = this.#pathRegistry.find(path);
    return entry?.event || null;
  }

  async reanimationStateAt(
    id: EventIdentifier,
    nodeConfig: NodeConfiguration
  ): Promise<ReanimationState> {
    const manager = new LifecycleManager();
    for (const [index, entry] of this.#sequence.entries()) {
      const [type, data] = entry;
      switch (type) {
        case "graphstart": {
          // TODO: Figure out if I need to do anything about the URL here.
          manager.dispatchGraphStart("", data.path);
          break;
        }
        case "nodestart": {
          const event = data.event as RunNodeEvent;
          const traversalResult = event.traversalResult;
          if (!traversalResult) {
            console.warn(`No traversal result for ${data.event?.id}`);
          } else {
            manager.dispatchNodeStart(traversalResult, data.path);
          }
          if (event.id === id) {
            const reanimationState = manager.reanimationState();
            reanimationState.history = this.#sequence.slice(0, index + 1);
            reanimationState.nodeConfig = nodeConfig;
            return reanimationState;
          }
          break;
        }
        case "nodeend": {
          // const event = data.event as RunNodeEvent;
          // manager.dispatchNodeEnd(event.outputs!, data.path);
          break;
        }
      }
    }
    throw new Error(
      `The event identifier "${id}" was not found in event sequence`
    );
  }
}
