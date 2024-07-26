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
import {
  asBlob,
  isInlineData,
  isLLMContent,
  isStoredData,
} from "../../data/index.js";

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

  constructor(store: GraphDescriptorStore, options: RunObserverOptions) {
    this.#store = store;
    this.#options = options;
  }

  async runs(): Promise<InspectableRun[]> {
    return this.#runs;
  }

  async observe(result: HarnessRunResult): Promise<void> {
    if (this.#options.runStore) {
      const { runStore } = this.#options;
      if (result.type === "graphstart") {
        const { path } = result.data;
        if (path.length === 0) {
          await runStore.start(Date.now().toFixed(0));
        }

        await runStore.write(result);
      } else if (result.type === "graphend") {
        await runStore.write(result);

        const { path } = result.data;
        if (path.length === 0) {
          await runStore.stop();
        }
      } else if (result.type === "error") {
        await runStore.abort();
      } else if (result.type !== "end") {
        await runStore.write(result);
      }

      const runs = await this.#options.runStore.getNewestRuns(2);
      this.#runs = runs
        .filter((results) => {
          return results.some((result) => result.type === "graphstart");
        })
        .map((results) => {
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
            }

            run.addResult(result);
          }

          if (!run) {
            throw new Error("Run was not created");
          }

          return run;
        });
    } else {
      if (result.type === "graphstart") {
        const { path, timestamp } = result.data;
        if (path.length === 0) {
          this.#options.store?.startGroup();
          // start a new run
          const run = new Run(
            timestamp,
            this.#store,
            result.data.graph,
            this.#options
          );
          // For now, confine the `runs` array to two runs.
          if (this.#runs.length === 0) {
            this.#runs = [run];
          } else {
            if (this.#runs.length === 2) {
              const removedRun = this.#runs.pop();
              this.#options.store?.releaseGroup(removedRun!.dataStoreGroupId);
            }
            this.#runs = [run, this.#runs[0]];
          }
        }
      } else if (result.type === "graphend") {
        const { path, timestamp } = result.data;
        if (path.length === 0) {
          // close out the run
          const run = this.#runs[0];
          run.end = timestamp;

          const dataStoreGroupId = this.#options.store?.endGroup();
          run.dataStoreGroupId =
            dataStoreGroupId !== undefined ? dataStoreGroupId : -1;
        }
      }

      await this.#storeInlineData(result);

      const run = this.#runs[0];
      run.addResult(result);
    }
  }

  async #storeInlineData(result: HarnessRunResult): Promise<void> {
    if (result.type !== "nodeend" || result.data.node.type !== "input") {
      return;
    }

    if (!this.#options.store) {
      return;
    }

    for (const value of Object.values(result.data.outputs)) {
      if (!isLLMContent(value)) {
        continue;
      }

      for (let i = 0; i < value.parts.length; i++) {
        const part = value.parts[i];
        if (isInlineData(part)) {
          const blob = await asBlob(part);
          value.parts[i] = await this.#options.store.store(blob);
        } else if (isStoredData(part)) {
          value.parts[i] = await this.#options.store.copyToNewestGroup(part);
        }
      }
    }
  }

  async load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): Promise<InspectableRunLoadResult> {
    if (!this.#options.store) {
      throw new Error(
        "No data store provided to RunObserver, unable to load runs"
      );
    }
    const loader = new RunLoader(this.#options.store, o, options || {});
    return await loader.load();
  }
}

export class Run implements InspectableRun {
  #events: EventManager;

  graphId: GraphUUID;
  start: number;
  end: number | null = null;
  graphVersion: number;
  messages: HarnessRunResult[] = [];
  dataStoreGroupId: number = -1;
  #dataStore: DataStore | null;

  constructor(
    timestamp: number,
    graphStore: GraphDescriptorStore,
    graph: GraphDescriptor,
    options: RunObserverOptions
  ) {
    this.#events = new EventManager(graphStore, options);
    this.#dataStore = options.store || null;
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
    if (this.dataStoreGroupId !== -1 && this.#dataStore) {
      data = await this.#dataStore.serializeGroup(this.dataStoreGroupId);
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
