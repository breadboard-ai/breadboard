/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InspectableRun,
  InspectableRunEdge,
  InspectableRunObserver,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";
import type {
  HarnessRunner,
  RunEdgeEvent,
  RunGraphStartEvent,
  RunGraphEndEvent,
  RunNodeStartEvent,
  RunNodeEndEvent,
  RunInputEvent,
  RunOutputEvent,
  RunErrorEvent,
  HarnessRunResult,
} from "@google-labs/breadboard/harness";
import type {
  LogEntry,
  EdgeLogEntry,
  ComponentActivityItem,
  TopGraphRunResult,
  NodeLogEntry,
  TopGraphObserverRunStatus,
} from "../../types/types";
import { formatError } from "../format-error";
import {
  EdgeEntry,
  InputEdge,
  BubbledInputEdge,
  BubbledOutputEdge,
} from "./edge-entry";
import { EdgeValueStore } from "./edge-value-store";
import { EndNodeEntry, NodeEntry, UserNodeEntry } from "./node-entry";
import { RunDetails } from "./run-details";

/**
 * A lightweight rewrite of the `InspectableRunObserver` that
 * only captures the events that are necessary to drive the app UI.
 */
export class TopGraphObserver {
  /**
   * True if this instance is created by replaying a run.
   * Only set to `true` from the static `fromRun` method.
   */
  #replay = false;
  #graph: GraphDescriptor | null = null;
  #status: TopGraphObserverRunStatus = "stopped";
  #log: LogEntry[] | null = null;
  #currentResult: TopGraphRunResult | null = null;
  #currentNode: NodeLogEntry | null = null;
  #edgeValues = new EdgeValueStore();
  #nodeActivity = new Map<string, ComponentActivityItem[]>();
  /**
   * Need to keep track of input separately, because
   * bubbled inputs appear as coming from inside of the
   * node.
   */
  #currentInput: EdgeLogEntry | null = null;
  /**
   * Stores the path of the node that errored.
   */
  #errorPath: number[] | null = null;
  #runDetails: RunDetails | null;

  static async fromRun(run: InspectableRun): Promise<TopGraphObserver> {
    const observer = new TopGraphObserver(new EventTarget() as HarnessRunner);
    observer.#replay = true;
    for await (const result of run.replay()) {
      switch (result.type) {
        case "graphstart": {
          const { path, edges } = result.data;
          if (path.length === 0 && edges) {
            for (const edge of edges as InspectableRunEdge[]) {
              observer.#edgeValues.set(edge.edge, edge.value);
            }
          }
          observer.#graphStart(toEvent(result));
          break;
        }
        case "graphend":
          observer.#graphEnd(toEvent(result));
          break;
        case "nodestart":
          observer.#nodeStart(toEvent(result));
          break;
        case "nodeend":
          observer.#nodeEnd(toEvent(result));
          break;
        case "input":
          observer.#input(toEvent(result));
          break;
        case "output":
          observer.#output(toEvent(result));
          break;
        case "edge":
          observer.#edge(toEvent(result));
          break;
        case "error":
          observer.#error(toEvent(result));
          break;
      }
    }
    return observer;
  }

  constructor(
    runner: HarnessRunner,
    signal?: AbortSignal,
    observer?: InspectableRunObserver
  ) {
    this.#runDetails = observer ? new RunDetails(observer) : null;
    if (signal) {
      signal.addEventListener("abort", this.#abort.bind(this));
    }
    runner.addEventListener("start", () => {
      this.#status = "running";
      this.#currentResult = null;
    });
    runner.addEventListener("pause", () => {
      this.#status = "paused";
      this.#currentResult = null;
    });
    runner.addEventListener("end", () => {
      this.#status = "stopped";
      this.#currentResult = null;
    });
    runner.addEventListener("edge", this.#edge.bind(this));
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("error", this.#error.bind(this));
    runner.addEventListener("resume", (event) => {
      this.#status = "running";
      this.#currentResult = null;
      this.#cleanUpPendingInput(event.data.inputs || {});
    });
  }

  #cleanUpPendingInput(inputs: OutputValues) {
    if (!this.#currentInput) {
      return;
    }
    this.#currentInput.end = globalThis.performance.now();
    this.#currentInput.value = inputs;
    this.#currentInput = null;

    if (this.#log) {
      this.#log = [...this.#log];
    }
  }

  current(): TopGraphRunResult | null {
    if (!this.#log) {
      return null;
    }
    if (!this.#currentResult) {
      this.#currentResult = {
        log: this.#log,
        currentNode: this.#currentNode,
        edgeValues: this.#edgeValues,
        nodeActivity: this.#nodeActivity,
        graph: this.#graph,
        status: this.#status,
      };
    }
    return this.#currentResult;
  }

  #edge(event: RunEdgeEvent) {
    if (event.data.to.length > 1) {
      return;
    }
    this.#edgeValues = this.#edgeValues.set(event.data.edge, event.data.value);
    this.#currentResult = null;
  }

  #abort() {
    this.#cleanUpPendingInput({});
    if (!this.#currentNode) {
      return;
    }
    this.#currentNode.end = globalThis.performance.now();
    this.#currentNode = null;
    if (this.#log) {
      this.#log = [...this.#log, new EndNodeEntry("Activity stopped")];
      this.#currentResult = null;
    }
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;
    if (pathLength > 0) {
      // For immediately nested graph only, replace the last activity item
      // with a graph activity.
      if (pathLength === 2) {
        const node = this.#currentNode;
        if (!node) {
          return;
        }
        const item = node.activity.pop();
        node.activity.push({
          type: "graph",
          description: item?.description || "Graph started",
          path: event.data.path,
        });
        this.#nodeActivity.set(node.descriptor.id, node.activity);
        this.#currentResult = null;
      }
      return;
    }
    if (this.#log) {
      throw new Error("Graph already started");
    }
    if (this.#replay) {
      this.#graph = event.data.graph;
    }
    this.#runDetails?.initialize();
    this.#log = [];
    this.#currentResult = null;
  }

  #graphEnd(event: RunGraphEndEvent) {
    if (event.data.path.length > 0) {
      return;
    }
    this.#currentNode = null;
  }

  #storeErrorPath(path: number[]) {
    if (this.#errorPath && this.#errorPath.length > path.length) {
      return;
    }
    this.#errorPath = path;
  }

  #nodeStart(event: RunNodeStartEvent) {
    const pathLength = event.data.path.length;
    if (pathLength > 1) {
      if (pathLength === 2) {
        const node = this.#currentNode;
        if (!node) {
          return;
        }
        node.activity.push({
          type: getActivityType(event.data.node.type),
          path: event.data.path,
          description: event.data.node.metadata?.title || event.data.node.id,
        });
        this.#nodeActivity.set(node.descriptor.id, node.activity);
        this.#currentResult = null;
      }
      return;
    }

    if (!this.#log) {
      throw new Error("Node started without a graph");
    }

    const type = event.data.node.type;
    switch (type) {
      case "input": {
        return;
      }
      case "output": {
        this.#log = placeOutputInLog(this.#log, new EdgeEntry());
        return;
      }
      default: {
        this.#currentNode = new NodeEntry(event);
        this.#log = [...this.#log, this.#currentNode, new EdgeEntry()];
        this.#currentResult = null;
        return;
      }
    }
  }

  #nodeEnd(event: RunNodeEndEvent) {
    const type = event.data.node.type;

    if (this.#replay && this.#currentInput) {
      if (type === "input") {
        this.#currentInput.end = event.data.timestamp;
        this.#currentInput.value = event.data.outputs;
        this.#currentInput = null;
      }
    }
    if (event.data.path.length > 1) {
      if (event.data.outputs?.["$error"]) {
        this.#storeErrorPath(event.data.path);
      }
      return;
    }
    if (!this.#log) {
      throw new Error("Node end without a graph");
    }

    if (type === "output") {
      return;
    }

    if (this.#currentNode) {
      this.#currentNode.end = event.data.timestamp;
    }
    this.#currentNode = null;

    this.#log = [...this.#log];
    this.#currentResult = null;
  }

  #input(event: RunInputEvent) {
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }

    if (!event.data.bubbled) {
      this.#currentNode = new UserNodeEntry(event);
      this.#currentInput = new InputEdge(
        event,
        this.#runDetails?.lastRunInput(event.data.node.id)
      );
      const edge = this.#currentInput;
      this.#log = placeInputInLog([...this.#log, this.#currentNode!], edge);
      this.#currentResult = null;
      return;
    }
    this.#currentInput = new BubbledInputEdge(event);
    this.#log = placeInputInLog(this.#log, this.#currentInput);
    this.#currentResult = null;
  }

  #output(event: RunOutputEvent) {
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }

    if (!event.data.bubbled) {
      // @ts-expect-error - findLastIndex is not in the TS lib
      const lastEdge = this.#log.findLast(
        // @ts-expect-error - findLastIndex is not in the TS lib
        (entry) => entry.type === "edge"
      );
      if (lastEdge) {
        lastEdge.end = event.data.timestamp;
        lastEdge.schema = event.data.node.configuration?.schema as Schema;
        lastEdge.value = event.data.outputs;
      }
      this.#log = [...this.#log];
      this.#currentNode = new NodeEntry(event);
      this.#currentResult = null;
      return;
    }
    const output = new BubbledOutputEdge(event);
    this.#log = placeOutputInLog(this.#log, output);
    this.#currentResult = null;
  }

  #error(event: RunErrorEvent) {
    this.#status = "stopped";
    if (!this.#log) {
      return;
    }
    if (this.#errorPath && this.#errorPath.length > 1) {
      // @ts-expect-error - findLast is not in the TS lib
      const lastNode = this.#log.findLast((entry) => entry.type === "node");
      lastNode?.activity.push({
        type: "error",
        description: formatError(event.data.error),
        path: this.#errorPath || [],
      });
      if (lastNode) {
        this.#nodeActivity.set(lastNode.descriptor.id, lastNode.activity);
      }
    }
    this.#currentNode = null;
    this.#log = [
      ...this.#log,
      { type: "error", error: event.data.error, path: this.#errorPath || [] },
    ];
    this.#currentResult = null;
  }
}

export function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

/**
 * Places the output edge in the log, according to the following rules:
 * - Until first bubbling input, place output before the last node,
 *   possibly replacing an empty edge.
 * - After first bubbling input, place output after the last node.
 */
function placeOutputInLog(log: LogEntry[], edge: EdgeLogEntry): LogEntry[] {
  const last = log[log.length - 1];
  if (last?.type === "edge" && last.value) {
    return [...log, edge];
  }
  // @ts-expect-error - findLastIndex is not in the TS lib
  const lastNode = log.findLastIndex((entry) => entry.type === "node");
  if (lastNode === -1) {
    return [...log, edge];
  }
  if (lastNode === 0) {
    return [edge, ...log];
  }
  const maybeReplace = log[lastNode - 1] as LogEntry;
  if (maybeReplace.type === "edge" && !maybeReplace.value) {
    return [...log.slice(0, lastNode - 1), edge, ...log.slice(lastNode)];
  }

  // To avoid there being two edges placed side-by-side we skip this edge if we
  // intend to place it next to an existing edge.
  if (lastNode > 0) {
    const succeedingItemIdx = lastNode + 1;
    const precedingItemIsEdge = log[lastNode] && log[lastNode].type === "edge";
    const succeedingItemIsEdge =
      log[succeedingItemIdx] && log[succeedingItemIdx].type === "edge";
    if (precedingItemIsEdge || succeedingItemIsEdge) {
      return [...log];
    }
  }

  return [...log.slice(0, lastNode), edge, ...log.slice(lastNode)];
}

function placeInputInLog(log: LogEntry[], edge: EdgeLogEntry): LogEntry[] {
  const last = log[log.length - 1];
  if (last?.type === "edge" && !last.value) {
    return [...log.slice(0, -1), edge];
  }
  return [...log, edge];
}

function getActivityType(type: string): ComponentActivityItem["type"] {
  switch (type) {
    case "input":
      return "input";
    case "output":
      return "output";
    default:
      return "node";
  }
}

function toEvent<E extends Event>(result: HarnessRunResult): E {
  return {
    data: result.data,
  } as unknown as E;
}
