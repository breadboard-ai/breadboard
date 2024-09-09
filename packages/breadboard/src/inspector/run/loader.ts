/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import { replaceSecrets } from "./serializer.js";
import {
  GraphstartTimelineEntry,
  InspectableGraph,
  InspectableRunLoadResult,
  NodestartTimelineEntry,
  SerializedRun,
  SerializedRunLoadingOptions,
  TimelineEntry,
} from "../types.js";
import { inspectableGraph } from "../graph.js";
import { DataStore, SerializedDataStoreGroup } from "../../data/types.js";
import { remapData } from "../../data/inflate-deflate.js";
import { asyncGen } from "../../utils/async-gen.js";
import { PastRun } from "./past-run.js";

export const errorResult = (error: string): HarnessRunResult => {
  return {
    type: "error",
    data: {
      error,
      timestamp: Date.now(),
    },
    reply: async () => {
      // Do nothing
    },
  };
};

export class RunLoader {
  #run: SerializedRun;
  #store: DataStore;
  #graphs = new Map<number, InspectableGraph>();
  #options: SerializedRunLoadingOptions;

  constructor(
    store: DataStore,
    o: unknown,
    options: SerializedRunLoadingOptions
  ) {
    this.#store = store;
    this.#run = o as SerializedRun;
    this.#options = options;
  }

  #asHarnessRunResult(entry: TimelineEntry): HarnessRunResult {
    const [type, data] = entry;
    return { type, data } as HarnessRunResult;
  }

  async #inflateData(
    timeline: TimelineEntry[],
    serializedData: SerializedDataStoreGroup
  ): Promise<TimelineEntry[]> {
    return await Promise.all(
      timeline.map(async (entry) => {
        const [, data] = entry;
        entry[1] = (await remapData(
          this.#store,
          data,
          serializedData
        )) as Promise<TimelineEntry>;
        return entry;
      })
    );
  }

  loadGraphStart(result: GraphstartTimelineEntry): HarnessRunResult {
    const [, data] = result;
    const { index, timestamp, path } = data;
    let { graph } = data;
    if (graph !== null) {
      this.#graphs.set(index, inspectableGraph(graph, this.#options ?? {}));
    } else {
      graph = this.#graphs.get(index)?.raw() || null;
    }
    return {
      type: "graphstart",
      data: { timestamp, path, graph },
    } as HarnessRunResult;
  }

  loadNodestart(result: NodestartTimelineEntry): HarnessRunResult {
    const [, data] = result;
    const { graph: graphIndex, id: node, timestamp, inputs, path } = data;
    const graph = this.#graphs.get(graphIndex);
    if (!graph) {
      throw new Error(
        `Unknown graph index ${graphIndex} while loading nodestart`
      );
    }
    const descriptor = graph.nodeById(node);
    if (!descriptor) {
      throw new Error(`Unknown node id ${node} while loading nodestart`);
    }
    return {
      type: "nodestart",
      data: { timestamp, path, inputs, node: descriptor.descriptor },
    } as HarnessRunResult;
  }

  async *replay() {
    const run = this.#run;
    if (run.$schema !== "tbd") {
      yield errorResult(`Specified "$schema": "${run.$schema}" is not valid`);
    }
    yield* asyncGen<HarnessRunResult>(async (next) => {
      try {
        const secretReplacer = this.#options?.secretReplacer;
        let timeline = secretReplacer
          ? replaceSecrets(run, secretReplacer).timeline
          : run.timeline;
        timeline = run.data
          ? await this.#inflateData(timeline, run.data)
          : timeline;
        for (const result of timeline) {
          const [type] = result;
          switch (type) {
            case "graphstart":
              await next(this.loadGraphStart(result));
              continue;
            case "nodestart":
              await next(this.loadNodestart(result));
              continue;
            default:
              await next(this.#asHarnessRunResult(result));
          }
        }
      } catch (e) {
        const error = e as Error;
        next(errorResult(`Loading run failed with the error ${error.message}`));
      }
    });
  }

  async load(): Promise<InspectableRunLoadResult> {
    const run = this.#run;
    const runId = crypto.randomUUID();
    this.#store.createGroup(runId);

    if (run.$schema !== "tbd") {
      return {
        success: false,
        error: `Specified "$schema" is not valid`,
      };
    }
    try {
      const secretReplacer = this.#options?.secretReplacer;
      let timeline = secretReplacer
        ? replaceSecrets(run, secretReplacer).timeline
        : run.timeline;
      timeline = run.data
        ? await this.#inflateData(timeline, run.data)
        : timeline;
      const pastRun = new PastRun(runId, timeline, this.#options);
      await pastRun.initializeBackingRun();
      return { success: true, run: pastRun };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: `Loading run failed with the error ${error.message}`,
      };
    }
  }
}
