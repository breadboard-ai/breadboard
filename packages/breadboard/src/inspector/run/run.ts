/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import { GraphDescriptor } from "../../types.js";
import { EventManager } from "./event-manager.js";
import { RunLoader } from "./loader.js";
import {
  EventIdentifier,
  GraphUUID,
  GraphDescriptorStore,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunLoadResult,
  InspectableRunObserver,
  RunObserverOptions,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunLoadingOptions,
  InspectableRunNodeEvent,
} from "../types.js";

export class RunObserver implements InspectableRunObserver {
  #store: GraphDescriptorStore;
  #options: RunObserverOptions;
  #runs: Run[] = [];

  constructor(store: GraphDescriptorStore, options: RunObserverOptions) {
    this.#store = store;
    this.#options = options;
  }

  runs() {
    return this.#runs;
  }

  observe(result: HarnessRunResult): InspectableRun[] {
    if (result.type === "graphstart") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        // start a new run
        const run = new Run(
          timestamp,
          this.#store,
          result.data.graph,
          this.#options
        );
        this.#runs = [run, ...this.#runs];
      }
    } else if (result.type === "graphend") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        // close out the run
        const run = this.#runs[0];
        run.end = timestamp;
      }
    }
    const run = this.#runs[0];
    run.addResult(result);
    return this.#runs;
  }

  load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): InspectableRunLoadResult {
    const loader = new RunLoader(o, options || {});
    return loader.load(this);
  }
}

export class Run implements InspectableRun {
  #events: EventManager;

  graphId: GraphUUID;
  start: number;
  end: number | null = null;
  graphVersion: number;
  messages: HarnessRunResult[] = [];

  constructor(
    timestamp: number,
    graphStore: GraphDescriptorStore,
    graph: GraphDescriptor,
    options: RunObserverOptions
  ) {
    this.#events = new EventManager(graphStore, options);
    this.graphVersion = 0;
    this.start = timestamp;
    this.graphId = graphStore.add(graph, this.graphVersion).id;
  }

  get events(): InspectableRunEvent[] {
    return this.#events.events;
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    return this.#events.currentEvent();
  }

  stack(): InspectableRunNodeEvent[] {
    // TODO: Implement full stack. For now, just return the top-level item.
    const getLastNodeEVent = () => {
      const events = this.#events.events;
      for (let i = events.length - 1; i >= 0; i--) {
        const maybeNodeEvent = events[i];
        if (maybeNodeEvent.type === "node" && !maybeNodeEvent.bubbled)
          return maybeNodeEvent;
      }
      return null;
    };
    const lastNodeEvent = getLastNodeEVent();
    return lastNodeEvent ? [lastNodeEvent] : [];
  }

  addResult(result: HarnessRunResult) {
    this.#events.add(result);
  }

  serialize(options?: RunSerializationOptions): SerializedRun {
    return this.#events.serialize(options || {});
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    return this.#events.getEventById(id);
  }
}
