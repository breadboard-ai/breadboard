/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import { asyncGen } from "../../utils/async-gen.js";
import { inspectableGraph } from "../graph.js";
import {
  GraphUUID,
  GraphstartTimelineEntry,
  InspectableGraph,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  NodestartTimelineEntry,
  SerializedRunLoadingOptions,
  TimelineEntry,
} from "../types.js";

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

export class PastRun implements InspectableRun {
  #timeline: TimelineEntry[];
  #graphs = new Map<number, InspectableGraph>();
  #options: SerializedRunLoadingOptions;

  constructor(timeline: TimelineEntry[], options: SerializedRunLoadingOptions) {
    this.#timeline = timeline;
    this.#options = options;
  }

  get graphId(): GraphUUID {
    throw new Error("Past runs can't yet provide graph IDs");
  }

  get graphVersion(): number {
    throw new Error("Past runs can't yet provide graph versions");
  }

  get start(): number {
    throw new Error("Past runs can't yet provide start times");
  }
  get end(): number {
    throw new Error("Past runs can't yet provide end times");
  }

  get events(): InspectableRunEvent[] {
    throw new Error("Past runs can't yet provide events");
  }

  get dataStoreGroupId(): number {
    throw new Error("Past runs can't yet provide data store group IDs");
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    throw new Error("Past runs can't yet provide current node events");
  }

  stack(): InspectableRunNodeEvent[] {
    throw new Error("Past runs can't yet provide stack traces");
  }

  getEventById(): InspectableRunEvent | null {
    throw new Error("Past runs can't yet provide event IDs");
  }

  inputs(): InspectableRunInputs | null {
    throw new Error("Past runs can't yet provide inputs");
  }

  #loadGraphStart(result: GraphstartTimelineEntry): HarnessRunResult {
    const [, data] = result;
    const { index, timestamp, path } = data;
    let { graph } = data;
    if (graph !== null) {
      this.#graphs.set(index, inspectableGraph(graph, this.#options));
    } else {
      graph = this.#graphs.get(index)?.raw() || null;
    }
    return {
      type: "graphstart",
      data: { timestamp, path, graph },
    } as HarnessRunResult;
  }

  #loadNodestart(result: NodestartTimelineEntry): HarnessRunResult {
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

  #asHarnessRunResult(entry: TimelineEntry): HarnessRunResult {
    const [type, data] = entry;
    return { type, data } as HarnessRunResult;
  }

  async *replay(): AsyncGenerator<HarnessRunResult> {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      try {
        for (const result of this.#timeline) {
          const [type] = result;
          switch (type) {
            case "graphstart":
              await next(this.#loadGraphStart(result));
              continue;
            case "nodestart":
              await next(this.#loadNodestart(result));
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
}
