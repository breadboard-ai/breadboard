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
  InspectableRunLoadResult,
  InspectableRunNodeEvent,
  InspectableRunObserver,
  NodeDescriberResult,
  NodeDescriptor,
  SerializedRunLoadingOptions,
} from "@google-labs/breadboard";
import type {
  InputValues,
  NodeConfiguration,
  NodeMetadata,
  OutputValues,
  StartLabel,
} from "@google-labs/breadboard-schema/graph.js";
import type {
  HarnessRunner,
  HarnessRunResult,
  RunEdgeEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
} from "@google-labs/breadboard/harness";

/**
 * It's like an InspectableRunObserver, but works with "top" diagnostics flag.
 */
export class LightObserver implements InspectableRunObserver {
  #run: InspectableRun | null = null;
  #currentNode: InspectableRunNodeEvent | null = null;

  constructor(runner: HarnessRunner) {
    runner.addEventListener("nodestart", this.#nodeStart.bind(this));
    runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
    runner.addEventListener("graphstart", this.#graphStart.bind(this));
    runner.addEventListener("graphend", this.#graphEnd.bind(this));
    runner.addEventListener("input", this.#input.bind(this));
    runner.addEventListener("output", this.#output.bind(this));
    runner.addEventListener("edge", this.#edge.bind(this));
  }

  async runs(): Promise<InspectableRun[]> {
    return this.#run ? [this.#run] : [];
  }

  observe(result: HarnessRunResult): Promise<void> {
    throw new Error("Method not implemented.");
  }

  load(
    o: unknown,
    options?: SerializedRunLoadingOptions
  ): Promise<InspectableRunLoadResult> {
    throw new Error("Method not implemented.");
  }

  #graphStart(event: RunGraphStartEvent) {
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
    this.#run = null;
    this.#currentNode = null;
  }

  #nodeStart(event: RunNodeStartEvent) {
    this.#currentNode = {
      type: "node",
      id: event.data.node.id,
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: 0,
      inputs: event.data.inputs,
      outputs: null,
      bubbled: false,
      hidden: false,
      runs: [],
    };
    this.#run?.events.push(this.#currentNode);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    this.#currentNode!.end = event.data.timestamp;
    this.#currentNode!.outputs = event.data.outputs;
    this.#currentNode = null;
  }

  #input(event: RunInputEvent) {
    this.#currentNode = {
      type: "node",
      id: event.data.node.id,
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: 0,
      inputs: event.data.inputArguments,
      outputs: null,
      bubbled: event.data.bubbled,
      hidden: false,
      runs: [],
    };
    this.#run?.events.push(this.#currentNode);
  }

  #output(event: RunOutputEvent) {
    this.#currentNode = {
      type: "node",
      id: event.data.node.id,
      graph: null as unknown as InspectableGraph,
      node: new Node(event.data.node),
      start: event.data.timestamp,
      end: 0,
      inputs: event.data.outputs,
      outputs: null,
      bubbled: event.data.bubbled,
      hidden: false,
      runs: [],
    };
    this.#run?.events.push(this.#currentNode);
  }

  #edge(event: RunEdgeEvent) {
    console.log("Edge", event);
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
    throw new Error("Method not implemented.");
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
