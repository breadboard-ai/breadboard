/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphEndProbeData } from "@breadboard-ai/types";
import { HarnessRunResult } from "../../harness/types.js";
import { asyncGen } from "../../utils/async-gen.js";
import {
  GraphstartTimelineEntry,
  InspectableGraph,
  MutableGraphStore,
  NodestartTimelineEntry,
  TimelineEntry,
} from "../types.js";

export { Replay };

class Replay {
  #graphStore: MutableGraphStore;
  #timeline: TimelineEntry[];
  #start: number;
  #graphs = new Map<number, InspectableGraph>();

  constructor(
    graphStore: MutableGraphStore,
    timeline: TimelineEntry[],
    start: number
  ) {
    this.#graphStore = graphStore;
    this.#timeline = timeline;
    this.#start = start;
  }

  #loadGraphStart(result: GraphstartTimelineEntry): HarnessRunResult {
    const [, data] = result;
    const { index, timestamp, path, graphId, edges } = data;
    let { graph } = data;
    if (graph !== null) {
      const inspector = this.#graphStore.inspectSnapshot(graph, graphId)!;
      this.#graphs.set(index, inspector);
    } else {
      graph = this.#graphs.get(index)?.raw() || null;
    }
    return {
      type: "graphstart",
      data: { timestamp, path, graph, edges },
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
    const isView = this.#start !== 0;
    const timeline = this.#timeline.slice(this.#start);
    const first = timeline[0];
    let endPath = [];
    if (first[0] !== "graphstart") {
      throw new Error(
        "Expected a graphstart event at the beginning of the timeline"
      );
    } else if (isView) {
      endPath = first[1].path;
    }
    yield* asyncGen<HarnessRunResult>(async (next) => {
      try {
        loop: for (const result of timeline) {
          const [type] = result;
          switch (type) {
            case "graphstart": {
              await next(this.#loadGraphStart(result));
              continue;
            }
            case "nodestart":
              await next(this.#loadNodestart(result));
              continue;
            case "graphend": {
              await next(this.#asHarnessRunResult(result));
              if (isView) {
                const [, data] = result;
                const { path } = data as GraphEndProbeData;
                if (path.length === endPath.length) {
                  break loop;
                }
              }
              break;
            }
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

function errorResult(error: string): HarnessRunResult {
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
}
