/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { HarnessRunResult } from "../../harness/types.js";
import type {
  EventIdentifier,
  GraphUUID,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  PathRegistryEntry,
} from "../types.js";
import { entryIdFromEventId, pathFromId } from "./conversions.js";

/**
 * Meant to be a very lightweight wrapper around the
 * data in the `PathRegistryEntry`.
 */
export class NestedRun implements InspectableRun {
  public readonly dataStoreKey = Date.now().toFixed(3);

  #entry: PathRegistryEntry;

  graphId: GraphUUID;
  start: number;
  end: number | null;
  graphVersion = 0;
  events: InspectableRunEvent[];
  edges = [];

  constructor(entry: PathRegistryEntry) {
    this.graphId = entry.graphId as GraphUUID;
    this.start = entry.graphStart;
    this.end = entry.graphEnd;
    this.events = entry.events;
    this.#entry = entry;
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    return null;
  }

  stack(): InspectableRunNodeEvent[] {
    // TODO: Implement stack support for nested runs.
    return [];
  }

  getEventById(id: EventIdentifier): InspectableRunEvent | null {
    const entryId = entryIdFromEventId(id);
    if (!entryId) return null;
    const path = pathFromId(entryId);
    const entry = this.#entry.find(path);
    return entry?.event || null;
  }

  inputs(): InspectableRunInputs | null {
    return null;
  }

  async *replay(): AsyncGenerator<HarnessRunResult> {
    const { view } = this.#entry;
    if (!view) {
      return;
    }
    const { sequence, start } = view;
    if (!sequence) {
      return;
    }
    const timeline = sequence.slice(start);
    const first = timeline[0];
    let endPath: number[] = [];
    if (first[0] !== "graphstart") {
      throw new Error(
        "Expected a graphstart event at the beginning of the timeline"
      );
    } else {
      endPath = first[1].path;
    }
    for await (const result of timeline) {
      const [type, data] = result;
      switch (type) {
        case "graphstart": {
          const { graphStart, path, graph: inspectableGraph, edges } = data;
          const graph = inspectableGraph?.raw() as GraphDescriptor;
          yield {
            type,
            data: { timestamp: graphStart, path: trimPath(path), graph, edges },
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
          } = data.event as InspectableRunNodeEvent;
          yield {
            type,
            data: {
              node: node.descriptor,
              inputs,
              path: trimPath(path),
              timestamp,
            },
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
          } = data.event as InspectableRunNodeEvent;
          yield {
            type,
            data: {
              node: node.descriptor,
              inputs,
              outputs: outputs || {},
              path: trimPath(path),
              timestamp: timestamp || 0,
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
}
