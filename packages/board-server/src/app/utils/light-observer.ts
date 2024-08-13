/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriptor } from "@google-labs/breadboard";
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
    runner.addEventListener("edge", this.#edge.bind(this));
    runner.addEventListener("secret", this.#secret.bind(this));
    runner.addEventListener("error", (event) => {
      if (!this.#log) {
        return;
      }
      this.#log = [...this.#log, { type: "error", error: event.data.error }];
    });
    runner.addEventListener("pause", (event) => {
      console.log("🌻 Pausing", event);
    });
    runner.addEventListener("resume", (event) => {
      console.log("🌻 Resuming", event);
      if (this.#currentInput) {
        this.#currentInput.end = globalThis.performance.now();
        this.#currentInput.outputs = event.data.inputs!;
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
    });
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
    this.#log = [...this.#log, this.#currentNode];
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
    console.log("Secret", this.#currentSecret);
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
    const output = new Node(event);
    if (!this.#log) {
      throw new Error("Node started without a graph");
    }
    this.#log = [...this.#log, output];
  }

  #edge(event: RunEdgeEvent) {
    if (!this.#log) {
      throw new Error("Edge started without a graph");
    }

    const edge: EdgeLogEntry = {
      type: "edge",
      start: event.data.timestamp,
      end: event.data.timestamp,
      edge: event.data.edge,
      value: event.data.value,
      from: event.data.from,
      to: event.data.to,
    };

    this.#log = [...this.#log, edge];
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
    if (this.descriptor.type === "input") {
      this.inputs = (event as RunInputEvent).data.inputArguments;
    } else if (this.descriptor.type === "output") {
      this.inputs = (event as RunOutputEvent).data.outputs;
    } else {
      this.inputs = (event as RunNodeStartEvent).data.inputs;
    }
    this.outputs = null;
    if (event.type === "input" || event.type === "output") {
      this.bubbled = (event as RunOutputEvent | RunInputEvent).data.bubbled;
    } else {
      this.bubbled = false;
    }
    this.hidden = false;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }
}
