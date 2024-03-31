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
  InspectableRunObserver,
  SerializedRun,
  SerializedRunLoadingOptions,
} from "../types.js";
import { inspectableGraph } from "../graph.js";

export class RunLoader {
  #run: SerializedRun;
  #graphs = new Map<number, InspectableGraph>();
  #options: SerializedRunLoadingOptions;

  constructor(o: unknown, options: SerializedRunLoadingOptions) {
    this.#run = o as SerializedRun;
    this.#options = options;
  }

  loadGraphStart(result: GraphstartTimelineEntry): HarnessRunResult {
    const { index, timestamp, path } = result.data;
    let graph = result.data.graph;
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

  load(observer: InspectableRunObserver): InspectableRunLoadResult {
    const run = this.#run;
    if (run.$schema !== "tbd") {
      return {
        success: false,
        error: `Specified "$schema" is not valid`,
      };
    }
    try {
      const secretReplacer = this.#options?.secretReplacer;
      const timeline = secretReplacer
        ? replaceSecrets(run, secretReplacer).timeline
        : run.timeline;
      for (const result of timeline) {
        switch (result.type) {
          case "graphstart":
            observer.observe(this.loadGraphStart(result));
            continue;
          default:
            observer.observe(result as HarnessRunResult);
        }
      }
      return { success: true };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: `Loading run failed with the error ${error.message}`,
      };
    }
  }
}
