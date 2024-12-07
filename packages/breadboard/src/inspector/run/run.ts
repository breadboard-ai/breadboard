/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStore, RunTimestamp, RunURL } from "../../data/types.js";
import { HarnessRunResult } from "../../harness/types.js";
import {
  GraphDescriptor,
  NodeConfiguration,
  NodeIdentifier,
} from "../../types.js";
import {
  EventIdentifier,
  InspectableRun,
  InspectableRunEdge,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunLoadResult,
  InspectableRunNodeEvent,
  InspectableRunObserver,
  InspectableRunSequenceEntry,
  MutableGraphStore,
  RunObserverOptions,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunLoadingOptions,
} from "../types.js";
import { eventsAsHarnessRunResults } from "./conversions.js";
import { EventManager } from "./event-manager.js";
import { RunLoader } from "./loader.js";

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
  #store: MutableGraphStore;
  #options: RunObserverOptions;
  #runs: InspectableRun[] = [];
  #runLimit = 2;
  #url: RunURL | null = null;
  #timestamp: RunTimestamp | null = null;

  constructor(store: MutableGraphStore, options: RunObserverOptions) {
    this.#store = store;
    this.#options = options;
  }

  async runs(): Promise<InspectableRun[]> {
    return this.#runs;
  }

  async #convertRunInfoToRuns(
    url: RunURL,
    runInfo: Map<RunTimestamp, HarnessRunResult[]>
  ): Promise<Run[]> {
    const runs = await Promise.all(
      [...runInfo]
        .filter(([, events]) => events.length > 0)
        .sort(([timeA], [timeB]) => {
          return timeB - timeA;
        })
        .map(async ([timestamp, results]) => {
          let run!: Run;

          for (const result of results) {
            if (result.type === "graphstart") {
              const { path } = result.data;
              if (path.length === 0) {
                run = new Run(
                  timestamp,
                  this.#store,
                  result.data.graph,
                  this.#options
                );

                run.dataStoreKey = `${url}-${timestamp}`;
                const { dataStore, skipDataStore } = this.#options;
                if (!skipDataStore && dataStore) {
                  // If a group with this key already exists, let's just
                  // keep adding to it. Otherwise, let create a new one.
                  if (!dataStore.has(run.dataStoreKey)) {
                    this.#options.dataStore?.createGroup(run.dataStoreKey);
                  }
                }
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

            if (!this.#options.skipDataStore) {
              await this.#options.dataStore?.replaceDataParts(
                run.dataStoreKey,
                result
              );
            }

            run.addResult(result);
          }

          return run;
        })
    );

    return runs;
  }

  async #storeInRunStore(
    url: RunURL,
    timestamp: RunTimestamp,
    result: HarnessRunResult
  ) {
    const { runStore } = this.#options;
    if (!runStore || !this.#url || !this.#timestamp) {
      return Promise.resolve();
    }

    if (result.type === "error") {
      await runStore?.abort(url, timestamp);
    } else {
      await runStore?.write(url, timestamp, result);
    }
  }

  async #loadStoredRuns(url: string): Promise<RunTimestamp | null> {
    let timestamp: RunTimestamp | null = null;
    if (!this.#options.runStore) {
      return null;
    }
    timestamp = await this.#options.runStore.start(url);
    const runInfo = await this.#options.runStore.getStoredRuns(url);
    this.#runs = await this.#convertRunInfoToRuns(url, runInfo);
    return timestamp;
  }

  resume() {
    this.#runs.at(0)?.resume?.();
  }

  async observe(result: HarnessRunResult): Promise<void> {
    if (result.type === "graphstart") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        this.#url = result.data.graph.url ?? "no-url-graph";
        this.#timestamp = await this.#loadStoredRuns(this.#url);
        if (!this.#timestamp) {
          this.#timestamp = timestamp;
        }

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

        if (this.#options.runStore) {
          await this.#options.runStore.truncate(this.#url, this.#runLimit);
        }
      }
    }

    const run = this.#runs[0];
    if (!run) {
      console.warn(`No run available to store ${result.type} - stopping`);
      return;
    }

    if (!this.#url || !this.#timestamp) {
      console.warn("No URL or timestamp set for the current run - stopping");
      return;
    }

    if (result.type === "graphend") {
      const { path, timestamp } = result.data;
      if (path.length === 0) {
        run.end = timestamp;
      }
    }

    if (!this.#options.skipDataStore) {
      await this.#options.dataStore?.replaceDataParts(run.dataStoreKey, result);
    }

    const mutableRun = run as Run;
    if ("addResult" in mutableRun) {
      mutableRun.addResult(result);
    } else {
      console.warn(
        "Unable to add result to run: this is likely a loaded past run."
      );
      return;
    }

    await this.#storeInRunStore(this.#url, this.#timestamp, result);
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
    const loader = new RunLoader(
      this.#store,
      this.#options.dataStore,
      o,
      options || {}
    );
    const result = await loader.load();
    if (result.success) {
      this.#runs.push(result.run);
    }
    return result;
  }

  async append(history: InspectableRunSequenceEntry[]): Promise<void> {
    for await (const result of eventsAsHarnessRunResults(history)) {
      await this.observe(result);
    }
  }

  async replay(stopAt: NodeIdentifier[]): Promise<void> {
    const lastRun = this.#runs.at(0);
    if (!lastRun) return;

    for await (const result of lastRun.replay()) {
      await this.observe(result);
      const { type, data } = result;
      if (
        type === "nodestart" &&
        data.path.length === 1 &&
        stopAt.includes(data.node.id)
      ) {
        break;
      }
    }
  }
}

export class Run implements InspectableRun {
  public dataStoreKey: string = crypto.randomUUID();

  #events: EventManager;

  start: number;
  end: number | null = null;
  graphVersion: number;
  #dataStore: DataStore | null;

  constructor(
    timestamp: number,
    graphStore: MutableGraphStore,
    graph: GraphDescriptor,
    options: RunObserverOptions
  ) {
    this.#events = new EventManager(graphStore, options);
    this.#dataStore = options.dataStore || null;
    this.graphVersion = 0;
    this.start = timestamp;
  }

  get events(): InspectableRunEvent[] {
    return this.#events.events;
  }

  get edges(): InspectableRunEdge[] {
    return this.#events.edges;
  }

  resume() {
    this.#events.resume();
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

  async *replay(): AsyncGenerator<HarnessRunResult> {
    yield* this.#events.replay();
  }

  async reanimationStateAt(id: EventIdentifier, nodeConfig: NodeConfiguration) {
    return this.#events.reanimationStateAt(id, nodeConfig);
  }
}
