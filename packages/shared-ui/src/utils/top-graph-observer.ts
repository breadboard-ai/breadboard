/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type InspectableEdge,
  type NodeDescriptor,
  type Schema,
  type Edge as EdgeType,
  InspectableEdgeType,
} from "@google-labs/breadboard";
import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard-schema/graph.js";
import type {
  HarnessRunner,
  RunEdgeEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
} from "@google-labs/breadboard/harness";
import type {
  EdgeLogEntry,
  LogEntry,
  NodeLogEntry,
  TopGraphRunResult,
} from "../types/types.js";

const idFromPath = (path: number[]): string => {
  return `e-${path.join("-")}`;
};

/**
 * Places the output edge in the log, according to the following rules:
 * - Until first bubbling input, place output before the last node,
 *   possibly replacing an empty edge.
 * - After first bubbling input, place output after the last node.
 */
const placeOutputInLog = (log: LogEntry[], edge: EdgeLogEntry): LogEntry[] => {
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
};

const placeInputInLog = (log: LogEntry[], edge: EdgeLogEntry): LogEntry[] => {
  const last = log[log.length - 1];
  if (last?.type === "edge" && !last.value) {
    return [...log.slice(0, -1), edge];
  }
  return [...log, edge];
};

/**
 * A lightweight rewrite of the `InspectableRunObserver` that
 * only captures the events that are necessary to drive the app UI.
 */
export class TopGraphObserver {
  #log: LogEntry[] | null = null;
  #currentResult: TopGraphRunResult | null = null;
  #currentNode: NodeLogEntry | null = null;
  #edgeValues = new EdgeValueStore();
  /**
   * Need to keep track of input separately, because
   * bubbled inputs appear as coming from inside of the
   * node.
   */
  #currentInput: EdgeLogEntry | null = null;

  constructor(runner: HarnessRunner, signal?: AbortSignal) {
    if (signal) {
      signal.addEventListener("abort", this.#abort.bind(this));
    }
    runner.addEventListener("edge", this.#edge.bind(this));
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("error", (event) => {
      if (!this.#log) {
        return;
      }
      this.#log = [...this.#log, { type: "error", error: event.data.error }];
      this.#currentResult = null;
    });
    runner.addEventListener("resume", (event) => {
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
      this.#currentResult = null;
    }
  }

  current(): TopGraphRunResult | null {
    if (!this.#log) {
      return null;
    }
    if (!this.#currentResult) {
      const currentNodeEntry =
        // @ts-expect-error -- TS doesn't know findLastIndex exists
        this.#log.findLast((entry) => {
          return entry.type === "node";
        }) as NodeLogEntry | undefined;
      this.#currentResult = {
        log: this.#log,
        currentNode: currentNodeEntry ? currentNodeEntry.descriptor : null,
        edgeValues: this.#edgeValues,
      };
    }
    return this.#currentResult;
  }

  #edge(event: RunEdgeEvent) {
    this.#edgeValues = this.#edgeValues.set(event.data.edge, event.data.value);
  }

  #abort() {
    this.#cleanUpPendingInput({});
    if (!this.#currentNode) {
      return;
    }
    this.#currentNode.end = globalThis.performance.now();
    this.#currentNode = null;
    if (this.#log) {
      this.#log = [...this.#log, new EndNode("Activity stopped")];
      this.#currentResult = null;
    }
  }

  #graphStart(event: RunGraphStartEvent) {
    if (event.data.path.length > 0) {
      return;
    }
    if (this.#log) {
      throw new Error("Graph already started");
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

  #nodeStart(event: RunNodeStartEvent) {
    if (event.data.path.length > 1) {
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
        this.#log = placeOutputInLog(this.#log, new Edge());
        return;
      }
      default: {
        this.#currentNode = new Node(event);
        this.#log = [...this.#log, this.#currentNode, new Edge()];
        this.#currentResult = null;
        return;
      }
    }
  }

  #nodeEnd(event: RunNodeEndEvent) {
    if (event.data.path.length > 1) {
      return;
    }
    if (!this.#log) {
      throw new Error("Node end without a graph");
    }

    const type = event.data.node.type;
    if (type === "output") {
      return;
    }

    this.#currentNode!.end = event.data.timestamp;
    this.#currentNode = null;

    this.#log = [...this.#log];
    this.#currentResult = null;
  }

  #input(event: RunInputEvent) {
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }

    if (!event.data.bubbled) {
      this.#currentNode = new UserNode(event);
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
      this.#currentResult = null;
      return;
    }
    const output = new BubbledOutputEdge(event);
    this.#log = placeOutputInLog(this.#log, output);
    this.#currentResult = null;
  }
}

class Node implements NodeLogEntry {
  type: "node";
  id: string;
  descriptor: NodeDescriptor;
  hidden: boolean;
  outputs: OutputValues | null;
  inputs?: InputValues;
  start: number;
  bubbled: boolean;
  end: number | null;

  constructor(event: RunInputEvent | RunOutputEvent | RunNodeStartEvent) {
    this.type = "node";
    this.id = idFromPath(event.data.path);
    this.descriptor = event.data.node;
    this.start = event.data.timestamp;
    this.end = null;

    const type = this.descriptor.type;
    switch (type) {
      case "input": {
        const inputEvent = event as RunInputEvent;
        this.inputs = inputEvent.data.inputArguments;
        this.bubbled = inputEvent.data.bubbled;
        break;
      }
      case "output": {
        const outputEvent = event as RunOutputEvent;
        this.inputs = outputEvent.data.outputs;
        this.end = event.data.timestamp;
        this.bubbled = outputEvent.data.bubbled;
        break;
      }
      default: {
        this.bubbled = false;
      }
    }
    this.outputs = null;
    this.hidden = false;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }
}

class Edge implements EdgeLogEntry {
  type = "edge" as const;
  value?: InputValues | undefined;
  end = null;
}

class BubbledOutputEdge implements EdgeLogEntry {
  type = "edge" as const;
  value?: OutputValues | undefined;
  schema: Schema | undefined;
  end: number;

  constructor(event: RunOutputEvent) {
    this.schema = event.data.node.configuration?.schema as Schema;
    this.value = event.data.outputs;
    this.end = event.data.timestamp;
  }
}

class BubbledInputEdge implements EdgeLogEntry {
  type = "edge" as const;
  id: string;
  value: InputValues | undefined;
  schema: Schema | undefined;
  end: number | null;

  constructor(event: RunInputEvent) {
    this.schema = event.data.inputArguments.schema;
    this.id = idFromPath(event.data.path);
    this.end = null;
  }
}

class InputEdge implements EdgeLogEntry {
  type = "edge" as const;
  id: string;
  value: InputValues | undefined;
  schema: Schema | undefined;
  end: number | null;

  constructor(event: RunInputEvent) {
    this.schema = event.data.inputArguments.schema as Schema;
    this.id = idFromPath(event.data.path);
    this.end = null;
  }
}

class UserNode extends Node {
  constructor(event: RunInputEvent) {
    super(event);
    this.descriptor = structuredClone(this.descriptor);
    this.descriptor.type = "user";
  }

  title(): string {
    return "User";
  }
}

class EndNode implements NodeLogEntry {
  type = "node" as const;
  id: string = "end";
  descriptor = {
    id: "end",
    metadata: {
      title: "End",
    },
    type: "end",
  };
  hidden = false;
  start = globalThis.performance.now();
  bubbled = false;
  end = globalThis.performance.now();

  constructor(reason: string) {
    this.descriptor.metadata!.title = reason;
  }

  title(): string {
    return this.descriptor.metadata!.title!;
  }
}

type EdgeValueStoreMap = Map<string, NodeValue[]>;

class EdgeValueStore {
  #values: EdgeValueStoreMap;

  constructor(values: EdgeValueStoreMap = new Map()) {
    this.#values = values;
  }

  #key(
    from: string,
    out: string,
    to: string,
    iN: string,
    constant: boolean | undefined
  ) {
    return `${from}|${out}|${to}|${iN}|${constant === true ? "c" : ""}`;
  }

  #keyFromEdge(edge: EdgeType): string {
    return this.#key(
      edge.from,
      edge.out || "",
      edge.to,
      edge.in || "",
      edge.constant
    );
  }

  #keyFromInspectableEdge(edge: InspectableEdge): string {
    const from = edge.from.descriptor.id;
    const out = edge.out;
    const to = edge.to.descriptor.id;
    const iN = edge.in;
    const constant = edge.type === InspectableEdgeType.Constant;
    return this.#key(from, out, to, iN, constant);
  }

  set(edge: EdgeType, inputs: InputValues | undefined): EdgeValueStore {
    if (!inputs) {
      return this;
    }
    const value = edge.out === "*" || !edge.in ? inputs : inputs[edge.in];
    const key = this.#keyFromEdge(edge);
    if (!this.#values.has(key)) {
      this.#values.set(key, [value]);
    } else {
      const edgeValues = this.#values.get(key);
      this.#values.set(key, [...edgeValues!, value]);
    }
    return new EdgeValueStore(this.#values);
  }

  get(edge: InspectableEdge): NodeValue[] {
    const key = this.#keyFromInspectableEdge(edge);
    return this.#values.get(key) || [];
  }
}