/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  HarnessRunner,
  HarnessRunResult,
  InspectableRun,
  InspectableRunSequenceEntry,
  NodeIdentifier,
  OutputValues,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  Schema,
} from "@breadboard-ai/types";
import { sequenceEntryToHarnessRunResult } from "@google-labs/breadboard";
import type {
  ComponentActivityItem,
  EdgeLogEntry,
  LogEntry,
  NodeLogEntry,
  TopGraphObserverRunStatus,
  TopGraphRunResult,
} from "../../types/types";
import { formatError } from "../format-error";
import {
  BubbledInputEdge,
  BubbledOutputEdge,
  EdgeEntry,
  InputEdge,
} from "./edge-entry";
import { EdgeValueStore } from "./edge-value-store";
import { EndNodeEntry, NodeEntry, UserNodeEntry } from "./node-entry";
import { NodeInformation } from "./node-information";

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
  #nodeActivity = new Map<NodeIdentifier, ComponentActivityItem[]>();
  #canRunState = new Map<NodeIdentifier, boolean>();
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

  static async fromRun(run: InspectableRun): Promise<TopGraphObserver> {
    const observer = new TopGraphObserver(new EventTarget() as HarnessRunner);
    observer.#replay = true;
    for await (const result of run.replay()) {
      switch (result.type) {
        case "graphstart": {
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
        case "error":
          observer.#error(toEvent(result));
          break;
      }
    }
    return observer;

    function toEvent<E extends Event>(result: HarnessRunResult): E {
      return {
        data: result.data,
      } as unknown as E;
    }
  }

  static entryResult(graph: GraphDescriptor | undefined): TopGraphRunResult {
    // const entryId = computeEntryId(graph);
    return {
      log: [],
      currentNode: null,
      edgeValues: {
        get() {
          return undefined;
        },
        current: null,
      },
      nodeInformation: {
        getActivity() {
          return undefined;
        },
        canRunNode(_id: NodeIdentifier) {
          return false;
          // TODO: Bring this back once we have stable runs
          // return id === entryId;
        },
      },
      graph: graph || null,
      status: "stopped",
    };

    // Ideally, this function should live somewhere in packages/breadboard,
    // but for now, this is good enough.
    // function computeEntryId(graph?: GraphDescriptor) {
    //   if (!graph || !graph.edges) return;
    //   const incoming = new Set(graph.edges.map((edge) => edge.to));
    //   const entries = graph.nodes.filter((node) => !incoming.has(node.id));
    //   return entries.at(0)?.id;
    // }
  }

  constructor(runner: HarnessRunner, signal?: AbortSignal) {
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
        nodeInformation: new NodeInformation(
          this.#nodeActivity,
          this.#canRunState
        ),
        graph: this.#graph,
        status: this.#status,
      };
    }
    return this.#currentResult;
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

    this.#canRunState.set(event.data.node.id, true);

    const type = event.data.node.type;
    switch (type) {
      case "input": {
        this.#currentNode = new NodeEntry(event);
        this.#currentResult = null;
        return;
      }
      case "output": {
        this.#currentNode = new NodeEntry(event);
        this.#log = placeOutputInLog(this.#log, new EdgeEntry());
        this.#currentResult = null;
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

    this.#edgeValues = this.#edgeValues.setConsumed(event.data.node.id);
    this.#edgeValues.setStored(event.data.newOpportunities, event.data.outputs);

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
      this.#currentInput = new InputEdge(event);
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
      const lastEdge = this.#log.findLast((entry) => entry.type === "edge");
      if (lastEdge) {
        lastEdge.end = event.data.timestamp;
        lastEdge.descriptor = event.data.node;
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

  startWith(entries: InspectableRunSequenceEntry[]) {
    // This code is roughly equivalent to `fromRun`.
    // TODO: Reconcile and unify.
    for (const entry of entries) {
      const [type] = entry;
      switch (type) {
        case "graphstart": {
          this.#graphStart(toEvent(entry));
          break;
        }
        case "graphend":
          this.#graphEnd(toEvent(entry));
          break;
        case "nodestart": {
          this.#nodeStart(toEvent(entry));
          break;
        }
        case "nodeend":
          this.#nodeEnd(toEvent(entry));
          break;
        case "input":
          this.#input(toEvent(entry));
          break;
        case "output":
          this.#output(toEvent(entry));
          break;
        case "error":
          this.#error(toEvent(entry));
          break;
      }
    }

    function toEvent<E extends Event>(entry: InspectableRunSequenceEntry): E {
      const result = sequenceEntryToHarnessRunResult(entry);
      if (!result) {
        throw new Error(
          `Unable to create harness run result from "${entry[0]}"`
        );
      }
      return {
        data: result.data,
      } as unknown as E;
    }
  }

  updateAffected(affectedNodes: NodeIdentifier[]) {
    if (!this.#log) {
      return;
    }
    const nodes = new Set(affectedNodes);
    let stopHere: LogEntry | undefined = undefined;
    for (const entry of this.#log) {
      if (entry.type === "error") continue;
      if (entry instanceof UserNodeEntry) continue;

      const id = entry.descriptor?.id;
      if (!id) continue;

      if (stopHere === undefined) {
        if (nodes.has(id)) {
          stopHere = entry;
          this.#edgeValues.unconsume(id);
          this.#edgeValues.delete(id);
          this.#nodeActivity.delete(id);
        }
      } else {
        this.#edgeValues.delete(id);
        this.#canRunState.delete(id);
        this.#nodeActivity.delete(id);
      }
    }
    if (stopHere !== undefined) {
      this.#currentResult = null;
      this.#currentNode = stopHere.type === "node" ? stopHere : null;
      this.#edgeValues = this.#edgeValues.clone();
    }
  }
}

export function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}

function isStreamingOutput(edge: EdgeLogEntry): boolean {
  return !!edge.value && "reportStream" in edge.value;
}

/**
 * Places the output edge in the log, according to the following rules:
 * - Until first bubbling input, place output before the last node,
 *   possibly replacing an empty edge.
 * - After first bubbling input, place output after the last node.
 */
function placeOutputInLog(log: LogEntry[], edge: EdgeLogEntry): LogEntry[] {
  // Remove streaming outputs from TGO. It doesn't support them anyway.
  if (isStreamingOutput(edge)) return log;
  const last = log[log.length - 1];
  if (last?.type === "edge" && last.value) {
    return [...log, edge];
  }
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

  // Comment out this logic, because it causes transient outputs from modules
  // to be eaten.
  // TODO: Figure out if this should just be deleted or improved to avoid
  // eating outputs from modules.
  // To avoid there being two edges placed side-by-side we skip this edge if we
  // intend to place it next to an existing edge.
  // if (lastNode > 0) {
  //   const succeedingItemIdx = lastNode + 1;
  //   const precedingItemIsEdge = log[lastNode] && log[lastNode].type === "edge";
  //   const succeedingItemIsEdge =
  //     log[succeedingItemIdx] && log[succeedingItemIdx].type === "edge";
  //   if (precedingItemIsEdge || succeedingItemIsEdge) {
  //     return [...log, edge];
  //   }
  // }

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
