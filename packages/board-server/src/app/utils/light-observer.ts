/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriptor, Schema } from "@google-labs/breadboard";
import type {
  InputValues,
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
  RunSecretEvent,
} from "@google-labs/breadboard/harness";
import type {
  EdgeLogEntry,
  LogEntry,
  NodeLogEntry,
  SecretLogEntry,
} from "./types.js";

const idFromPath = (path: number[]): string => {
  return `e-${path.join("-")}`;
};

const insertBeforeLastNode = (
  log: LogEntry[],
  edge: EdgeLogEntry
): LogEntry[] => {
  // @ts-expect-error
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
  return [...log.slice(0, lastNode), edge, ...log.slice(lastNode)];
};

/**
 * A lightweight rewrite of the `InspectableRunObserver` that
 * only captures the events that are necessary to drive the app UI.
 */
export class LightObserver {
  #log: LogEntry[] | null = null;
  #currentNode: NodeLogEntry | null = null;
  /**
   * Need to keep track of input separately, because
   * bubbled inputs appear as coming from inside of the
   * node.
   */
  #currentInput: NodeLogEntry | null = null;
  /**
   * Need to keep track of secret separately, because
   * bubbled secrets may appear as coming from inside of the
   * node.
   */
  #currentSecret: SecretLogEntry | null = null;

  constructor(runner: HarnessRunner) {
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("secret", this.#secret.bind(this));
    runner.addEventListener("error", (event) => {
      if (!this.#log) {
        return;
      }
      this.#log = [...this.#log, { type: "error", error: event.data.error }];
    });
    runner.addEventListener("resume", (event) => {
      this.#cleanUpPendingNodes(event.data.inputs || {});
    });
  }

  #cleanUpPendingNodes(inputs: OutputValues) {
    if (this.#currentInput) {
      this.#currentInput.end = globalThis.performance.now();
      this.#currentInput.outputs = inputs;
      this.#currentInput = null;
    } else if (this.#currentSecret) {
      this.#currentSecret.end = globalThis.performance.now();
      this.#currentSecret = null;
    } else {
      return;
    }
    if (this.#log) {
      this.#log = [...this.#log];
    }
  }

  log(): LogEntry[] | null {
    return this.#log;
  }

  #graphStart(event: RunGraphStartEvent) {
    if (event.data.path.length > 0) {
      return;
    }
    if (this.#log) {
      throw new Error("Graph already started");
    }
    this.#log = [];
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

    this.#currentNode = new Node(event);
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }
    this.#log = [...this.#log, this.#currentNode, new Edge()];
  }

  #nodeEnd(event: RunNodeEndEvent) {
    if (event.data.path.length > 1) {
      return;
    }

    this.#currentNode!.end = event.data.timestamp;
    this.#currentNode!.outputs = event.data.outputs;
    this.#currentNode = null;
    if (!this.#log) {
      throw new Error("Node end without a graph");
    }

    this.#log = [...this.#log];
  }

  #secret(event: RunSecretEvent) {
    this.#currentSecret = {
      type: "secret",
      start: event.data.timestamp,
      keys: event.data.keys,
      end: null,
    };
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }
    this.#log = [...this.#log, this.#currentSecret];
  }

  #input(event: RunInputEvent) {
    if (!event.data.bubbled) {
      // Non-bubbled events will present themselves as node starts.
      return;
    }
    this.#currentInput = new Node(event);
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }
    this.#log = [...this.#log, this.#currentInput];
  }

  #output(event: RunOutputEvent) {
    if (!event.data.bubbled) {
      // Non-bubbled events will present themselves as node ends.
      return;
    }
    const output = new OutputEdge(event);
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }
    this.#log = insertBeforeLastNode(this.#log, output);
  }
}

class Node implements NodeLogEntry {
  type: "node";
  id: string;
  descriptor: NodeDescriptor;
  hidden: boolean;
  outputs: OutputValues | null;
  inputs: InputValues;
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
        this.inputs = (event as RunNodeStartEvent).data.inputs;
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
  type: "edge" = "edge";
  value?: InputValues | undefined;
}

class OutputEdge implements EdgeLogEntry {
  type: "edge" = "edge";
  value?: OutputValues | undefined;
  schema: Schema | undefined;

  constructor(event: RunOutputEvent) {
    this.schema = event.data.node.configuration?.schema as Schema;
    this.value = event.data.outputs;
  }
}
