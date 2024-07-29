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
  InspectableRunInputs,
} from "../types.js";
import { DataStore } from "../../data/types.js";

const isInput = (
  event: InspectableRunEvent
): event is InspectableRunNodeEvent => {
  return (
    event.type === "node" &&
    event.node.descriptor.type === "input" &&
    event.end !== null
  );
};

export class RunObserver implements InspectableRunObserver {
  #store: GraphDescriptorStore;
  #options: RunObserverOptions;
  #runs: Run[] = [];
  #runLimit = 2;
  #restoreRuns: Promise<void> = Promise.resolve();

  constructor(store: GraphDescriptorStore, options: RunObserverOptions) {
    this.#store = store;
    this.#options = options;

    if (this.#options.runStore) {
      this.#restoreRuns = this.#options.runStore
        .getNewestRuns(this.#runLimit)
        .then((runs) => {
          for (let i = 0; i < runs.length; i++) {
            const results = runs[i];

            let run!: Run;
            for (const result of results) {
              if (result.type === "graphstart") {
                const { path, timestamp } = result.data;
                if (path.length === 0) {
                  run = new Run(
                    timestamp,
                    this.#store,
                    result.data.graph,
                    this.#options
                  );
                }
              } else if (result.type === "graphend") {
                const { path, timestamp } = result.data;
                if (path.length === 0) {
                  run.end = timestamp;
                }
              }

              if (!run) {
                console.warn("Unable to restore run");
              }

              this.#options.dataStore?.replaceDataParts(
                run.dataStoreKey,
                result
              );
              run.addResult(result);
            }

            this.#runs.push(run);
          }
        });
    }
  }

  async runs(): Promise<InspectableRun[]> {
    return this.#runs;
  }

  async #storeInRunStore(dataKey: string, result: HarnessRunResult) {
    const { runStore } = this.#options;
    if (!runStore) {
      return Promise.resolve();
    }

    if (result.type === "graphstart") {
      const { path } = result.data;
      if (path.length === 0) {
        const dataKey = Date.now().toFixed(0);
        await runStore?.start(dataKey, this.#runLimit);
      }

      await runStore?.write(result);
    } else if (result.type === "graphend") {
      await runStore?.write(result);

      const { path, timestamp } = result.data;
      const run = this.#runs[0];
      if (path.length === 0) {
        await runStore?.stop();
        run.end = timestamp;
      }
    } else if (result.type === "error") {
      await runStore?.abort();
    } else if (result.type !== "end") {
      await runStore?.write(result);
    }
  }

  async observe(result: HarnessRunResult): Promise<void> {
    await this.#restoreRuns;

    if (result.type === "graphstart") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        const run = new Run(
          timestamp,
          this.#store,
          result.data.graph,
          this.#options
        );

        if (!this.#options.skipDataStore) {
          this.#options.dataStore?.createGroup(run.dataStoreKey);
        }

        this.#runs.unshift(run);

        if (this.#runs.length > this.#runLimit) {
          const groupIds = this.#runs
            .slice(this.#runLimit)
            .map((run) => run.dataStoreKey);
          for (const groupId of groupIds) {
            if (this.#options.skipDataStore) {
              continue;
            }

            this.#options.dataStore?.releaseGroup(groupId);
          }
          this.#runs.length = this.#runLimit;
        }
      }
    }

    const run = this.#runs[0];
    if (!run) {
      console.warn("No run available");
    }

    if (!this.#options.skipDataStore) {
      this.#options.dataStore?.replaceDataParts(run.dataStoreKey, result);
    }

    run.addResult(result);
    await this.#storeInRunStore(run.dataStoreKey, result);
  }

  async load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): Promise<InspectableRunLoadResult> {
    if (!this.#options.dataStore) {
      throw new Error(
        "No data store provided to RunObserver, unable to load runs"
      );
    }
    const loader = new RunLoader(this.#options.dataStore, o, options || {});
    return await loader.load();
  }
}

export class Run implements InspectableRun {
  public readonly dataStoreKey = crypto.randomUUID();

  #events: EventManager;

  graphId: GraphUUID;
  start: number;
  end: number | null = null;
  graphVersion: number;
  messages: HarnessRunResult[] = [];
  #dataStore: DataStore | null;

  constructor(
    timestamp: number,
    graphStore: GraphDescriptorStore,
    graph: GraphDescriptor,
    options: RunObserverOptions
  ) {
    this.#events = new EventManager(graphStore, options);
    this.#dataStore = options.dataStore || null;
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

  async serialize(options?: RunSerializationOptions): Promise<SerializedRun> {
    let data = null;
    if (this.#dataStore) {
      data = await this.#dataStore.serializeGroup(this.dataStoreKey);
    }

    return this.#events.serialize(data, options || {});
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    return this.#events.getEventById(id);
  }

  inputs(): InspectableRunInputs | null {
    const result: InspectableRunInputs = new Map();
    this.#events.events.forEach((event) => {
      if (!isInput(event)) return;
      if (event.bubbled) return;
      const id = event.node.descriptor.id;
      let inputList = result.get(id);
      if (!inputList) {
        inputList = [];
        result.set(id, inputList);
      }
      inputList.push(event.outputs || {});
    });

    return result.size > 0 ? result : null;
  }

  replay(): AsyncGenerator<HarnessRunResult> {
    throw new Error("Runs can't yet be replayed.");
  }
}
