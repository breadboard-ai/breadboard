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
  NodestartTimelineEntry,
  SerializedRun,
  SerializedRunLoadingOptions,
  TimelineEntry,
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

  #asHarnessRunResult(entry: TimelineEntry): HarnessRunResult {
    const [type, data] = entry;
    return { type, data } as HarnessRunResult;
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
        const [type] = result;
        switch (type) {
          case "graphstart":
            observer.observe(this.loadGraphStart(result));
            continue;
          case "nodestart":
            observer.observe(this.loadNodestart(result));
            continue;
          default:
            observer.observe(this.#asHarnessRunResult(result));
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
