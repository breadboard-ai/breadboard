/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import {
  InspectableRunNodeEvent,
  InspectableRunSequenceEntry,
} from "../types.js";
import { HarnessRunResult } from "../../harness/types.js";

export { eventsAsHarnessRunResults, sequenceEntryToHarnessRunResult };

export const eventIdFromEntryId = (entryId?: string): string => {
  return `e-${entryId || "0"}`;
};

export const entryIdFromEventId = (eventId?: string): string | null => {
  return eventId?.startsWith("e-") ? eventId.substring(2) : null;
};

export const idFromPath = (path: number[]): string => {
  return path.join("-");
};

export const pathFromId = (id: string): number[] => {
  return id.length ? id.split("-").map((s) => parseInt(s, 10)) : [];
};

function sequenceEntryToHarnessRunResult(
  entry: InspectableRunSequenceEntry,
  trimPath: (path: number[]) => number[] = (path) => path
): HarnessRunResult | null {
  const [type, data] = entry;
  switch (type) {
    case "graphstart": {
      const { graphStart, path, graph: inspectableGraph, edges } = data;
      const graph = inspectableGraph?.raw() as GraphDescriptor;
      const graphId = inspectableGraph?.graphId() || "";
      return {
        type,
        data: {
          timestamp: graphStart,
          graphId,
          path: trimPath(path),
          graph,
          edges,
        },
        async reply() {},
      };
    }
    case "nodestart": {
      const { path } = data;
      const {
        node,
        inputs,
        start: timestamp,
        traversalResult,
      } = data.event as InspectableRunNodeEvent;
      return {
        type,
        data: {
          node: node.descriptor,
          inputs,
          path: trimPath(path),
          timestamp,
        },
        result: traversalResult,
        async reply() {},
      };
    }
    case "nodeend": {
      const { path } = data;
      const {
        node,
        inputs,
        outputs,
        end: timestamp,
        traversalResult,
      } = data.event as InspectableRunNodeEvent;
      return {
        type,
        data: {
          node: node.descriptor,
          inputs,
          outputs: outputs || {},
          path: trimPath(path),
          timestamp: timestamp || 0,
          newOpportunities: traversalResult?.newOpportunities || [],
        },
        async reply() {},
      };
    }
    case "graphend": {
      const { path } = data;
      const { graphEnd: timestamp } = data;
      return {
        type,
        data: { path: trimPath(path), timestamp: timestamp || 0 },
        async reply() {},
      };
    }
    case "error": {
      const { graphStart: timestamp } = data;
      return {
        type,
        data: { error: "TODO: Store actual error object", timestamp },
        async reply() {},
      };
    }
    case "input": {
      const { path } = data;
      const {
        node,
        inputs: inputArguments,
        bubbled,
        start: timestamp,
      } = data.event as InspectableRunNodeEvent;
      return {
        type,
        data: {
          node: node.descriptor,
          inputArguments,
          bubbled,
          path: trimPath(path),
          timestamp,
        },
        async reply() {},
      };
    }
    case "output": {
      const { path } = data;
      const {
        node,
        outputs,
        bubbled,
        start: timestamp,
      } = data.event as InspectableRunNodeEvent;
      return {
        type,
        data: {
          node: node.descriptor,
          outputs: outputs || {},
          bubbled,
          path: trimPath(path),
          timestamp,
        },
        async reply() {},
      };
    }
    case "secret": {
      return null;
    }
    default: {
      throw new Error("Unknown event type: " + type);
    }
  }
}

// TODO: Use sequenceEntryToHarnessRunResult
async function* eventsAsHarnessRunResults(
  events: InspectableRunSequenceEntry[]
): AsyncGenerator<HarnessRunResult> {
  const first = events[0];
  let endPath: number[] = [];
  if (first[0] !== "graphstart") {
    throw new Error(
      "Expected a graphstart event at the beginning of the timeline"
    );
  } else {
    endPath = first[1].path;
  }
  for await (const result of events) {
    const [type, data] = result;
    switch (type) {
      case "graphstart": {
        const { graphStart, path, graph: inspectableGraph, edges } = data;
        const graph =
          inspectableGraph?.mainGraphDescriptor() as GraphDescriptor;
        const graphId = inspectableGraph?.graphId() || "";
        yield {
          type,
          data: {
            timestamp: graphStart,
            path: trimPath(path),
            graph,
            graphId,
            edges,
          },
          async reply() {},
        };
        break;
      }
      case "nodestart": {
        const { path } = data;
        const {
          node,
          inputs,
          start: timestamp,
          traversalResult,
        } = data.event as InspectableRunNodeEvent;
        yield {
          type,
          data: {
            node: node.descriptor,
            inputs,
            path: trimPath(path),
            timestamp,
          },
          result: traversalResult,
          async reply() {},
        };
        break;
      }
      case "nodeend": {
        const { path } = data;
        const {
          node,
          inputs,
          outputs,
          end: timestamp,
          traversalResult,
        } = data.event as InspectableRunNodeEvent;
        yield {
          type,
          data: {
            node: node.descriptor,
            inputs,
            outputs: outputs || {},
            path: trimPath(path),
            timestamp: timestamp || 0,
            newOpportunities: traversalResult?.newOpportunities || [],
          },
          async reply() {},
        };
        break;
      }
      case "graphend": {
        const { path } = data;
        const { graphEnd: timestamp } = data;
        yield {
          type,
          data: { path: trimPath(path), timestamp: timestamp || 0 },
          async reply() {},
        };
        if (path.join(".") === endPath.join(".")) {
          return;
        }
        break;
      }
      case "error": {
        const { graphStart: timestamp } = data;
        yield {
          type,
          data: { error: "TODO: Store actual error object", timestamp },
          async reply() {},
        };
        break;
      }
      case "input": {
        const { path } = data;
        const {
          node,
          inputs: inputArguments,
          bubbled,
          start: timestamp,
        } = data.event as InspectableRunNodeEvent;
        yield {
          type,
          data: {
            node: node.descriptor,
            inputArguments,
            bubbled,
            path: trimPath(path),
            timestamp,
          },
          async reply() {},
        };
        break;
      }
      case "output": {
        const { path } = data;
        const {
          node,
          outputs,
          bubbled,
          start: timestamp,
        } = data.event as InspectableRunNodeEvent;
        yield {
          type,
          data: {
            node: node.descriptor,
            outputs: outputs || {},
            bubbled,
            path: trimPath(path),
            timestamp,
          },
          async reply() {},
        };
        break;
      }
      case "secret": {
        break;
      }
      default: {
        throw new Error("Unknown event type: " + type);
      }
    }
  }

  function trimPath(path: number[]) {
    return path.slice(endPath.length);
  }
}
