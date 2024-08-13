/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InspectableEdge,
  InspectableGraph,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
  InspectableRun,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  InspectableRunEdgeEvent,
  NodeDescriberResult,
  NodeDescriptor,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import type {
  InputValues,
  NodeConfiguration,
  NodeMetadata,
  NodeTypeIdentifier,
  OutputValues,
  StartLabel,
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

const idFromPath = (path: number[]): string => {
  return `e-${path.join("-")}`;
};

/**
 * A lightweight rewrite of the `InspectableRunObserver` that
 * only captures the events that are necessary to drive the app UI.
 */
export class LightObserver {
  #run: InspectableRun | null = null;
  #currentNode: InspectableRunNodeEvent | null = null;
  /**
   * Need to keep track of input separately, because
   * bubbled inputs appear as coming from inside of the
   * node.
   */
  #currentInput: InspectableRunNodeEvent | null = null;
  /**
   * Need to keep track of secret separately, because
   * bubbled secrets may appear as coming from inside of the
   * node.
   */
  #currentSecret: InspectableRunSecretEvent | null = null;

  constructor(runner: HarnessRunner) {
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("edge", this.#edge.bind(this));
    runner.addEventListener("secret", this.#secret.bind(this));
    runner.addEventListener("resume", (event) => {
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
      if (this.#run) {
        this.#run.events = [...this.#run.events];
      }
    });
  }

  runs(): InspectableRun[] {
    return this.#run ? [this.#run] : [];
  }

  #graphStart(event: RunGraphStartEvent) {
    if (event.data.path.length > 0) {
      return;
    }
    if (this.#run) {
      throw new Error("Graph already started");
    }
    this.#run = {
      graphId: "1|graph",
      graphVersion: 0,
      start: event.data.timestamp,
      end: 0,
      events: [],
      dataStoreKey: "run",
      currentNodeEvent() {
        throw new Error("Method not implemented.");
      },
      stack() {
        throw new Error("Method not implemented.");
      },
      getEventById() {
        throw new Error("Method not implemented.");
      },
      inputs() {
        throw new Error("Method not implemented.");
      },
      replay() {
        throw new Error("Method not implemented.");
      },
    };
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

    this.#currentNode = {
      type: "node",
      id: idFromPath(event.data.path),
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: null,
      inputs: event.data.inputs,
      outputs: null,
      bubbled: false,
      hidden: false,
      runs: [],
    };
    if (!this.#run) {
      throw new Error("Node started without a graph");
    }
    this.#run.events = [...this.#run.events, this.#currentNode];
  }

  #nodeEnd(event: RunNodeEndEvent) {
    if (event.data.path.length > 1) {
      return;
    }

    this.#currentNode!.end = event.data.timestamp;
    this.#currentNode!.outputs = event.data.outputs;
    this.#currentNode = null;
    if (!this.#run) {
      throw new Error("Node end without a graph");
    }

    this.#run.events = [...this.#run.events];
  }

  #secret(event: RunSecretEvent) {
    this.#currentSecret = {
      type: "secret",
      start: event.data.timestamp,
      id: "secret",
      keys: event.data.keys,
      end: null,
    };
    if (!this.#run) {
      throw new Error("Node started without a graph");
    }
    console.log("Secret", this.#currentSecret);
    this.#run.events = [...this.#run.events, this.#currentSecret];
  }

  #input(event: RunInputEvent) {
    if (!event.data.bubbled) {
      // Non-bubbled events will present themselves as node starts.
      return;
    }
    this.#currentInput = {
      type: "node",
      id: idFromPath(event.data.path),
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: null,
      inputs: event.data.inputArguments,
      outputs: null,
      bubbled: event.data.bubbled,
      hidden: false,
      runs: [],
    };
    if (!this.#run) {
      throw new Error("Node started without a graph");
    }
    this.#run.events = [...this.#run.events, this.#currentInput];
  }

  #output(event: RunOutputEvent) {
    if (!event.data.bubbled) {
      // Non-bubbled events will present themselves as node ends.
      return;
    }
    const output: InspectableRunNodeEvent = {
      type: "node",
      id: idFromPath(event.data.path),
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: event.data.timestamp,
      inputs: event.data.outputs,
      outputs: null,
      bubbled: event.data.bubbled,
      hidden: false,
      runs: [],
    };
    if (!this.#run) {
      throw new Error("Node started without a graph");
    }
    this.#run.events = [...this.#run.events, output];
  }

  #edge(event: RunEdgeEvent) {
    if (!this.#run) {
      throw new Error("Edge started without a graph");
    }

    const edge: InspectableRunEdgeEvent = {
      type: "edge",
      id: "edge",
      start: event.data.timestamp,
      end: event.data.timestamp,
      edge: event.data.edge,
      value: event.data.value,
      from: event.data.from,
      to: event.data.to,
    };

    this.#run.events = [...this.#run.events, edge];
  }
}

class Node implements InspectableNode {
  descriptor: NodeDescriptor;

  constructor(descriptor: NodeDescriptor) {
    this.descriptor = descriptor;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }

  description(): string {
    return this.descriptor.metadata?.description || this.title();
  }

  incoming(): InspectableEdge[] {
    throw new Error("Method not implemented.");
  }

  outgoing(): InspectableEdge[] {
    throw new Error("Method not implemented.");
  }

  isEntry(label: StartLabel = "default"): boolean {
    throw new Error("Method not implemented.");
  }

  startLabels(): StartLabel[] | undefined {
    throw new Error("Method not implemented.");
  }

  isExit(): boolean {
    throw new Error("Method not implemented.");
  }

  type(): InspectableNodeType {
    return new NodeType(this.descriptor.type);
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  metadata(): NodeMetadata {
    return this.descriptor.metadata || {};
  }

  async describe(inputs?: InputValues): Promise<NodeDescriberResult> {
    throw new Error("Method not implemented.");
  }

  async ports(
    inputValues?: InputValues,
    outputValues?: OutputValues
  ): Promise<InspectableNodePorts> {
    throw new Error("Method not implemented.");
  }
}

class NodeType implements InspectableNodeType {
  #type: string;

  constructor(type: string) {
    this.#type = type;
  }

  metadata(): NodeHandlerMetadata {
    // TODO: Figure this out.
    return {};
  }

  type(): NodeTypeIdentifier {
    return this.#type;
  }

  ports(): Promise<InspectableNodePorts> {
    throw new Error("Method not implemented.");
  }
}
